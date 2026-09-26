# Vercel に app フォルダを本番デプロイする（PowerShell で実行: .\dev\deploy_vercel.ps1）
# PC名が日本語のままだと Vercel CLI が落ちるため、hostname を差し替えてから実行します
$root = Split-Path $PSScriptRoot -Parent
$env:NODE_OPTIONS = "--require " + (Join-Path $PSScriptRoot "patch_hostname.cjs").Replace('\', '/')
Set-Location (Join-Path $root "app")
vercel deploy --prod --yes
