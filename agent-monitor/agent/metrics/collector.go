package metrics

import (
	"fmt"
	"os"
	"strings"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
)

// Collector 使用 gopsutil 采集 CPU、内存、磁盘。
type Collector struct{}

func NewCollector() *Collector {
	return &Collector{}
}

// Snapshot 与 handlers.MetricsResponse 字段一致。
type Snapshot struct {
	CPUPercent      float64
	CPUTemperatureC *float64   // 可选，有则填
	MemoryUsed      uint64
	MemoryTotal     uint64
	MemoryPercent   float64
	DiskUsed        uint64
	DiskTotal       uint64
	DiskPercent     float64
	DiskMounts      []DiskMount
	GPU             *GPUSnapshot // 可选，检测到 GPU 则填
}

type DiskMount struct {
	Path        string
	UsedBytes   uint64
	TotalBytes  uint64
	UsedPercent float64
}

// Collect 返回当前快照。
func (c *Collector) Collect() (*Snapshot, error) {
	out := &Snapshot{}

	// CPU 使用率（0-100）
	percents, err := cpu.Percent(0, false)
	if err != nil {
		return nil, fmt.Errorf("cpu: %w", err)
	}
	if len(percents) > 0 {
		out.CPUPercent = percents[0]
	}

	// CPU 温度（可选）
	if t, ok := getCPUTemperatureC(); ok {
		out.CPUTemperatureC = &t
	}

	// GPU（可选，nvidia-smi）
	out.GPU = getGPU()

	// 内存
	vm, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("mem: %w", err)
	}
	out.MemoryUsed = vm.Used
	out.MemoryTotal = vm.Total
	out.MemoryPercent = vm.UsedPercent

	// 磁盘：
	// - 默认维持历史行为（"/"，失败回退 "C:"）
	// - 若设置 DISK_PATHS（逗号分隔），则按挂载点分别采集并聚合
	diskPaths := parseDiskPaths(os.Getenv("DISK_PATHS"))
	if len(diskPaths) > 0 {
		var totalUsed uint64
		var totalSize uint64
		mounts := make([]DiskMount, 0, len(diskPaths))
		for _, p := range diskPaths {
			stat, statErr := disk.Usage(p)
			if statErr != nil {
				continue
			}
			mounts = append(mounts, DiskMount{
				Path:        p,
				UsedBytes:   stat.Used,
				TotalBytes:  stat.Total,
				UsedPercent: stat.UsedPercent,
			})
			totalUsed += stat.Used
			totalSize += stat.Total
		}
		if len(mounts) == 0 {
			return nil, fmt.Errorf("disk: no valid path from DISK_PATHS")
		}
		out.DiskMounts = mounts
		out.DiskUsed = totalUsed
		out.DiskTotal = totalSize
		if totalSize > 0 {
			out.DiskPercent = float64(totalUsed) * 100.0 / float64(totalSize)
		}
	} else {
		stat, err := disk.Usage("/")
		if err != nil {
			// Windows 上可能用 "C:"
			stat, err = disk.Usage("C:")
		}
		if err != nil {
			return nil, fmt.Errorf("disk: %w", err)
		}
		out.DiskUsed = stat.Used
		out.DiskTotal = stat.Total
		out.DiskPercent = stat.UsedPercent
	}

	return out, nil
}

func parseDiskPaths(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	seen := map[string]struct{}{}
	paths := make([]string, 0, len(parts))
	for _, part := range parts {
		p := strings.TrimSpace(part)
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		paths = append(paths, p)
	}
	return paths
}

