; Custom init - kill app processes BEFORE default process check runs
!macro customInit
  DetailPrint "Stopping application processes..."

  ; Kill cmagent.exe
  nsExec::ExecToLog 'cmd.exe /c taskkill /F /T /IM "cmagent.exe"'
  Pop $0

  ; Kill cluster-manager.exe (old version)
  nsExec::ExecToLog 'cmd.exe /c taskkill /F /T /IM "cluster-manager.exe"'
  Pop $0

  ; Kill electron.exe
  nsExec::ExecToLog 'cmd.exe /c taskkill /F /T /IM "electron.exe"'
  Pop $0

  Sleep 2000
!macroend

; Skip default process check - we already handled it in customInit
!macro customCheckAppRunning
  ; Do nothing - processes already killed in customInit
  DetailPrint "Process check: skipped (handled in customInit)"
!macroend
