package handlers

import (
	"encoding/json"
	"net/http"
)

// MetricsResponse 与前端约定一致。
type MetricsResponse struct {
	CPUPercent      float64       `json:"cpu_percent"`
	CPUTemperatureC *float64     `json:"cpu_temperature_c,omitempty"`
	MemoryUsed      uint64        `json:"memory_used_bytes"`
	MemoryTotal     uint64        `json:"memory_total_bytes"`
	MemoryPercent   float64       `json:"memory_percent"`
	DiskUsed        uint64        `json:"disk_used_bytes"`
	DiskTotal       uint64        `json:"disk_total_bytes"`
	DiskPercent     float64       `json:"disk_percent"`
	DiskMounts      []DiskMountResponse `json:"disk_mounts,omitempty"`
	GPU             *GPUResponse `json:"gpu,omitempty"`
}

type DiskMountResponse struct {
	Path        string  `json:"path"`
	UsedBytes   uint64  `json:"used_bytes"`
	TotalBytes  uint64  `json:"total_bytes"`
	UsedPercent float64 `json:"used_percent"`
}

// GPUResponse 与前端约定一致。
type GPUResponse struct {
	UtilizationPercent float64 `json:"utilization_percent"`
	MemoryUsedBytes    uint64 `json:"memory_used_bytes"`
	MemoryTotalBytes   uint64 `json:"memory_total_bytes"`
	TemperatureC       float64 `json:"temperature_c"`
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	if metricsCollector == nil {
		http.Error(w, `{"error":"metrics not configured"}`, http.StatusInternalServerError)
		return
	}
	data, err := metricsCollector.Collect()
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
