@echo off
title ScreenCast Pro - Apple AirPlay Windows Receiver
color 0f
echo ====================================================================
echo      ScreenCast Pro - Huong dan phan chieu AirPlay tu iPhone/iPad
echo ====================================================================
echo.
echo [1] Kiem tra ket noi:
echo     - May tinh va iPhone/iPad phai ket noi chung 1 mang Wi-Fi.
echo     - May tinh da kich hoat quang ba mDNS Bonjour: ScreenCast-Pro-%COMPUTERNAME%
echo.
echo [2] Cac buoc ket noi tu iPhone/iPad:
echo     Buoc 1: Mo iPhone, vuot tu goc tren ben phai xuong de vao Trung tam dieu khien.
echo     Buoc 2: Nhan vao bieu tuong 2 hinh chu nhat long nhau (Phan chieu man hinh).
echo     Buoc 3: Chon "ScreenCast-Pro" hoac ten may tinh cua ban.
echo.
echo [3] Neu dung cong cu ma nguon mo chuyen dung (OpenMirrorPhone / UxPlay):
echo     Ban co the su dung them UxPlay hoac OpenMirrorPhone (GitHub) de nhan luong
echo     AirPlay 2 duoc ma hoa truc tiep ve man hinh may tinh.
echo.
echo Nhan phim bat ky de mo huong dan truc quan tren trinh duyet...
pause >nul
start http://localhost:3000
