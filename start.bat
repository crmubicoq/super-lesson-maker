@echo off
title Lecture Slide Maker - App Server
chcp 65001 > nul

echo =========================================
echo  Lecture Slide Maker 실행 스크립트
echo =========================================
echo.

echo [1/2] 필요한 패키지를 설치/확인하고 있습니다...
call npm install

echo.
echo [2/2] 시스템을 시작하고 브라우저를 엽니다.
echo (서버가 준비되는데 몇 초 정도 소요될 수 있습니다)
echo 창을 닫으면 서버가 종료됩니다.
echo.

:: 브라우저를 띄웁니다
start http://localhost:3000

:: Next.js 개발 서버를 실행합니다
call npm run dev

pause
