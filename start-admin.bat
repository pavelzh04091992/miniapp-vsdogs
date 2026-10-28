@echo off
chcp 65001 > nul
title VS Dogs Backoffice
echo Запуск админ-панели VS Dogs...
node --experimental-sqlite src/admin/server.js
pause
