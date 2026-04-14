//go:build !windows && !linux

package metrics

// getCPUTemperatureC 非 Windows/Linux 暂不采集温度。
func getCPUTemperatureC() (float64, bool) {
	return 0, false
}
