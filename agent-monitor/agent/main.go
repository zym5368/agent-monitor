package main

import (
	"cluster-agent/alerts"
	"context"
	"cluster-agent/docker"
	"cluster-agent/handlers"
	"cluster-agent/metrics"
	"log"
	"net/http"
	"os"
)

// metricsAdapter 适配器，让 metrics.Collector 实现 handlers.MetricsCollector 接口
type metricsAdapter struct {
	c *metrics.Collector
}

func (a *metricsAdapter) Collect() (*handlers.MetricsResponse, error) {
	snap, err := a.c.Collect()
	if err != nil {
		return nil, err
	}
	// 转换类型
	out := &handlers.MetricsResponse{
		CPUPercent:      snap.CPUPercent,
		CPUTemperatureC: snap.CPUTemperatureC,
		MemoryUsed:      snap.MemoryUsed,
		MemoryTotal:     snap.MemoryTotal,
		MemoryPercent:   snap.MemoryPercent,
		DiskUsed:        snap.DiskUsed,
		DiskTotal:       snap.DiskTotal,
		DiskPercent:     snap.DiskPercent,
	}
	if len(snap.DiskMounts) > 0 {
		out.DiskMounts = make([]handlers.DiskMountResponse, 0, len(snap.DiskMounts))
		for _, m := range snap.DiskMounts {
			out.DiskMounts = append(out.DiskMounts, handlers.DiskMountResponse{
				Path:        m.Path,
				UsedBytes:   m.UsedBytes,
				TotalBytes:  m.TotalBytes,
				UsedPercent: m.UsedPercent,
			})
		}
	}
	if snap.GPU != nil {
		out.GPU = &handlers.GPUResponse{
			UtilizationPercent: snap.GPU.UtilizationPercent,
			MemoryUsedBytes:    snap.GPU.MemoryUsedBytes,
			MemoryTotalBytes:   snap.GPU.MemoryTotalBytes,
			TemperatureC:       snap.GPU.TemperatureC,
		}
	}
	return out, nil
}

// alertsMetricsAdapter 适配器，让 metrics.Collector 实现 alerts.MetricsCollector 接口
type alertsMetricsAdapter struct {
	c *metrics.Collector
}

func (a *alertsMetricsAdapter) Collect() (*alerts.MetricsSnapshot, error) {
	snap, err := a.c.Collect()
	if err != nil {
		return nil, err
	}
	// 转换类型
	out := &alerts.MetricsSnapshot{
		CPUPercent:      snap.CPUPercent,
		CPUTemperatureC: snap.CPUTemperatureC,
		MemoryUsed:      snap.MemoryUsed,
		MemoryTotal:     snap.MemoryTotal,
		MemoryPercent:   snap.MemoryPercent,
		DiskUsed:        snap.DiskUsed,
		DiskTotal:       snap.DiskTotal,
		DiskPercent:     snap.DiskPercent,
	}
	if snap.GPU != nil {
		out.GPU = &alerts.GPUSnapshot{
			UtilizationPercent: snap.GPU.UtilizationPercent,
			MemoryUsedBytes:    snap.GPU.MemoryUsedBytes,
			MemoryTotalBytes:   snap.GPU.MemoryTotalBytes,
			TemperatureC:       snap.GPU.TemperatureC,
		}
	}
	return out, nil
}

func main() {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":9100"
	}

	apiKey := os.Getenv("API_KEY")
	log.Printf("cluster-agent listening on %s (API_KEY set: %v)", addr, apiKey != "")

	// Initialize metrics collector with adapter
	mc := metrics.NewCollector()
	handlers.SetMetricsCollector(&metricsAdapter{c: mc})

	// Initialize and start alert engine
	alertEngine := alerts.NewEngine("", &alertsMetricsAdapter{c: mc})
	if err := alertEngine.Start(); err != nil {
		log.Fatalf("Failed to start alert engine: %v", err)
	}
	defer alertEngine.Stop()
	alerts.SetEngine(alertEngine)

	// Initialize Docker client
	dc, err := docker.New(context.Background())
	if err != nil {
		log.Printf("Warning: Docker not available: %v", err)
	} else {
		handlers.SetDockerClient(dc)
	}

	mux := http.NewServeMux()

	// Health check endpoint (no auth required)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API endpoints with optional API key auth
	apiHandler := handlers.Router()
	apiHandler = handlers.RequireAPIKey(apiKey, apiHandler)

	// Wrap API handler with CORS
	corsApiHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		apiHandler.ServeHTTP(w, r)
	})

	mux.Handle("/api/", http.StripPrefix("/api", corsApiHandler))

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
