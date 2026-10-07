; Test harness for installer.nsh (compiled and run by build/verify-installer.mjs, never shipped).
; It runs the SAME macros the real uninstaller / installer run, against the folder in %HARNESS_DIR%.
; Switches (command line): --updated (what an update passes to the old uninstaller), --delete-app-data,
; --install (runs customInstall instead of the uninstall steps).
Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "${HARNESS_OUT}"

!include LogicLib.nsh
!include FileFunc.nsh
!insertmacro GetParameters
!insertmacro GetOptions

Var updated
!macro _isUpdated _a _b _t _f
  StrCmp $updated "1" `${_t}` `${_f}`
!macroend
!define isUpdated `"" isUpdated ""`

!include "installer.nsh"

Section
  ReadEnvStr $INSTDIR HARNESS_DIR
  StrCpy $updated "0"
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--updated" $R1
  ${IfNot} ${Errors}
    StrCpy $updated "1"
  ${EndIf}
  ClearErrors
  ${GetOptions} $R0 "--install" $R1
  ${If} ${Errors}
    !insertmacro customRemoveFiles
  ${Else}
    !insertmacro customInstall
  ${EndIf}
SectionEnd
