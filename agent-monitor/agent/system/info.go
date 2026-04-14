package system

import (
	"runtime"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

type Info struct {
	Hostname      string `json:"hostname"`
	OS            string `json:"os"`
	Platform      string `json:"platform"`
	PlatformFamily string `json:"platform_family"`
	KernelVersion string `json:"kernel_version"`
	Arch          string `json:"arch"`
	CPUModel      string `json:"cpu_model"`
	CPUCores      int    `json:"cpu_cores"`
	TotalMemory   uint64 `json:"total_memory_bytes"`
	Uptime        uint64 `json:"uptime_seconds"`
}

func GetInfo() (*Info, error) {
	hostInfo, err := host.Info()
	if err != nil {
		return nil, err
	}

	cpuInfo, err := cpu.Info()
	if err != nil {
		return nil, err
	}

	memInfo, err := mem.VirtualMemory()
	if err != nil {
		return nil, err
	}

	cpuModel := ""
	if len(cpuInfo) > 0 {
		cpuModel = cpuInfo[0].ModelName
	}

	cores, _ := cpu.Counts(true)

	return &Info{
		Hostname:       hostInfo.Hostname,
		OS:             runtime.GOOS,
		Platform:       hostInfo.Platform,
		PlatformFamily: hostInfo.PlatformFamily,
		KernelVersion:  hostInfo.KernelVersion,
		Arch:           runtime.GOARCH,
		CPUModel:       cpuModel,
		CPUCores:       cores,
		TotalMemory:    memInfo.Total,
		Uptime:         hostInfo.Uptime,
	}, nil
}
