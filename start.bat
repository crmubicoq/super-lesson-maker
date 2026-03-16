@echo off
title Lecture Slide Maker - App Server
chcp 65001 > nul

echo =========================================
echo   Lecture Slide Maker 실행 스크립트
echo =========================================
echo.

:: ─── 1단계: 시스템 PATH에서 npm 확인 ───
where npm >nul 2>nul
if %errorlevel%==0 (
    echo [OK] Node.js가 감지되었습니다.
    goto :START_APP
)

:: ─── 2단계: 로컬 포터블 Node.js 확인 ───
if exist "%~dp0node\node.exe" (
    echo [OK] 포터블 Node.js를 사용합니다.
    set "PATH=%~dp0node;%PATH%"
    goto :START_APP
)

:: ─── 3단계: 일반적인 Node.js 설치 경로 탐색 ───
echo [..] Node.js를 시스템 PATH에서 찾지 못했습니다. 설치 경로를 탐색합니다...
echo.

:: Program Files 경로들 확인
if exist "C:\Program Files\nodejs\npm.cmd" (
    echo [OK] Node.js를 찾았습니다: C:\Program Files\nodejs
    set "PATH=C:\Program Files\nodejs;%PATH%"
    goto :START_APP
)

if exist "C:\Program Files (x86)\nodejs\npm.cmd" (
    echo [OK] Node.js를 찾았습니다: C:\Program Files (x86)\nodejs
    set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
    goto :START_APP
)

:: 사용자 AppData 경로 확인 (nvm, fnm 등 버전 관리자용)
for /d %%D in ("%USERPROFILE%\AppData\Roaming\nvm\v*") do (
    if exist "%%D\npm.cmd" (
        echo [OK] Node.js를 찾았습니다 (nvm): %%D
        set "PATH=%%D;%PATH%"
        goto :START_APP
    )
)

if exist "%USERPROFILE%\AppData\Roaming\npm\npm.cmd" (
    echo [OK] Node.js를 찾았습니다: %USERPROFILE%\AppData\Roaming\npm
    set "PATH=%USERPROFILE%\AppData\Roaming\npm;%USERPROFILE%\AppData\Local\Programs\nodejs;%PATH%"
    goto :START_APP
)

if exist "%USERPROFILE%\AppData\Local\Programs\nodejs\npm.cmd" (
    echo [OK] Node.js를 찾았습니다: %USERPROFILE%\AppData\Local\Programs\nodejs
    set "PATH=%USERPROFILE%\AppData\Local\Programs\nodejs;%PATH%"
    goto :START_APP
)

:: fnm (Fast Node Manager) 경로 확인
if exist "%USERPROFILE%\AppData\Local\fnm_multishells" (
    for /d %%D in ("%USERPROFILE%\AppData\Local\fnm_multishells\*") do (
        if exist "%%D\npm.cmd" (
            echo [OK] Node.js를 찾았습니다 (fnm): %%D
            set "PATH=%%D;%PATH%"
            goto :START_APP
        )
    )
)

:: Scoop 경로 확인
if exist "%USERPROFILE%\scoop\apps\nodejs\current\npm.cmd" (
    echo [OK] Node.js를 찾았습니다 (scoop): %USERPROFILE%\scoop\apps\nodejs\current
    set "PATH=%USERPROFILE%\scoop\apps\nodejs\current;%PATH%"
    goto :START_APP
)

:: ─── 4단계: 못 찾은 경우 → 자동 다운로드 제안 ───
echo [!] Node.js 설치를 찾을 수 없습니다.
echo.
echo  자동으로 포터블 Node.js를 다운로드하시겠습니까?
echo  (약 30MB, 설치 없이 이 폴더에서만 사용됩니다)
echo.
choice /C YN /M "다운로드하시겠습니까? (Y=예, N=아니오)"
if %errorlevel%==2 (
    echo.
    echo  수동 설치를 원하시면 아래 링크에서 Node.js를 설치해주세요:
    echo  https://nodejs.org/ko/download
    echo.
    echo  설치 후 이 스크립트를 다시 실행해주세요.
    pause
    exit /b 1
)

echo.
echo [1/3] 포터블 Node.js를 다운로드하고 있습니다...
echo  (시간이 조금 걸릴 수 있습니다)
echo.

:: Node.js v22 LTS (Windows x64) zip 다운로드
set "NODE_VER=v22.14.0"
set "NODE_DIR=node-%NODE_VER%-win-x64"
set "NODE_ZIP=%~dp0node_portable.zip"
set "NODE_URL=https://nodejs.org/dist/%NODE_VER%/%NODE_DIR%.zip"

:: PowerShell로 다운로드
powershell -Command "& { try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%' -UseBasicParsing; Write-Host 'OK' } catch { Write-Host 'FAIL'; Write-Host $_.Exception.Message } }"

if not exist "%NODE_ZIP%" (
    echo.
    echo [오류] 다운로드에 실패했습니다. 인터넷 연결을 확인해주세요.
    echo  수동 설치: https://nodejs.org/ko/download
    pause
    exit /b 1
)

echo [2/3] 압축을 해제하고 있습니다...

:: PowerShell로 압축 해제
powershell -Command "& { $ProgressPreference = 'SilentlyContinue'; Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%~dp0' -Force }"

:: 폴더 이름을 node로 변경
if exist "%~dp0%NODE_DIR%" (
    rename "%~dp0%NODE_DIR%" node
)

:: zip 파일 삭제
if exist "%NODE_ZIP%" del "%NODE_ZIP%"

if not exist "%~dp0node\node.exe" (
    echo.
    echo [오류] 압축 해제에 실패했습니다.
    echo  수동 설치: https://nodejs.org/ko/download
    pause
    exit /b 1
)

echo [3/3] 포터블 Node.js 설치 완료!
echo.

set "PATH=%~dp0node;%PATH%"

:: ─── 앱 실행 ───
:START_APP
echo.
echo [1/2] 필요한 패키지를 설치/확인하고 있습니다...
call npm install

echo.
echo [2/2] 시스템을 시작하고 브라우저를 엽니다.
echo  (서버가 준비되는데 몇 초 정도 소요될 수 있습니다)
echo  창을 닫으면 서버가 종료됩니다.
echo.

:: 브라우저를 띄웁니다
start http://localhost:3000

:: Next.js 개발 서버를 실행합니다
call npm run dev

pause
