!macro customInit
  ; Best effort: close running app/installer instances before files are replaced.
  ; 1) Direct known image names (ASCII variants)
  nsExec::ExecToLog 'taskkill /F /T /IM "cluster-manager.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM "electron.exe"'
  Pop $0

  ; 2) Path-based kill for the installed app dir.
  ; This avoids codepage issues when process image name is Chinese.
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -like ''*\\Programs\\cluster-manager\\*.exe'' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"'
  Pop $0

  ; 3) Prefix-based kill for setup leftovers (e.g. cluster-manager-setup-win-*.exe).
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $$_.ProcessName -like ''cluster-manager*'' } | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Pop $0

  ; 4) Give processes a brief moment to exit.
  Sleep 800
!macroend
