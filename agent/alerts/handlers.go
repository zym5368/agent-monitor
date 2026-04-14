package alerts

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
)

var (
	globalEngine *Engine
	engineMu     sync.RWMutex
)

// SetEngine 设置全局告警引擎
func SetEngine(e *Engine) {
	engineMu.Lock()
	globalEngine = e
	engineMu.Unlock()
}

func getEngine() *Engine {
	engineMu.RLock()
	defer engineMu.RUnlock()
	return globalEngine
}

// RegisterRoutes 注册告警 API 路由
func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("PUT /alerts/sync", handleSyncAlerts)
	mux.HandleFunc("GET /alerts/rules", handleGetRules)
	mux.HandleFunc("GET /alerts/active", handleGetActiveAlerts)
	mux.HandleFunc("POST /alerts/{id}/acknowledge", handleAcknowledgeAlert)
}

// handleSyncAlerts PUT /alerts/sync - 同步规则和渠道
func handleSyncAlerts(w http.ResponseWriter, r *http.Request) {
	engine := getEngine()
	if engine == nil {
		http.Error(w, `{"error":"alert engine not configured"}`, http.StatusInternalServerError)
		return
	}

	var req SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if err := engine.Sync(req.Rules, req.Channels); err != nil {
		http.Error(w, `{"error":"`+escapeJSON(err.Error())+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"success":true}`))
}

// handleGetRules GET /alerts/rules - 获取当前规则和渠道
func handleGetRules(w http.ResponseWriter, r *http.Request) {
	engine := getEngine()
	if engine == nil {
		http.Error(w, `{"error":"alert engine not configured"}`, http.StatusInternalServerError)
		return
	}

	resp := RulesResponse{
		Rules:    engine.GetRules(),
		Channels: engine.GetChannels(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// handleGetActiveAlerts GET /alerts/active - 获取活跃告警
func handleGetActiveAlerts(w http.ResponseWriter, r *http.Request) {
	engine := getEngine()
	if engine == nil {
		http.Error(w, `{"error":"alert engine not configured"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(engine.GetActiveAlerts())
}

// handleAcknowledgeAlert POST /alerts/{id}/acknowledge - 确认告警
func handleAcknowledgeAlert(w http.ResponseWriter, r *http.Request) {
	engine := getEngine()
	if engine == nil {
		http.Error(w, `{"error":"alert engine not configured"}`, http.StatusInternalServerError)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"missing alert id"}`, http.StatusBadRequest)
		return
	}

	if err := engine.AcknowledgeAlert(id); err != nil {
		http.Error(w, `{"error":"`+escapeJSON(err.Error())+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"success":true}`))
}

func escapeJSON(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\r", "\\r")
	s = strings.ReplaceAll(s, "\t", "\\t")
	return s
}
