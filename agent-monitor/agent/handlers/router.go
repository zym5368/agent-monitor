package handlers

import (
	"cluster-agent/alerts"
	"net/http"
)

var metricsCollector MetricsCollector

type MetricsCollector interface {
	Collect() (*MetricsResponse, error)
}

func SetMetricsCollector(c MetricsCollector) {
	metricsCollector = c
}

func Router() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /metrics", handleMetrics)
	mux.HandleFunc("GET /containers", handleContainersList)
	mux.HandleFunc("GET /docker/overview", handleDockerOverview)
	mux.HandleFunc("GET /images", handleImagesList)
	mux.HandleFunc("DELETE /images", handleImageRemove)
	mux.HandleFunc("POST /containers/{id}/start", handleContainerAction)
	mux.HandleFunc("POST /containers/{id}/stop", handleContainerAction)
	mux.HandleFunc("POST /containers/{id}/restart", handleContainerAction)
	mux.HandleFunc("GET /containers/{id}/logs", handleContainerAction)
	mux.HandleFunc("DELETE /containers/{id}", handleContainerRemove)
	mux.HandleFunc("GET /system/info", handleSystemInfo)
	mux.HandleFunc("GET /services", handleServicesList)
	mux.HandleFunc("POST /services/{name}/{action}", handleServiceAction)

	// Register alerts routes
	alerts.RegisterRoutes(mux)

	return mux
}
