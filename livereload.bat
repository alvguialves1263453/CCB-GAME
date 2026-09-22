@echo off
chcp 65001 >nul
title CCB GAME - LiveReload
color 0B

cd /d "%~dp0"

echo.
echo  ========================================
echo   CCB GAME - LIVERELOAD (Auto Atualiza)
echo  ========================================
echo.
echo  Site local: http://localhost:3000
echo  Rede local: http://%COMPUTERNAME%:3000  (use no celular)
echo.
echo  Qualquer alteracao em src/ atualiza o site AUTOMATICO (HMR).
echo  Pressione CTRL+C para parar
echo  ----------------------------------------
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado
    pause
    exit /b 1
)

if not exist "node_modules" call npm install

REM Pega IP local para mostrar QR
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo  IP Local: http://%%a:3000
    goto :ipdone
)
:ipdone

echo.
echo  Iniciando com HMR ativado...
echo.

powershell -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force" >nul 2>&1
call npm run dev

pause
