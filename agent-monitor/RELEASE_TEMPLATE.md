# Release Notes Template

> 使用方式：每次发布新版本时，复制下面模板并替换占位符。
>
> 一键发布（推荐）：
> `cd agent-monitor/agent`
> `.\releases\publish-release.ps1 -Tag "v0.1.x" -Change1 "..." -Change2 "..." -Change3 "..."`

---

## Cluster Manager v{{VERSION}}

### 更新内容
- {{CHANGE_1}}
- {{CHANGE_2}}
- {{CHANGE_3}}

### 安装方式
- **Windows 安装版**：下载 `cluster-manager-setup-win-x64.exe`
- **Windows 便携版**：下载 `cluster-manager-portable-win-x64.exe`
- **Android**：下载 `cluster-manager-android-release.apk`

### 附件列表
- `cluster-manager-setup-win-x64.exe`
- `cluster-manager-portable-win-x64.exe`
- `cluster-manager-android-release.apk`

### 已知问题
- {{KNOWN_ISSUE_1_OR_NONE}}

### 升级说明
- {{UPGRADE_NOTE_1}}
- {{UPGRADE_NOTE_2}}

---

<!-- EXAMPLE_START -->
## 示例（可直接参考）

### Cluster Manager v0.1.1

#### 更新内容
- 新增告警规则刷新视图，可从所有 Agent 拉取并查看规则/渠道。
- 磁盘挂载点名称统一显示为存储池标签（如“存储池1”“存储池3”）。
- 同步发布 Windows 桌面端与 Android APK。

#### 安装方式
- **Windows 安装版**：下载 `cluster-manager-setup-win-x64.exe`
- **Windows 便携版**：下载 `cluster-manager-portable-win-x64.exe`
- **Android**：下载 `cluster-manager-android-release.apk`

#### 附件列表
- `cluster-manager-setup-win-x64.exe`
- `cluster-manager-portable-win-x64.exe`
- `cluster-manager-android-release.apk`

#### 已知问题
- 暂无。

#### 升级说明
- Windows 安装版建议覆盖安装，首次启动可能触发系统安全提示。
- Android 安装前请先允许“未知来源应用安装”。
