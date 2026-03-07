@echo off
REM Notification sound for Claude Code
REM Plays the custom notification.wav file

powershell -WindowStyle Hidden -Command "(New-Object System.Media.SoundPlayer 'C:\Users\HP\Projects\kairaenterprises\.claude\sounds\notification.wav').PlaySync()"

exit /b 0
