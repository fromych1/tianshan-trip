@echo off
chcp 65001 > nul
title TianShan RoadTrip Planner Server

echo ========================================================
echo   🚗 ЗАПУСК ПЛАНИРОВЩИКА МАРШРУТА ТЯНЬ-ШАНЬ
echo ========================================================
echo.
echo Запуск локального веб-сервера на порту 5050...

start "" http://localhost:5050
python server.py

pause
