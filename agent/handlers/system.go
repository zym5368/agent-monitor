package handlers

import (
	"encoding/json"
	"net/http"

	"cluster-agent/system"
)

func handleSystemInfo(w http.ResponseWriter, r *http.Request) {
	info, err := system.GetInfo()
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}
