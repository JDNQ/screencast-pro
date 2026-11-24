@echo off
title ScreenCast Pro - Multi Display Server
color 0b
echo ============================================================
echo         ScreenCast Pro - Khoi dong he thong chieu man hinh
echo ============================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tu: https://nodejs.org/
    pause
    exit /b 1
)

:: Check dependencies
if not exist node_modules (
    echo [Thong bao] Dang cai dat thu vien he thong...
    call npm install
)

echo [1/2] Dang khoi dong Signaling Server va HTTPS Engine...
start cmd /k "node server.js"

timeout /t 2 >nul

echo [2/2] Dang mo giao dien PC Receiver tren trinh duyet...
start http://localhost:3000

echo.
echo ============================================================
echo   He thong da khoi dong thanh cong!
echo   Hay quet ma QR tren trinh duyet bang dien thoai cua ban.
echo ============================================================
pause
