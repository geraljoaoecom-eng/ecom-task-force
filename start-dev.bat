@echo off
echo ================================
echo  ECOM TaskForce v2.0 - Modo Dev
echo ================================
echo.
echo Iniciando API (porta 4000)...
start "ECOM API" cmd /k "cd apps\api && npm run dev"
timeout /t 3 /nobreak > nul
echo.
echo Iniciando Frontend (porta 3000)...
start "ECOM Frontend" cmd /k "cd apps\web && npm run dev"
timeout /t 2 /nobreak > nul
echo.
echo ================================
echo  Servidores iniciados!
echo ================================
echo.
echo  API:      http://localhost:4000
echo  Frontend: http://localhost:3000
echo  Health:   http://localhost:4000/api/health
echo.
echo ================================
echo.
echo Para parar os servidores, feche as janelas.
echo Pressione qualquer tecla para fechar este prompt...
pause > nul

