@echo off
title LAYER ZERO - 3D Print Lab
cd /d "%~dp0"
echo Starting LAYER ZERO on http://localhost:3000  (Master panel: http://localhost:3000/master)
start "" http://localhost:3000
node server.js
pause
