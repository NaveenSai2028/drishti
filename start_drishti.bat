@echo off
title DRISHTI - Road Safety & Pothole Intelligence Platform
echo ======================================================================
echo           DRISHTI - See the Risk. Save a Life.
echo   AI-Powered Road Safety Intelligence & Pothole Management Platform
echo ======================================================================
echo.
echo Launching DRISHTI Backend with YOLOv11 Computer Vision & Maps API...
cd /d "%~dp0"
if exist "C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe" (
    "C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe" run_server.py
) else (
    py run_server.py
)
pause