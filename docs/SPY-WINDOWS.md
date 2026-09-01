# Ecoom SPY — Windows (dados móveis)

Corre o SPY no PC Windows com o IP dos dados móveis (hotspot / USB tether),
para a Meta não bloquear o IP da Wi‑Fi fixa.

## Requisitos

1. **Node.js** LTS — https://nodejs.org
2. Pasta do projecto em **`C:\EcoomTaskForce`** (ou define `SPY_WINDOWS_PROJECT_DIR`)
3. Telemóvel com **hotspot** ou **USB tether** — o Windows tem de sair pela rede móvel

## Setup (1×)

```bat
mkdir C:\EcoomTaskForce
:: Copia o conteúdo de "ECOOM TaskForce" para C:\EcoomTaskForce
cd /d C:\EcoomTaskForce
npm install --prefix apps\api
npx playwright install chromium
```

## Uso diário

1. Liga o Windows ao **hotspot do telemóvel** (desliga Wi‑Fi fixa no PC)
2. Abre Chrome → https://ecoomtaskforce.site/spy
3. Escolhe modo **Windows**
4. Clica **Activar** → descarrega `Ecoom-SPY-Activar-Windows.ps1`
5. Clique direito no ficheiro → **Executar com PowerShell**
6. Quando o agente ficar verde, lança a pesquisa — o scroll corre no PC

### Alternativa manual (PowerShell)

```powershell
$env:SPY_MOBILE_PATH='hotspot'
Set-Location 'C:\EcoomTaskForce'
node .\scripts\spy-mobile-bridge-local.js
```

Depois no site clica **Activar** de novo.

## Notas

- Deixa a janela PowerShell aberta enquanto pesquisas (porta `9780`)
- O Mac pode ficar na Wi‑Fi a trabalhar noutras coisas
- Se o IP não for validado como móvel, o Activar falha de propósito
