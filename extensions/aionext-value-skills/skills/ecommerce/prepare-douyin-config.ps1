$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Template = Join-Path $Root "config\douyin-api.config.template.json"
$Config = Join-Path $Root "config\douyin-api.config.json"

if (-not (Test-Path -LiteralPath $Template)) {
  throw "Missing template: $Template"
}

if (Test-Path -LiteralPath $Config) {
  Write-Host "Config already exists:"
  Write-Host "  $Config"
  Write-Host "Edit this file and fill Douyin credentials."
  exit 0
}

Copy-Item -LiteralPath $Template -Destination $Config
Write-Host "Created:"
Write-Host "  $Config"
Write-Host ""
Write-Host "Fill these fields before generating live-ready requests:"
Write-Host "  doudian.app_key"
Write-Host "  doudian.app_secret"
Write-Host "  doudian.access_token"
Write-Host "  goodlife.client_key"
Write-Host "  goodlife.client_secret"
Write-Host "  goodlife.access_token"
