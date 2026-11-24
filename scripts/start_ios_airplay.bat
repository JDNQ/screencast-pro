@echo off
title ScreenCast Pro - Huong Dan AirPlay Receiver cho Windows
color 0b
echo ====================================================================
echo      ScreenCast Pro - Giai phap AirPlay Receiver cho Windows
echo ====================================================================
echo.
echo Giai thich ky thuat:
echo Apple AirPlay Mirroring tren iPhone/iPad su dung ma hoa FairPlay DRM
echo va giao thuc RAOP dac thu. De may tinh Windows tro thanh mot AirPlay
echo Receiver dich thuc co the nhan luong man hinh tu iPhone:
echo.
echo [Giai phap 1 - Ma nguon mo mien phi]: UxPlay / OpenMirrorPhone
echo     - Tai ban build Windows cua UxPlay: https://github.com/FDH2/UxPlay/releases
echo     - Hoac OpenMirrorPhone: https://github.com/ImElio/openmirrorphone
echo     - Yeu cau: PC va iPhone cung mang Wi-Fi, Bonjour Service da cai dat.
echo.
echo [Giai phap 2 - Thuong mai on dinh]: AirServer / Reflector 4
echo     - AirServer bien Windows thanh thiet bị nhan AirPlay chuyen nghiep.
echo.
echo [Giai phap 3 - Khong can AirPlay]: Dung App iOS Native ReplayKit
echo     - Mo thu muc 'ios-native/' trong project nay bang Xcode va cai dat.
echo     - Nhap ma PIN 6 chu so hien thi tren PC de chieu truc tiep qua mang LAN.
echo.
echo Nhan phim bat ky de mo giao dien PC Receiver tren trinh duyet...
pause >nul
start http://localhost:3000
