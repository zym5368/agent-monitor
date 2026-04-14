package metrics

import (
	"context"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// GPUSnapshot 单卡 GPU 信息（多卡时取第一块）。
type GPUSnapshot struct {
	UtilizationPercent float64
	MemoryUsedBytes    uint64
	MemoryTotalBytes   uint64
	TemperatureC       float64
}

// getGPU 通过 nvidia-smi 获取 GPU 占用、显存、温度；无 NVIDIA 或命令失败返回 nil。
func getGPU() *GPUSnapshot {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// utilization.gpu %, memory.used MiB, memory.total MiB, temperature.gpu
	cmd := exec.CommandContext(ctx, "nvidia-smi",
		"--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu",
		"--format=csv,noheader,nounits")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	line := strings.TrimSpace(string(out))
	if line == "" {
		return nil
	}
	// 多卡取第一行
	if idx := strings.Index(line, "\n"); idx > 0 {
		line = line[:idx]
	}
	parts := strings.Split(line, ", ")
	if len(parts) < 4 {
		return nil
	}
	trim := func(s string) string { return strings.TrimSpace(strings.TrimSuffix(s, " %")) }
	utilPct, _ := strconv.ParseFloat(trim(parts[0]), 64)
	memUsedMiB, _ := strconv.ParseUint(trim(parts[1]), 10, 64)
	memTotalMiB, _ := strconv.ParseUint(trim(parts[2]), 10, 64)
	tempC, _ := strconv.ParseFloat(trim(parts[3]), 64)
	return &GPUSnapshot{
		UtilizationPercent: utilPct,
		MemoryUsedBytes:    memUsedMiB * 1024 * 1024,
		MemoryTotalBytes:   memTotalMiB * 1024 * 1024,
		TemperatureC:       tempC,
	}
}
