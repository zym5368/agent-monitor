!macro customInit
  ; Best effort: close running app instances before files are replaced.
  ; Ignore failures when process does not exist.
  nsExec::ExecToLog 'taskkill /F /T /IM "集群管理.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM "cluster-manager.exe"'
  Pop $0
  Sleep 800
!macroend
