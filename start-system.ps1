# ECOM TaskForce v2.0 - Script de Inicialização
# PowerShell Script

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " ECOM TaskForce v2.0 - Sistema Completo" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Limpar processos Node existentes
Write-Host "[1/3] Limpando processos Node..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "      Encontrados $($nodeProcesses.Count) processos Node. Finalizando..." -ForegroundColor Gray
    $nodeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "      ✓ Processos limpos!" -ForegroundColor Green
} else {
    Write-Host "      ✓ Nenhum processo Node rodando" -ForegroundColor Green
}
Write-Host ""

# Iniciar API
Write-Host "[2/3] Iniciando API (porta 4000)..." -ForegroundColor Yellow
$apiPath = Join-Path $PSScriptRoot "apps\api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$apiPath'; Write-Host 'Iniciando API...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal
Write-Host "      ✓ API iniciando em nova janela..." -ForegroundColor Green
Start-Sleep -Seconds 5
Write-Host ""

# Iniciar Frontend
Write-Host "[3/3] Iniciando Frontend (porta 3000)..." -ForegroundColor Yellow
$webPath = Join-Path $PSScriptRoot "apps\web"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webPath'; Write-Host 'Iniciando Frontend...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal
Write-Host "      ✓ Frontend iniciando em nova janela..." -ForegroundColor Green
Start-Sleep -Seconds 3
Write-Host ""

Write-Host "================================================================" -ForegroundColor Green
Write-Host " Sistema iniciado com sucesso!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Aguarde ~30 segundos para tudo compilar..." -ForegroundColor Yellow
Write-Host ""
Write-Host " URLs:" -ForegroundColor Cyan
Write-Host "   API:      http://localhost:4000/api/health" -ForegroundColor White
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host " Login:" -ForegroundColor Cyan
Write-Host "   Email: pokt@gmail.com" -ForegroundColor White
Write-Host "   Senha: 84005787" -ForegroundColor White
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Para parar: Feche as janelas 'API' e 'Frontend'" -ForegroundColor Gray
Write-Host ""

# Aguardar e testar
Write-Host "Aguardando servidores iniciarem (20 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

Write-Host ""
Write-Host "Testando conexões..." -ForegroundColor Cyan
Write-Host ""

# Testar API
try {
    $api = Invoke-RestMethod -Uri "http://localhost:4000/api/health" -TimeoutSec 5
    Write-Host "✓ API ONLINE!" -ForegroundColor Green
    Write-Host "  Status: $($api.status)" -ForegroundColor Gray
    Write-Host "  Version: $($api.version)" -ForegroundColor Gray
} catch {
    Write-Host "✗ API ainda não respondeu (aguarde mais um pouco)" -ForegroundColor Yellow
}

Write-Host ""

# Testar Frontend
try {
    $web = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Frontend ONLINE!" -ForegroundColor Green
    Write-Host "  Status HTTP: $($web.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Frontend ainda compilando (aguarde mais um pouco)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar este prompt..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

