; Slide Planner installer additions (electron-builder `nsis.include`).
;
; The app keeps ALL of the teacher's data (lessons, styles, assets, settings, keys) in <install folder>\data.
; electron-builder's stock uninstaller runs `RMDir /r $INSTDIR`, and an update runs the OLD version's uninstaller
; first, so without this file both an uninstall and every update would delete her work.
;
;   update            (uninstaller started with --updated)  data is NEVER touched
;   silent uninstall  (/S)                                  data is kept
;   normal uninstall                                        asks "Keep your lessons and settings?", default Yes
;   --delete-app-data (explicit command line flag)          data is removed, as the flag says
;
; The old uninstaller of an installed version is what runs on an update, so this protects updates FROM the first
; version built with this file onwards.

!include LogicLib.nsh
!include FileFunc.nsh

; Removes everything in $INSTDIR except the "data" folder. Runs inside the uninstall section.
!macro keepDataRemoveInstallFiles
  Push $R0
  Push $R1
  ; Move out of $INSTDIR so it can be removed.
  SetOutPath $TEMP
  FindFirst $R0 $R1 "$INSTDIR\*.*"
  ${DoWhile} $R1 != ""
    ${If} $R1 != "."
    ${AndIf} $R1 != ".."
    ${AndIf} $R1 != "data"
      ${If} ${FileExists} "$INSTDIR\$R1\*.*"
        RMDir /r "$INSTDIR\$R1"
      ${Else}
        Delete "$INSTDIR\$R1"
      ${EndIf}
    ${EndIf}
    FindNext $R0 $R1
  ${Loop}
  FindClose $R0
  Pop $R1
  Pop $R0
!macroend

; Leaves "delete" or "keep" on the stack. Only a real uninstall (not an update) can answer "delete".
!macro keepDataDecide
  Push $R0
  Push $R1
  StrCpy $R0 "keep"
  ${IfNot} ${isUpdated}
    ClearErrors
    ${GetParameters} $R1
    ${GetOptions} $R1 "--delete-app-data" $R1
    ${IfNot} ${Errors}
      StrCpy $R0 "delete"
    ${Else}
      !ifdef KEEPDATA_TEST_ANSWER_NO
        StrCpy $R0 "delete"
      !else
        MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON1 \
          "Keep your lessons and settings? (recommended)$\r$\n$\r$\nYes keeps the folder $INSTDIR\data so they are still there if you install Slide Planner again.$\r$\nNo deletes them for good." \
          /SD IDYES IDYES +2
        StrCpy $R0 "delete"
      !endif
    ${EndIf}
  ${EndIf}
  Pop $R1
  Exch $R0
!macroend

; electron-builder replaces the stock file removal with this macro (instead of `RMDir /r $INSTDIR`).
!macro customRemoveFiles
  !insertmacro keepDataRemoveInstallFiles
  !insertmacro keepDataDecide
  Pop $R0
  ${If} $R0 == "delete"
    RMDir /r "$INSTDIR\data"
  ${EndIf}
  ; Removes the install folder only if it is empty now (it is not while the kept data folder is in it).
  RMDir "$INSTDIR"
!macroend

; After the files are installed: make sure the data folder exists and is writable by this user. A folder the
; user cannot write to (for example one under C:\Program Files) would make the app lose its data silently.
!macro customInstall
  CreateDirectory "$INSTDIR\data"
  ClearErrors
  FileOpen $R0 "$INSTDIR\data\.write-test" w
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONEXCLAMATION "Slide Planner cannot save your lessons in $INSTDIR because this folder is read-only for you.$\r$\nPlease run the installer again and choose a folder in your own user folder (the default)." /SD IDOK
  ${Else}
    FileClose $R0
    Delete "$INSTDIR\data\.write-test"
  ${EndIf}
!macroend

; Always a per-user install (%LOCALAPPDATA%\Programs\Slide Planner, writable without admin rights). Without this the
; "For all users" choice stays available to an administrator and would put the app, and its data folder, under
; C:\Program Files where the app cannot write. This skips the "who is this for" page in the installer and uninstaller.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
