package handlers

import (
	"net/http"
)

// RequireAPIKey 校验请求头 X-API-Key，不通过则 401。
func RequireAPIKey(apiKey string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if apiKey == "" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("X-API-Key")
		if key != apiKey {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"invalid or missing X-API-Key"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}
