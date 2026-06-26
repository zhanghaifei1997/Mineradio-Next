; Mineradio Installer Custom Script
; Place custom NSIS instructions here

; File association for .mp3 and other audio files
!macro customInstall
  ; Create start menu shortcut
  CreateDirectory "$SMPROGRAMS\Mineradio"
  CreateShortCut "$SMPROGRAMS\Mineradio\Mineradio.lnk" "$INSTDIR\Mineradio.exe" "" "$INSTDIR\resources\icon.ico" 0
  
  ; Desktop shortcut
  CreateShortCut "$DESKTOP\Mineradio.lnk" "$INSTDIR\Mineradio.exe" "" "$INSTDIR\resources\icon.ico" 0
!macroend

!macro customUnInstall
  ; Remove start menu shortcuts
  Delete "$SMPROGRAMS\Mineradio\Mineradio.lnk"
  RMDir "$SMPROGRAMS\Mineradio"
  
  ; Remove desktop shortcut
  Delete "$DESKTOP\Mineradio.lnk"
!macroend
