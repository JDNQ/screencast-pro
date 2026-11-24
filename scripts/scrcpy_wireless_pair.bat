@echo off
title ScreenCast Pro - Scrcpy Wireless Mode
color 0a
echo ====================================================================
echo      ScreenCast Pro - Ket noi khong day qua Scrcpy Wi-Fi (60 FPS)
echo ====================================================================
echo.
echo Huong dan nhanh cho dien thoai Android 11 tro len:
echo 1. Tren dien thoai, vao Cai dat -> Tuy chon cho nha phat trien (Developer Options).
echo 2. Bat "Go loi khong day" (Wireless Debugging).
echo 3. Chon "Ghep noi thiet bi bang ma ghep noi" (Pair device with pairing code).
echo.
set /p IP_PORT="Nhap dia chi IP va Port hien thi tren dien thoai (vd: 192.168.1.50:37281): "
set /p PAIR_CODE="Nhap ma 6 chu so (Pairing code): "

echo.
echo Dang thuc hien ghep noi...
adb pair %IP_PORT% %PAIR_CODE%

echo.
echo Sau khi ghep noi thanh cong, hay nhap Port ket noi chinh (o trang truoc):
set /p CONNECT_PORT="Nhap dia chi IP va Port ket noi chinh (vd: 192.168.1.50:41235): "

adb connect %CONNECT_PORT%
echo.
echo Dang khoi chay chieu man hinh Scrcpy toc do cao...
scrcpy -s %CONNECT_PORT% --max-fps 60 --video-bit-rate 8M --stay-awake

pause
