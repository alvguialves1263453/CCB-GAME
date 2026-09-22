@echo off
chcp 65001 >nul
title CCB GAME - Servidor
color 0A

echo.
echo  ========================================
echo   CCB QUIZ GAME - Iniciando Servidor
echo  ========================================
echo.

REM Vai para a pasta do .bat (projeto)
cd /d "%~dp0"

echo [1/4] Verificando Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERRO: Node.js nao encontrado! Instale em https://nodejs.org
    pause
    exit /b 1
)
node -v
echo.

echo [2/4] Verificando arquivos .env...
if not exist ".env" (
    echo  AVISO: .env nao encontrado! Criando a partir de .env.example...
    if exist ".env.example" copy ".env.example" ".env" >nul
)
if not exist ".env.local" (
    if exist ".env" copy ".env" ".env.local" >nul
)
echo  OK (.env encontrado)
echo.

echo [3/4] Instalando dependencias (se necessario)...
if not exist "node_modules" (
    echo  node_modules nao encontrado - rodando npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo  ERRO no npm install
        pause
        exit /b 1
    )
) else (
    echo  node_modules OK
)
echo.

echo [4/4] Iniciando servidor em http://localhost:3000 ...
echo  Pressione CTRL+C para parar
echo  ----------------------------------------
echo.

REM Libera execucao de scripts PowerShell e roda dev server
powershell -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force" >nul 2>&1
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo  Servidor parou com erro. Tentando modo alternativo...
    echo  Rodando: npx tsx server.ts
    call npx tsx server.ts
)

echo.
echo  Servidor encerrado.
pause
