@echo off
title ScreenCast Pro - Huong Dan AirPlay Receiver cho Windows
color 0b
echo ====================================================================
echo      ScreenCast Pro - Giai phap AirPlay Receiver cho Windows
echo ====================================================================
echo.
echo Giai thich ky thuat:
echo Apple AirPlay Mirroring tren iPhone/iPad su dung ma hoa FairPlay DRM
echo va giao thuc RAOP dac thu. Du an ScreenCast Pro Web khong phai la AirPlay
echo Receiver va khong gia lap AirPlay de tranh thiet bi "ma" tren iPhone.
echo.
echo ====================================================================
echo [Giai phap 1 - KHUYEN DUNG (Mien phi & Co GUI)]: uxplay-windows
echo ====================================================================
echo   * Tai ban dong goi Windows (co khay he thong System Tray):
echo     https://github.com/leapbtw/uxplay-windows/releases
echo.
echo   * Luu y quan trong khi cai dat:
echo     1. Trinh cai dat co the tu dong tai Apple Bonjour Service giup ban.
echo     2. Windows Defender co the canh bao SmartScreen do file chua ky so,
echo        hay chon "More info" -> "Run anyway".
echo     3. Cho phep file "uxplay.exe" qua Windows Firewall o mang Private
echo        (vi UxPlay su dung cong ngau nhien cho luong video/audio).
echo     4. iPhone vuot mo Control Center -> "Phan chieu man hinh" (Screen
echo        Mirroring) -> Chon ten may tinh cua ban.
echo     5. Luu y: Hinh anh se hien thi trong cua so rieng cua UxPlay (khong
echo        nam trong giao dien web ScreenCast Pro).
echo.
echo ====================================================================
echo [Giai phap 2 - Thuong mai on dinh]: AirServer / Reflector 4
echo ====================================================================
echo   * AirServer la giai phap AirPlay Receiver thuong mai hoan hao cho Windows.
echo.
echo ====================================================================
echo [Giai phap 3 - Khong dung AirPlay]: Dung App iOS Native ReplayKit
echo ====================================================================
echo   * Yeu cau may Mac + Xcode + tai khoan Apple Developer.
echo   * Mo thu muc 'ios-native/' de build app va Broadcast Extension.
echo.
echo Nhan phim bat ky de mo giao dien PC Receiver tren trinh duyet...
pause >nul
start http://localhost:3000
