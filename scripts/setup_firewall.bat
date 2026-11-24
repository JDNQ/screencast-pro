@echo off
title ScreenCast Pro - Cau Hinh Windows Firewall
color 0b
echo ====================================================================
echo     ScreenCast Pro - Tu dong mo Windows Firewall cho mang LAN
echo ====================================================================
echo.
echo Luu y: Script nay can quyen Administrator de them quy tac Firewall.
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [CANH BAO] Ban chua chay script voi quyen Administrator!
    echo Vui long chuot phai vao file nay va chon "Run as administrator".
    pause
    exit /b 1
)

echo [1/4] Mo cong 3000 TCP (HTTP Signaling & Streaming)...
netsh advfirewall firewall add rule name="ScreenCast Pro HTTP 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain >nul

echo [2/4] Mo cong 3443 TCP (HTTPS Media Server)...
netsh advfirewall firewall add rule name="ScreenCast Pro HTTPS 3443" dir=in action=allow protocol=TCP localport=3443 profile=private,domain >nul

echo [3/4] Mo cong 5353 UDP (mDNS Device Discovery / Bonjour)...
netsh advfirewall firewall add rule name="ScreenCast Pro mDNS 5353" dir=in action=allow protocol=UDP localport=5353 profile=private,domain >nul

echo [4/4] Luu y ve AirPlay Receiver (UxPlay):
echo UxPlay su dung cac cong TCP/UDP ngau nhien cho luong H.264/RAOP.
echo Neu dung UxPlay, hay cho phep chuong trinh "uxplay.exe" qua Windows Firewall:
echo (Windows Security -> Firewall & network protection -> Allow an app through firewall).
echo.
echo ====================================================================
echo  Da thiet lap Firewall thanh cong!
echo  Dien thoai gio day co the ket noi vao may tinh qua mang Wi-Fi Private.
echo ====================================================================
pause
