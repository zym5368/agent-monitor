//go:build linux

package metrics

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// getCPUTemperatureC 从 thermal_zone 或 hwmon 读取温度（摄氏度）；不可用时返回 0, false。
func getCPUTemperatureC() (float64, bool) {
	// 先试 thermal_zone
	zones, _ := filepath.Glob("/sys/class/thermal/thermal_zone*/temp")
	for _, p := range zones {
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		v, err := strconv.ParseInt(strings.TrimSpace(string(b)), 10, 64)
		if err != nil || v <= 0 {
			continue
		}
		// 毫摄氏度
		return float64(v) / 1000.0, true
	}
	// 再试 hwmon
	inputs, _ := filepath.Glob("/sys/class/hwmon/hwmon*/temp*_input")
	for _, p := range inputs {
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		v, err := strconv.ParseInt(strings.TrimSpace(string(b)), 10, 64)
		if err != nil || v <= 0 {
			continue
		}
		return float64(v) / 1000.0, true
	}
	return 0, false
}
