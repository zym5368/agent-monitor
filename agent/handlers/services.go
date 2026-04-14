package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

type ServiceInfo struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Status      string `json:"status"` // "running", "stopped", "unknown"
	Enabled     bool   `json:"enabled"`
}

type subscriptionUpdateResult struct {
	Service     string   `json:"service"`
	Success     bool     `json:"success"`
	Status      string   `json:"status"` // success | failed | partial | unknown
	Script      string   `json:"script,omitempty"`
	ScriptTried []string `json:"script_tried,omitempty"`
	LogFile     string   `json:"log_file,omitempty"`
	LogExcerpt  string   `json:"log_excerpt,omitempty"`
	Output      string   `json:"output,omitempty"`
	Error       string   `json:"error,omitempty"`
}

func handleServicesList(w http.ResponseWriter, r *http.Request) {
	services, err := listServices()
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]ServiceInfo{"services": services})
}

func handleServiceAction(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	action := r.PathValue("action")

	var err error
	switch action {
	case "start":
		err = startService(name)
	case "stop":
		err = stopService(name)
	case "restart":
		err = restartService(name)
	case "enable":
		err = enableService(name)
	case "disable":
		err = disableService(name)
	case "update-subscription":
		result := updateServiceSubscription(name)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
		return
	default:
		http.Error(w, `{"error":"invalid action"}`, http.StatusBadRequest)
		return
	}

	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}

func listServices() ([]ServiceInfo, error) {
	switch runtime.GOOS {
	case "linux":
		return listServicesLinux()
	case "windows":
		return listServicesWindows()
	default:
		return []ServiceInfo{}, nil
	}
}

func listServicesLinux() ([]ServiceInfo, error) {
	// Try systemd first
	if hasSystemctl() {
		return listServicesSystemd()
	}
	// Try OpenWrt procd
	if hasProcd() {
		return listServicesProcd()
	}
	// Try sysvinit
	return listServicesSysvinit()
}

func hasSystemctl() bool {
	_, err := exec.LookPath("systemctl")
	return err == nil
}

func hasProcd() bool {
	_, err := exec.LookPath("ubus")
	return err == nil
}

func listServicesSystemd() ([]ServiceInfo, error) {
	cmd := exec.Command("systemctl", "list-units", "--type=service", "--all", "--no-pager", "--no-legend")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var services []ServiceInfo
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}

		name := strings.TrimSuffix(fields[0], ".service")
		load := fields[1]
		active := fields[2]

		if load != "loaded" {
			continue
		}

		status := "stopped"
		if active == "active" || active == "running" {
			status = "running"
		}

		// Check if enabled
		isEnabled := false
		if enabledOut, err := exec.Command("systemctl", "is-enabled", name).Output(); err == nil {
			enabledStr := strings.TrimSpace(string(enabledOut))
			isEnabled = enabledStr == "enabled" || enabledStr == "static"
		}

		services = append(services, ServiceInfo{
			Name:        name,
			DisplayName: name,
			Status:      status,
			Enabled:     isEnabled,
		})
	}
	return services, nil
}

func listServicesProcd() ([]ServiceInfo, error) {
	cmd := exec.Command("ls", "/etc/init.d/")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	// OpenWrt procd 真实运行态以 ubus service list 为准
	type ubusInstance struct {
		Running bool `json:"running"`
	}
	type ubusService struct {
		Instances map[string]ubusInstance `json:"instances"`
	}
	ubusRunning := map[string]bool{}
	if ubusOut, ubusErr := exec.Command("ubus", "call", "service", "list").Output(); ubusErr == nil {
		var all map[string]ubusService
		if jsonErr := json.Unmarshal(ubusOut, &all); jsonErr == nil {
			for svc, detail := range all {
				running := false
				for _, inst := range detail.Instances {
					if inst.Running {
						running = true
						break
					}
				}
				ubusRunning[svc] = running
			}
		}
	}
	psLower := ""
	if psOut, psErr := exec.Command("ps", "w").Output(); psErr == nil {
		psLower = strings.ToLower(string(psOut))
	}

	var services []ServiceInfo
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		name := strings.TrimSpace(line)
		if name == "" || name == "rcS" || name == "rcK" || strings.HasPrefix(name, ".") {
			continue
		}

		// 优先用 ubus 状态；无数据时再回退 init.d status
		status := "unknown"
		if running, ok := ubusRunning[name]; ok {
			if running {
				status = "running"
			} else {
				status = "stopped"
			}
		} else if statusOut, err := exec.Command("/etc/init.d/"+name, "status").Output(); err == nil {
			statusStr := strings.ToLower(string(statusOut))
			if strings.Contains(statusStr, "running") {
				status = "running"
			} else if strings.Contains(statusStr, "stopped") || strings.Contains(statusStr, "inactive") {
				status = "stopped"
			}
		}
		// 一些脚本服务不暴露 procd instances，且 status 不返回 running，兜底按进程名判定
		if status == "unknown" && psLower != "" {
			if strings.Contains(psLower, strings.ToLower(name)) {
				status = "running"
			}
		}

		// Check if enabled (symlink S*… in /etc/rc.d/；不用 shell，避免通配符不展开)
		isEnabled := false
		if matches, err := filepath.Glob("/etc/rc.d/S*" + name + "*"); err == nil && len(matches) > 0 {
			isEnabled = true
		}

		services = append(services, ServiceInfo{
			Name:        name,
			DisplayName: name,
			Status:      status,
			Enabled:     isEnabled,
		})
	}
	return services, nil
}

func listServicesSysvinit() ([]ServiceInfo, error) {
	cmd := exec.Command("service", "--status-all")
	output, err := cmd.Output()
	if err != nil {
		// Try alternate method
		cmd = exec.Command("ls", "/etc/init.d/")
		output, err = cmd.Output()
		if err != nil {
			return nil, err
		}
	}

	var services []ServiceInfo
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// Simple parsing for sysvinit
		var name string
		var status string = "unknown"

		if strings.Contains(line, "[ + ]") {
			status = "running"
			parts := strings.Fields(line)
			if len(parts) > 3 {
				name = parts[3]
			}
		} else if strings.Contains(line, "[ - ]") {
			status = "stopped"
			parts := strings.Fields(line)
			if len(parts) > 3 {
				name = parts[3]
			}
		} else {
			name = line
		}

		if name == "" || strings.HasPrefix(name, ".") {
			continue
		}

		services = append(services, ServiceInfo{
			Name:        name,
			DisplayName: name,
			Status:      status,
			Enabled:     false,
		})
	}
	return services, nil
}

// decodeWindowsConsoleGBK 将控制台默认代码页（简体中文多为 GBK）输出转为 UTF-8。
// 注意：部分 GBK 字节序列会被 utf8.Valid 误判为合法 UTF-8，不能先判 UTF-8 再决定是否解码。
func decodeWindowsConsoleGBK(raw []byte) string {
	if runtime.GOOS != "windows" {
		return string(raw)
	}
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
	out, _, err := transform.Bytes(simplifiedchinese.GBK.NewDecoder(), raw)
	if err != nil {
		return string(raw)
	}
	return string(out)
}

// recoverUTF8MisreadAsLatin1 修复「UTF-8 字节被按 Latin-1/单字节读成多个字符」的乱码（如 å¥½å → 好压）。
// 仅当还原后出现汉字且原串无汉字时才替换，避免误伤合法西欧字符。
func recoverUTF8MisreadAsLatin1(s string) string {
	if s == "" {
		return s
	}
	b := make([]byte, 0, len(s))
	for _, r := range s {
		if r > 0xFF {
			return s
		}
		b = append(b, byte(r))
	}
	if !utf8.Valid(b) {
		return s
	}
	out := string(b)
	hasHan := false
	for _, r := range out {
		if unicode.Is(unicode.Han, r) {
			hasHan = true
			break
		}
	}
	if !hasHan {
		return s
	}
	for _, r := range s {
		if unicode.Is(unicode.Han, r) {
			return s
		}
	}
	return out
}

func listServicesWindows() ([]ServiceInfo, error) {
	// 先 chcp 65001 再 sc，管道里才是 UTF-8；直接 exec sc 常为 GBK，且整段可能被误判为 utf8.Valid
	u8out, _ := exec.Command("cmd", "/C", "chcp 65001 >nul && sc query type= service state= all").Output()
	u8out = bytes.TrimPrefix(u8out, []byte{0xEF, 0xBB, 0xBF})
	var text string
	if len(bytes.TrimSpace(u8out)) > 200 {
		text = string(u8out)
	} else {
		out2, err2 := exec.Command("sc", "query", "type=", "service", "state=", "all").Output()
		if err2 != nil {
			return nil, err2
		}
		text = decodeWindowsConsoleGBK(bytes.TrimPrefix(out2, []byte{0xEF, 0xBB, 0xBF}))
	}

	var services []ServiceInfo
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	var current ServiceInfo
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "SERVICE_NAME:") {
			if current.Name != "" {
				services = append(services, current)
			}
			current = ServiceInfo{
				Name:   strings.TrimSpace(line[len("SERVICE_NAME:"):]),
				Status: "unknown",
			}
		} else if strings.HasPrefix(line, "DISPLAY_NAME:") {
			current.DisplayName = recoverUTF8MisreadAsLatin1(strings.TrimSpace(line[len("DISPLAY_NAME:"):]))
		} else if strings.HasPrefix(line, "STATE") {
			if strings.Contains(line, "RUNNING") {
				current.Status = "running"
			} else if strings.Contains(line, "STOPPED") {
				current.Status = "stopped"
			}
		}
	}
	if current.Name != "" {
		services = append(services, current)
	}
	return services, nil
}

func startService(name string) error {
	switch runtime.GOOS {
	case "linux":
		if hasSystemctl() {
			return exec.Command("systemctl", "start", name).Run()
		} else if hasProcd() {
			return exec.Command("/etc/init.d/"+name, "start").Run()
		}
		return exec.Command("service", name, "start").Run()
	case "windows":
		return exec.Command("net", "start", name).Run()
	default:
		return nil
	}
}

func stopService(name string) error {
	switch runtime.GOOS {
	case "linux":
		if hasSystemctl() {
			return exec.Command("systemctl", "stop", name).Run()
		} else if hasProcd() {
			return exec.Command("/etc/init.d/"+name, "stop").Run()
		}
		return exec.Command("service", name, "stop").Run()
	case "windows":
		return exec.Command("net", "stop", name).Run()
	default:
		return nil
	}
}

func restartService(name string) error {
	switch runtime.GOOS {
	case "linux":
		if hasSystemctl() {
			return exec.Command("systemctl", "restart", name).Run()
		} else if hasProcd() {
			return exec.Command("/etc/init.d/"+name, "restart").Run()
		}
		return exec.Command("service", name, "restart").Run()
	case "windows":
		stopService(name)
		return startService(name)
	default:
		return nil
	}
}

func enableService(name string) error {
	switch runtime.GOOS {
	case "linux":
		if hasSystemctl() {
			return exec.Command("systemctl", "enable", name).Run()
		} else if hasProcd() {
			return exec.Command("/etc/init.d/"+name, "enable").Run()
		}
		return exec.Command("update-rc.d", name, "defaults").Run()
	case "windows":
		return exec.Command("sc", "config", name, "start=", "auto").Run()
	default:
		return nil
	}
}

func disableService(name string) error {
	switch runtime.GOOS {
	case "linux":
		if hasSystemctl() {
			return exec.Command("systemctl", "disable", name).Run()
		} else if hasProcd() {
			return exec.Command("/etc/init.d/"+name, "disable").Run()
		}
		return exec.Command("update-rc.d", name, "remove").Run()
	case "windows":
		return exec.Command("sc", "config", name, "start=", "disabled").Run()
	default:
		return nil
	}
}

func updateServiceSubscription(name string) subscriptionUpdateResult {
	result := subscriptionUpdateResult{
		Service: name,
		Success: false,
		Status:  "failed",
	}
	if runtime.GOOS != "linux" {
		result.Error = "update-subscription only supported on linux/openwrt"
		return result
	}

	runLua := func(script string) (string, error) {
		out, err := exec.Command("lua", script).CombinedOutput()
		output := strings.TrimSpace(string(out))
		if err != nil {
			return output, fmt.Errorf("%s: %w", script, err)
		}
		return output, nil
	}

	inferStatus := func(output string, runErr error) string {
		lower := strings.ToLower(output)
		if runErr == nil {
			if strings.Contains(lower, "订阅更新成功") || strings.Contains(lower, "update success") {
				return "success"
			}
			return "success"
		}
		if strings.Contains(lower, "成功") {
			return "partial"
		}
		return "failed"
	}

	logFileByService := func(svc string) string {
		switch svc {
		case "passwall":
			return "/tmp/log/passwall.log"
		case "passwall2":
			return "/tmp/log/passwall2.log"
		case "shadowsocksr":
			return "/tmp/log/ssrplus.log"
		default:
			return ""
		}
	}

	tailLines := func(content string, n int) string {
		lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
		// 去掉尾部空行，避免展示空白
		for len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "" {
			lines = lines[:len(lines)-1]
		}
		if len(lines) > n {
			lines = lines[len(lines)-n:]
		}
		return strings.Join(lines, "\n")
	}

	readLogTail := func(path string) string {
		if path == "" {
			return ""
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return ""
		}
		return tailLines(string(b), 60)
	}

	switch name {
	case "passwall":
		script := "/usr/share/passwall/subscribe.lua"
		result.Script = script
		result.ScriptTried = []string{script}
		result.LogFile = logFileByService(name)
		out, err := runLua(script)
		result.Output = out
		result.LogExcerpt = readLogTail(result.LogFile)
		result.Status = inferStatus(out, err)
		result.Success = err == nil
		if err != nil {
			result.Error = err.Error()
		}
		return result
	case "passwall2":
		script := "/usr/share/passwall2/subscribe.lua"
		result.Script = script
		result.ScriptTried = []string{script}
		result.LogFile = logFileByService(name)
		out, err := runLua(script)
		result.Output = out
		result.LogExcerpt = readLogTail(result.LogFile)
		result.Status = inferStatus(out, err)
		result.Success = err == nil
		if err != nil {
			result.Error = err.Error()
		}
		return result
	case "shadowsocksr":
		primary := "/usr/share/shadowsocksr/subscribe.lua"
		secondary := "/usr/share/shadowsocksr/update.lua"
		result.ScriptTried = []string{primary}
		result.LogFile = logFileByService(name)
		out1, err1 := runLua(primary)
		if err1 == nil {
			result.Script = primary
			result.Output = out1
			result.LogExcerpt = readLogTail(result.LogFile)
			result.Status = inferStatus(out1, nil)
			result.Success = true
			return result
		}
		result.ScriptTried = append(result.ScriptTried, secondary)
		out2, err2 := runLua(secondary)
		result.Script = secondary
		if strings.TrimSpace(out2) != "" {
			result.Output = strings.TrimSpace(out1 + "\n---- fallback ----\n" + out2)
		} else {
			result.Output = out1
		}
		result.LogExcerpt = readLogTail(result.LogFile)
		result.Status = inferStatus(result.Output, err2)
		result.Success = err2 == nil
		if err2 != nil {
			result.Error = err2.Error()
		}
		return result
	default:
		result.Error = fmt.Sprintf("service %s does not support subscription update", name)
		return result
	}
}
