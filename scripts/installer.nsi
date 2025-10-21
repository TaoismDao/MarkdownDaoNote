; MarkdownDaoNote NSIS Installer (Online WebView2)
Unicode true
; Requires: NSIS (https://nsis.sourceforge.io/)

!define PRODUCT_NAME "MarkdownDao Note"
!define APP_NAME        "MarkdownDaoNote"
!define COMPANY_NAME    "Taoism Dao"
!define APP_VERSION     "1.0.1"
!define PUBLISHER       "${COMPANY_NAME}"
!define URL_HOMEPAGE    "https://github.com/"

; Resolve project root based on this script location
!define SCRIPT_DIR      "${__FILEDIR}"
!ifndef PROJECT_ROOT
  !define PROJECT_ROOT  "${SCRIPT_DIR}\.."
!endif

!define INSTALL_DIR     "$PROGRAMFILES\${APP_NAME}"
!define EXE_SOURCE      "${PROJECT_ROOT}\build\bin\MarkdownDaoNote.exe"
!define EXE_TARGET      "${APP_NAME}.exe"
!define UNINST_KEY      "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"

Name "${PRODUCT_NAME}"
Icon "${PROJECT_ROOT}\assets\icons\icon.ico"

; OutFile "C:\my-installer.exe"
OutFile "${PROJECT_ROOT}\build\bin\${APP_NAME}-${APP_VERSION}-installer.exe"
InstallDir "${INSTALL_DIR}"
RequestExecutionLevel admin
ShowInstDetails nevershow
ShowUninstDetails nevershow

!include "MUI2.nsh"
!include "LogicLib.nsh"

!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${PROJECT_ROOT}\assets\icons\header_image.bmp"
!define MUI_HEADERIMAGE_TITLE "安装 ${PRODUCT_NAME}"

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Var WebView2NeedInstall

Section "Install Main Program" SEC_MAIN
  SetOutPath "$INSTDIR"

  ; 1) Copy main executable
  File "${EXE_SOURCE}"
  Rename "$INSTDIR\MarkdownDaoNote.exe" "$INSTDIR\${EXE_TARGET}"

  ; 2) Create Start Menu and Desktop shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${EXE_TARGET}"
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${EXE_TARGET}"

  ; 3) Detect WebView2 runtime via registry
  ; HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" 0 +3
    StrCpy $WebView2NeedInstall 1
    Goto +2
  StrCpy $WebView2NeedInstall 0

  ; 4) If missing, download & install Evergreen Bootstrapper (online)
  StrCmp $WebView2NeedInstall 1 0 +12
    DetailPrint "Downloading WebView2 Runtime (online)..."
    StrCpy $1 "$TEMP\\MicrosoftEdgeWebView2Setup.exe"
    ; Use PowerShell to download (built-in on modern Windows). Escape $ with $$ for NSIS.
    nsExec::ExecToStack 'powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $$ProgressPreference=''SilentlyContinue''; $$u=''https://go.microsoft.com/fwlink/p/?LinkId=2124703''; Invoke-WebRequest -UseBasicParsing -Uri $$u -OutFile ''$1''"'
    Pop $2  ; exit code
    StrCmp $2 0 0 +5
      DetailPrint "Installing WebView2 Runtime..."
      ExecWait '"$1" /install /silent /norestart'
      Delete "$1"
      Goto +4
    DetailPrint "Failed to download WebView2. Opening download page..."
    ExecShell "open" "https://developer.microsoft.com/en-us/microsoft-edge/webview2/"

  ; 5) Write uninstall information
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKLM "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE_TARGET}"
  WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" '"$INSTDIR\\Uninstall.exe"'
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "File Associations (.md / .markdown)" SEC_ASSOC
  ; 关联 .md
  WriteRegStr HKCR ".md" "" "MarkdownDaoNote.md"
  WriteRegStr HKCR "MarkdownDaoNote.md" "" "Markdown 文件"
  WriteRegStr HKCR "MarkdownDaoNote.md\DefaultIcon" "" "$INSTDIR\${EXE_TARGET},0"
  WriteRegStr HKCR "MarkdownDaoNote.md\shell" "" "open"
  ; UseShellExecute ensures single instance and proper argument passing
  WriteRegStr HKCR "MarkdownDaoNote.md\shell\open\command" "" '"$INSTDIR\${EXE_TARGET}" "%1"'

  ; 关联 .markdown
  WriteRegStr HKCR ".markdown" "" "MarkdownDaoNote.markdown"
  WriteRegStr HKCR "MarkdownDaoNote.markdown" "" "Markdown 文件"
  WriteRegStr HKCR "MarkdownDaoNote.markdown\DefaultIcon" "" "$INSTDIR\${EXE_TARGET},0"
  WriteRegStr HKCR "MarkdownDaoNote.markdown\shell" "" "open"
  WriteRegStr HKCR "MarkdownDaoNote.markdown\shell\open\command" "" '"$INSTDIR\${EXE_TARGET}" "%1"'
SectionEnd

Section "Context Menu: Open with MarkdownDaoNote" SEC_CONTEXT
  ; 为所有文件添加右键菜单项
  WriteRegStr HKCR "*\shell\OpenWithMarkdownDaoNote" "" "Open with MarkdownDaoNote"
  WriteRegStr HKCR "*\shell\OpenWithMarkdownDaoNote" "Icon" "$INSTDIR\${EXE_TARGET},0"
  WriteRegStr HKCR "*\shell\OpenWithMarkdownDaoNote\command" "" '"$INSTDIR\${EXE_TARGET}" "%1"'
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  RMDir  "$SMPROGRAMS\${APP_NAME}"

  Delete "$INSTDIR\${EXE_TARGET}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir  "$INSTDIR"

  DeleteRegKey HKLM "${UNINST_KEY}"

  ; 清理文件关联
  DeleteRegKey HKCR "MarkdownDaoNote.md\shell\open\command"
  DeleteRegKey HKCR "MarkdownDaoNote.md\DefaultIcon"
  DeleteRegKey HKCR "MarkdownDaoNote.md\shell"
  DeleteRegKey HKCR "MarkdownDaoNote.md"
  ; .md 的默认值可能被其他程序接管，这里不删除 .md 根键，仅在安装时写入

  DeleteRegKey HKCR "MarkdownDaoNote.markdown\shell\open\command"
  DeleteRegKey HKCR "MarkdownDaoNote.markdown\DefaultIcon"
  DeleteRegKey HKCR "MarkdownDaoNote.markdown\shell"
  DeleteRegKey HKCR "MarkdownDaoNote.markdown"
  ; .markdown The root key is not deleted for the same reason.

  ; 清理右键菜单
  DeleteRegKey HKCR "*\shell\OpenWithMarkdownDaoNote\command"
  DeleteRegKey HKCR "*\shell\OpenWithMarkdownDaoNote"
SectionEnd
