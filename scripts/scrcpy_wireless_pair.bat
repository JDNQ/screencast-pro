@echo off
title ScreenCast Pro - Scrcpy Wireless Mode
color 0a
echo ====================================================================
echo      ScreenCast Pro - Ket noi khong day qua Scrcpy Wi-Fi
echo ====================================================================
echo.

:: 1. Check ADB
set ADB_CMD=adb
where adb >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        set "ADB_CMD=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
    ) else (
        echo [LOI] Khong tim thay cong cu 'adb' tren may tinh!
        echo Vui long cai dat Android Platform Tools tu:
        echo https://developer.android.com/tools/releases/platform-tools
        echo.
        pause
        exit /b 1
    )
)

:: 2. Check Scrcpy
where scrcpy >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay cong cu 'scrcpy' tren he thong!
    echo Scrcpy la cong cu ma nguon mo chieu man hinh Android sieu toc.
    echo Ban co the tai ban Portable cho Windows tai:
    echo https://github.com/Genymobile/scrcpy/releases
    echo.
    echo Sau khi tai ve, giai nen va them thu muc scrcpy vao PATH hoac copy vao thu muc nay.
    pause
    exit /b 1
)

echo Huong dan nhanh cho dien thoai Android 11 tro len:
echo 1. Tren dien thoai, vao Cai dat -> Tuy chon cho nha phat trien (Developer Options).
echo 2. Bat "Go loi khong day" (Wireless Debugging).
echo 3. Chon "Ghep noi thiet bi bang ma ghep noi" (Pair device with pairing code).
echo.
set /p IP_PORT="Nhap dia chi IP va Port hien thi tren dien thoai (vd: 192.168.1.50:37281): "
set /p PAIR_CODE="Nhap ma 6 chu so (Pairing code): "

echo.
echo Dang thuc hien ghep noi...
"%ADB_CMD%" pair %IP_PORT% %PAIR_CODE%

echo.
echo Sau khi ghep noi thanh cong, hay nhap Port ket noi chinh (o trang truoc):
set /p CONNECT_PORT="Nhap dia chi IP va Port ket noi chinh (vd: 192.168.1.50:41235): "

"%ADB_CMD%" connect %CONNECT_PORT%
echo.
echo Dang khoi chay chieu man hinh Scrcpy...
scrcpy -s %CONNECT_PORT% --max-fps 60 --video-bit-rate 8M --stay-awake

pause
