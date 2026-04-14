//go:build windows

package metrics

import (
	"context"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// getCPUTemperatureC 通过 wmic 查询 WMI 温度（摄氏度）；不可用时返回 0, false。
func getCPUTemperatureC() (float64, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	// CurrentTemperature 为十分之一开尔文
	cmd := exec.CommandContext(ctx, "wmic", "/namespace:\\\\root\\wmi", "path", "MSAcpi_ThermalZoneTemperature", "get", "CurrentTemperature", "/format:value")
	out, err := cmd.Output()
	if err != nil {
		return 0, false
	}
	// 输出形如: CurrentTemperature=3131
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "CurrentTemperature=") {
			s := strings.TrimPrefix(line, "CurrentTemperature=")
			s = strings.TrimSpace(s)
			v, err := strconv.ParseUint(s, 10, 32)
			if err != nil || v == 0 {
				return 0, false
			}
			return float64(v)/10.0 - 273.15, true
		}
	}
	return 0, false
}
