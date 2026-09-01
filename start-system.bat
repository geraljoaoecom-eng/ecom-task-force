@echo off
cls
echo ================================================================
echo  ECOM TaskForce v2.0 - Sistema Completo
echo ================================================================
echo.
echo [1/3] Verificando processos Node...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo     ^> Processos Node encontrados. Limpando...
    taskkill /F /IM node.exe >NUL 2>&1
    timeout /t 2 /nobreak >NUL
    echo     ^> Processos limpos!
) else (
    echo     ^> Nenhum processo Node rodando.
)
echo.

echo [2/3] Iniciando API (porta 4000)...
start "ECOM TaskForce - API" cmd /k "cd /d "%~dp0apps\api" && echo Iniciando API... && npm run dev"
echo     ^> API iniciando em nova janela...
timeout /t 5 /nobreak >NUL
echo     ^> Aguardando API estabilizar...
echo.

echo [3/3] Iniciando Frontend (porta 3000)...
start "ECOM TaskForce - Frontend" cmd /k "cd /d "%~dp0apps\web" && echo Iniciando Frontend... && npm run dev"
echo     ^> Frontend iniciando em nova janela...
timeout /t 3 /nobreak >NUL
echo.

echo ================================================================
echo  Sistema iniciado com sucesso!
echo ================================================================
echo.
echo  Status:
echo    ^> API:      Aguardando... (verifique a janela "API")
echo    ^> Frontend: Compilando... (verifique a janela "Frontend")
echo.
echo  URLs (aguarde ~30 segundos):
echo    ^> API:      http://localhost:4000/api/health
echo    ^> Frontend: http://localhost:3000
echo.
echo  Login:
echo    ^> Email: pokt@gmail.com
echo    ^> Senha: 84005787
echo.
echo ================================================================
echo.
echo Para parar: Feche as janelas "API" e "Frontend"
echo.
pause

