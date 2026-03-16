@echo off
setlocal EnableDelayedExpansion
title Lecture Slide Maker - App Server
chcp 65001 > nul

:: ─── 스크립트 위치로 이동 ───
cd /d "%~dp0"

echo =========================================
echo   Lecture Slide Maker 실행 스크립트
echo =========================================
echo   폴더: "%cd%"
echo =========================================
echo.

:: ─── package.json 확인 ───
if not exist package.json (
    echo [오류] package.json을 찾을 수 없습니다.
    echo  현재 경로: "%cd%"
    pause
    exit /b 1
)

:: ─── Node.js 찾기 ───
set "NODE_FOUND=0"

:: 1) 시스템 PATH
where npm >nul 2>nul
if !errorlevel!==0 (
    echo [OK] Node.js가 감지되었습니다.
    set "NODE_FOUND=1"
    goto :START_APP
)

:: 2) 로컬 포터블
if exist "%~dp0node\node.exe" (
    echo [OK] 포터블 Node.js를 사용합니다.
    set "PATH=%~dp0node;!PATH!"
    set "NODE_FOUND=1"
    goto :START_APP
)

:: 3) 일반 설치 경로 탐색
echo [..] Node.js를 PATH에서 찾지 못했습니다. 설치 경로를 탐색합니다...

if exist "C:\Program Files\nodejs\npm.cmd" (
    echo [OK] C:\Program Files\nodejs
    set "PATH=C:\Program Files\nodejs;!PATH!"
    set "NODE_FOUND=1"
    goto :START_APP
)

set "CHECK_PATH=!USERPROFILE!\AppData\Local\Programs\nodejs\npm.cmd"
if exist "!CHECK_PATH!" (
    echo [OK] AppData\Local\Programs\nodejs
    set "PATH=!USERPROFILE!\AppData\Local\Programs\nodejs;!PATH!"
    set "NODE_FOUND=1"
    goto :START_APP
)

set "CHECK_PATH=!USERPROFILE!\AppData\Roaming\npm\npm.cmd"
if exist "!CHECK_PATH!" (
    echo [OK] AppData\Roaming\npm
    set "PATH=!USERPROFILE!\AppData\Roaming\npm;!USERPROFILE!\AppData\Local\Programs\nodejs;!PATH!"
    set "NODE_FOUND=1"
    goto :START_APP
)

:: nvm 확인
set "NVM_DIR=!USERPROFILE!\AppData\Roaming\nvm"
if exist "!NVM_DIR!" (
    for /d %%D in ("!NVM_DIR!\v*") do (
        if exist "%%D\npm.cmd" (
            echo [OK] nvm: %%D
            set "PATH=%%D;!PATH!"
            set "NODE_FOUND=1"
        )
    )
)
if "!NODE_FOUND!"=="1" goto :START_APP

:: 4) 자동 다운로드
echo.
echo [!] Node.js를 찾을 수 없습니다.
echo.
echo  포터블 Node.js를 자동 다운로드하시겠습니까?
echo  (약 30MB, 이 폴더에서만 사용)
echo.
choice /C YN /M "다운로드 Y=예 N=아니오"
if !errorlevel!==2 (
    echo.
    echo  수동 설치: https://nodejs.org/ko/download
    pause
    exit /b 1
)

echo.
echo [1/3] 다운로드 중...

set "NODE_VER=v22.14.0"
set "NODE_DIR=node-!NODE_VER!-win-x64"
set "NODE_ZIP=%~dp0node_portable.zip"
set "NODE_URL=https://nodejs.org/dist/!NODE_VER!/!NODE_DIR!.zip"

powershell -Command "& { try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!NODE_ZIP!' -UseBasicParsing } catch { Write-Host $_.Exception.Message } }"

if not exist "!NODE_ZIP!" (
    echo [오류] 다운로드 실패. 인터넷 연결을 확인해주세요.
    pause
    exit /b 1
)

echo [2/3] 압축 해제 중...
powershell -Command "& { $ProgressPreference = 'SilentlyContinue'; Expand-Archive -Path '!NODE_ZIP!' -DestinationPath '%~dp0' -Force }"

if exist "%~dp0!NODE_DIR!" rename "%~dp0!NODE_DIR!" node
if exist "!NODE_ZIP!" del "!NODE_ZIP!"

if not exist "%~dp0node\node.exe" (
    echo [오류] 압축 해제 실패.
    pause
    exit /b 1
)

echo [3/3] 포터블 Node.js 설치 완료!
set "PATH=%~dp0node;!PATH!"

:: ─── 앱 실행 ───
:START_APP
echo.
echo [1/2] 패키지 설치/확인 중...
echo.
call npm install
if !errorlevel! neq 0 (
    echo.
    echo [오류] 패키지 설치 실패.
    pause
    exit /b 1
)

echo.
echo [2/2] 서버를 시작합니다. 브라우저가 자동으로 열립니다.
echo  (몇 초 정도 소요될 수 있습니다)
echo  이 창을 닫으면 서버가 종료됩니다.
echo.

start http://localhost:3000
call npm run dev

echo.
echo  서버가 종료되었습니다.
pause
