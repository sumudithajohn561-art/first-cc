@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"

:: Start Obsidian
start "" "E:\XIAZAI\obsidian\Obsidian.exe"

:: Wait a moment for Obsidian to start
timeout /t 4 /nobreak >NUL

:: Start Pomodoro Timer
cd /d "E:\AI\cuesor\first Claude code"
start "Pomodoro" /min cmd /c "C:\Program Files\nodejs\npm.cmd start"
