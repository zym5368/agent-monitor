!macro customInit
  ; Best effort: close running app/installer instances before files are replaced.
  ; 1) Direct known image names
  nsExec::ExecToLog 'taskkill /F /T /IM "集群管理.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM "cluster-manager.exe"'
  Pop $0

  ; 2) Prefix-based kill for setup leftovers (e.g. cluster-manager-setup-win-*.exe)
  ; and possible renamed app executables.
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $$_.ProcessName -like ''cluster-manager*'' -or $$_.ProcessName -like ''集群管理*'' -or $$_.ProcessName -eq ''electron'' } | Stop-Process -Force"'
  Pop $0

  ; 3) Give processes a brief moment to exit.
  Sleep 800
!macroend
