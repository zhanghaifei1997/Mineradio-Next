; Mineradio Installer Custom Script
; 安装安全机制 - 防止误删、防止安装到危险目录

; ==========================================
; 自定义变量
; ==========================================
Var MineradioInstallDrive
Var MineradioDefaultInstallDir
Var MineradioIsValidInstallDir
Var MineradioIsUpgrade
Var MineradioTempFileCount

; ==========================================
; 已知的 Mineradio 文件列表（用于安全卸载）
; ==========================================
!define MineradioKnownFiles "Mineradio.exe;uninstall.exe;package.json;version"
!define MineradioKnownDirs "electron;dist;server;resources;locales;swiftshader"

; ==========================================
; 自定义安装初始化：选择默认安装目录
; ==========================================
Function .onInit
  ; 调用默认初始化
  !insertmacro MUI_LANGDLL_DISPLAY

  ; 检测可用盘符，选择默认安装位置
  Call MineradioFindDefaultInstallDrive

  ; 设置默认安装目录
  StrCpy $MineradioDefaultInstallDir "$MineradioInstallDrive\Mineradio"
  StrCpy $INSTDIR "$MineradioDefaultInstallDir"

  ; 检查是否是升级安装
  Call MineradioCheckUpgrade
FunctionEnd

; ==========================================
; 查找默认安装盘符（优先 D 盘，然后 E-Z，最后 C 盘）
; ==========================================
Function MineradioFindDefaultInstallDrive
  ; 默认 C 盘
  StrCpy $MineradioInstallDrive "C:"

  ; 检查 D 盘
  IfFileExists "D:\*.*" 0 CheckDriveE
  StrCpy $MineradioInstallDrive "D:"
  Goto FindDriveDone

CheckDriveE:
  IfFileExists "E:\*.*" 0 CheckDriveF
  StrCpy $MineradioInstallDrive "E:"
  Goto FindDriveDone

CheckDriveF:
  IfFileExists "F:\*.*" 0 CheckDriveG
  StrCpy $MineradioInstallDrive "F:"
  Goto FindDriveDone

CheckDriveG:
  IfFileExists "G:\*.*" 0 CheckDriveH
  StrCpy $MineradioInstallDrive "G:"
  Goto FindDriveDone

CheckDriveH:
  IfFileExists "H:\*.*" 0 CheckDriveI
  StrCpy $MineradioInstallDrive "H:"
  Goto FindDriveDone

CheckDriveI:
  IfFileExists "I:\*.*" 0 CheckDriveJ
  StrCpy $MineradioInstallDrive "I:"
  Goto FindDriveDone

CheckDriveJ:
  IfFileExists "J:\*.*" 0 CheckDriveK
  StrCpy $MineradioInstallDrive "J:"
  Goto FindDriveDone

CheckDriveK:
  IfFileExists "K:\*.*" 0 CheckDriveL
  StrCpy $MineradioInstallDrive "K:"
  Goto FindDriveDone

CheckDriveL:
  IfFileExists "L:\*.*" 0 CheckDriveM
  StrCpy $MineradioInstallDrive "L:"
  Goto FindDriveDone

CheckDriveM:
  IfFileExists "M:\*.*" 0 CheckDriveN
  StrCpy $MineradioInstallDrive "M:"
  Goto FindDriveDone

CheckDriveN:
  IfFileExists "N:\*.*" 0 CheckDriveO
  StrCpy $MineradioInstallDrive "N:"
  Goto FindDriveDone

CheckDriveO:
  IfFileExists "O:\*.*" 0 CheckDriveP
  StrCpy $MineradioInstallDrive "O:"
  Goto FindDriveDone

CheckDriveP:
  IfFileExists "P:\*.*" 0 CheckDriveQ
  StrCpy $MineradioInstallDrive "P:"
  Goto FindDriveDone

CheckDriveQ:
  IfFileExists "Q:\*.*" 0 CheckDriveR
  StrCpy $MineradioInstallDrive "Q:"
  Goto FindDriveDone

CheckDriveR:
  IfFileExists "R:\*.*" 0 CheckDriveS
  StrCpy $MineradioInstallDrive "R:"
  Goto FindDriveDone

CheckDriveS:
  IfFileExists "S:\*.*" 0 CheckDriveT
  StrCpy $MineradioInstallDrive "S:"
  Goto FindDriveDone

CheckDriveT:
  IfFileExists "T:\*.*" 0 CheckDriveU
  StrCpy $MineradioInstallDrive "T:"
  Goto FindDriveDone

CheckDriveU:
  IfFileExists "U:\*.*" 0 CheckDriveV
  StrCpy $MineradioInstallDrive "U:"
  Goto FindDriveDone

CheckDriveV:
  IfFileExists "V:\*.*" 0 CheckDriveW
  StrCpy $MineradioInstallDrive "V:"
  Goto FindDriveDone

CheckDriveW:
  IfFileExists "W:\*.*" 0 CheckDriveX
  StrCpy $MineradioInstallDrive "W:"
  Goto FindDriveDone

CheckDriveX:
  IfFileExists "X:\*.*" 0 CheckDriveY
  StrCpy $MineradioInstallDrive "X:"
  Goto FindDriveDone

CheckDriveY:
  IfFileExists "Y:\*.*" 0 CheckDriveZ
  StrCpy $MineradioInstallDrive "Y:"
  Goto FindDriveDone

CheckDriveZ:
  IfFileExists "Z:\*.*" 0 FindDriveDone
  StrCpy $MineradioInstallDrive "Z:"

FindDriveDone:
FunctionEnd

; ==========================================
; 检查是否是升级安装（目录已存在且有 Mineradio 文件）
; ==========================================
Function MineradioCheckUpgrade
  StrCpy $MineradioIsUpgrade "0"

  ; 检查旧的安装路径注册表
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "InstallLocation"
  IfErrors CheckOldInstallPath
  StrCmp $R0 "" CheckOldInstallPath
  StrCpy $INSTDIR $R0
  StrCpy $MineradioIsUpgrade "1"
  Goto CheckUpgradeDone

CheckOldInstallPath:
  ; 检查默认目录是否有 Mineradio.exe
  IfFileExists "$MineradioDefaultInstallDir\Mineradio.exe" 0 CheckUpgradeDone
  StrCpy $INSTDIR "$MineradioDefaultInstallDir"
  StrCpy $MineradioIsUpgrade "1"

CheckUpgradeDone:
FunctionEnd

; ==========================================
; 验证安装目录的安全性
; ==========================================
Function MineradioValidateInstallDir
  StrCpy $MineradioIsValidInstallDir "1"

  ; 检查是否安装到根目录（如 C:\、D:\）
  Push $INSTDIR
  Call IsRootDirectory
  Pop $R0
  StrCmp $R0 "1" InvalidRootDir

  ; 检查目录是否存在且非空
  IfFileExists "$INSTDIR\*.*" CheckDirNotEmpty DirNotExists
  Goto ValidateDone

CheckDirNotEmpty:
  ; 检查是否是 Mineradio 目录（有 Mineradio.exe）
  IfFileExists "$INSTDIR\Mineradio.exe" ValidateDone

  ; 检查是否有 uninstall.exe（可能是其他软件的目录）
  IfFileExists "$INSTDIR\uninstall.exe" InvalidNonMineradioDir

  ; 检查目录下是否有其他可执行文件
  FindFirst $R0 $R1 "$INSTDIR\*.exe"
  StrCmp $R0 "" ValidateDone
  FindClose $R0
  Goto InvalidNonMineradioDir

InvalidRootDir:
  StrCpy $MineradioIsValidInstallDir "0"
  MessageBox MB_OK|MB_ICONSTOP "不能安装到磁盘根目录！$\n$\n请选择一个独立的文件夹，例如：$MineradioInstallDrive\Mineradio"
  Abort
  Goto ValidateDone

InvalidNonMineradioDir:
  StrCpy $MineradioIsValidInstallDir "0"
  MessageBox MB_OK|MB_ICONSTOP "安装目录不安全！$\n$\n目标目录已存在且包含其他文件，为防止误删，请勿安装到此目录。$\n$\n建议安装到：$MineradioInstallDrive\Mineradio"
  Abort

DirNotExists:
  ; 目录不存在，检查父目录
  ; 确保不是系统目录等危险位置

ValidateDone:
FunctionEnd

; ==========================================
; 检查路径是否为根目录
; ==========================================
Function IsRootDirectory
  Exch $R0
  Push $R1
  StrCpy $R1 "0"

  ; 获取盘符和冒号后的第一个字符
  StrCpy $R2 $R0 3
  StrCmp $R2 "A:\\" IsRoot
  StrCmp $R2 "B:\\" IsRoot
  StrCmp $R2 "C:\\" IsRoot
  StrCmp $R2 "D:\\" IsRoot
  StrCmp $R2 "E:\\" IsRoot
  StrCmp $R2 "F:\\" IsRoot
  StrCmp $R2 "G:\\" IsRoot
  StrCmp $R2 "H:\\" IsRoot
  StrCmp $R2 "I:\\" IsRoot
  StrCmp $R2 "J:\\" IsRoot
  StrCmp $R2 "K:\\" IsRoot
  StrCmp $R2 "L:\\" IsRoot
  StrCmp $R2 "M:\\" IsRoot
  StrCmp $R2 "N:\\" IsRoot
  StrCmp $R2 "O:\\" IsRoot
  StrCmp $R2 "P:\\" IsRoot
  StrCmp $R2 "Q:\\" IsRoot
  StrCmp $R2 "R:\\" IsRoot
  StrCmp $R2 "S:\\" IsRoot
  StrCmp $R2 "T:\\" IsRoot
  StrCmp $R2 "U:\\" IsRoot
  StrCmp $R2 "V:\\" IsRoot
  StrCmp $R2 "W:\\" IsRoot
  StrCmp $R2 "X:\\" IsRoot
  StrCmp $R2 "Y:\\" IsRoot
  StrCmp $R2 "Z:\\" IsRoot

  ; 也检查不带反斜杠的情况
  StrCpy $R2 $R0 2
  StrCmp $R2 "A:" IsRootNoSlash
  StrCmp $R2 "B:" IsRootNoSlash
  StrCmp $R2 "C:" IsRootNoSlash
  StrCmp $R2 "D:" IsRootNoSlash
  StrCmp $R2 "E:" IsRootNoSlash
  StrCmp $R2 "F:" IsRootNoSlash
  StrCmp $R2 "G:" IsRootNoSlash
  StrCmp $R2 "H:" IsRootNoSlash
  StrCmp $R2 "I:" IsRootNoSlash
  StrCmp $R2 "J:" IsRootNoSlash
  StrCmp $R2 "K:" IsRootNoSlash
  StrCmp $R2 "L:" IsRootNoSlash
  StrCmp $R2 "M:" IsRootNoSlash
  StrCmp $R2 "N:" IsRootNoSlash
  StrCmp $R2 "O:" IsRootNoSlash
  StrCmp $R2 "P:" IsRootNoSlash
  StrCmp $R2 "Q:" IsRootNoSlash
  StrCmp $R2 "R:" IsRootNoSlash
  StrCmp $R2 "S:" IsRootNoSlash
  StrCmp $R2 "T:" IsRootNoSlash
  StrCmp $R2 "U:" IsRootNoSlash
  StrCmp $R2 "V:" IsRootNoSlash
  StrCmp $R2 "W:" IsRootNoSlash
  StrCmp $R2 "X:" IsRootNoSlash
  StrCmp $R2 "Y:" IsRootNoSlash
  StrCmp $R2 "Z:" IsRootNoSlash

  Goto NotRoot

IsRootNoSlash:
  ; 检查长度是否正好是 2（只有盘符和冒号）
  StrLen $R3 $R0
  IntCmp $R3 2 IsRoot

NotRoot:
  StrCpy $R1 "0"
  Goto IsRootDone

IsRoot:
  StrCpy $R1 "1"

IsRootDone:
  Pop $R0
  Exch $R1
FunctionEnd

; ==========================================
; 自定义安装宏
; ==========================================
!macro customInstall
  ; 验证安装目录
  Call MineradioValidateInstallDir

  ; 创建开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\Mineradio"
  CreateShortCut "$SMPROGRAMS\Mineradio\Mineradio.lnk" "$INSTDIR\Mineradio.exe" "" "$INSTDIR\resources\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\Mineradio\卸载 Mineradio.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\resources\icon.ico" 0

  ; 桌面快捷方式
  CreateShortCut "$DESKTOP\Mineradio.lnk" "$INSTDIR\Mineradio.exe" "" "$INSTDIR\resources\icon.ico" 0

  ; 写入安装位置到注册表（用于升级检测）
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "InstallLocation" "$INSTDIR"
!macroend

; ==========================================
; 自定义卸载宏（安全卸载 - 只删除已知文件）
; ==========================================
!macro customUnInstall
  ; 先删除快捷方式
  Delete "$SMPROGRAMS\Mineradio\Mineradio.lnk"
  Delete "$SMPROGRAMS\Mineradio\卸载 Mineradio.lnk"
  RMDir "$SMPROGRAMS\Mineradio"
  Delete "$DESKTOP\Mineradio.lnk"

  ; 安全删除文件 - 只删除 Mineradio 已知的文件和目录
  Call MineradioSafeUninstall

  ; 删除注册表项
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio"
!macroend

; ==========================================
; 安全卸载函数 - 只删除已知的 Mineradio 文件
; ==========================================
Function MineradioSafeUninstall
  ; 保护检查：确保卸载目录包含 Mineradio.exe
  IfFileExists "$INSTDIR\Mineradio.exe" ContinueUninstall
    ; 没有 Mineradio.exe，可能不是 Mineradio 安装目录，不执行删除
    Goto SafeUninstallDone

ContinueUninstall:
  ; 删除已知的可执行文件
  Delete "$INSTDIR\Mineradio.exe"
  Delete "$INSTDIR\uninstall.exe"
  Delete "$INSTDIR\package.json"
  Delete "$INSTDIR\version"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\LICENSES.chromium.html"
  Delete "$INSTDIR\vulkan-1.dll"
  Delete "$INSTDIR\vk_swiftshader.dll"
  Delete "$INSTDIR\vk_swiftshader_icd.json"
  Delete "$INSTDIR\libEGL.dll"
  Delete "$INSTDIR\libGLESv2.dll"
  Delete "$INSTDIR\d3dcompiler_47.dll"
  Delete "$INSTDIR\ffmpeg.dll"
  Delete "$INSTDIR\chrome_100_percent.pak"
  Delete "$INSTDIR\chrome_200_percent.pak"
  Delete "$INSTDIR\resources.pak"
  Delete "$INSTDIR\icudtl.dat"
  Delete "$INSTDIR\snapshot_blob.bin"
  Delete "$INSTDIR\v8_context_snapshot.bin"
  Delete "$INSTDIR\chrome_crashpad_handler.exe"

  ; 删除已知目录（整个目录）
  RMDir /r "$INSTDIR\electron"
  RMDir /r "$INSTDIR\dist"
  RMDir /r "$INSTDIR\server"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\swiftshader"
  RMDir /r "$INSTDIR\GPUCache"
  RMDir /r "$INSTDIR\Code Cache"
  RMDir /r "$INSTDIR\ShaderCache"
  RMDir /r "$INSTDIR\Temp"

  ; 尝试删除安装目录（如果为空才会成功）
  RMDir "$INSTDIR"

SafeUninstallDone:
FunctionEnd

; ==========================================
; 目录页离开时验证（如果用户修改了安装目录）
; ==========================================
Function DirLeave
  Call MineradioValidateInstallDir
FunctionEnd
