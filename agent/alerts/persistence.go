package alerts

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// DefaultStateDir 默认状态目录
const DefaultStateDir = "./data"
const stateFileName = "alerts_state.json"

// LoadState 从文件加载状态
func LoadState(stateDir string) (AlertState, error) {
	var state AlertState

	statePath := filepath.Join(stateDir, stateFileName)

	// 检查文件是否存在
	if _, err := os.Stat(statePath); os.IsNotExist(err) {
		// 返回空状态
		return AlertState{
			Rules:       []AlertRule{},
			Channels:    []NotificationChannel{},
			ActiveAlerts: []ActiveAlert{},
		}, nil
	}

	data, err := os.ReadFile(statePath)
	if err != nil {
		return state, err
	}

	err = json.Unmarshal(data, &state)
	if err != nil {
		return state, err
	}

	// 确保切片不为 nil
	if state.Rules == nil {
		state.Rules = []AlertRule{}
	}
	if state.Channels == nil {
		state.Channels = []NotificationChannel{}
	}
	if state.ActiveAlerts == nil {
		state.ActiveAlerts = []ActiveAlert{}
	}

	return state, nil
}

// SaveState 保存状态到文件
func SaveState(stateDir string, state AlertState) error {
	// 确保目录存在
	err := os.MkdirAll(stateDir, 0755)
	if err != nil {
		return err
	}

	statePath := filepath.Join(stateDir, stateFileName)

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(statePath, data, 0644)
}
