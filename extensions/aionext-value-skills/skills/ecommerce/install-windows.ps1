param(
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = $Root

Write-Host "电商上下架技能 folder: $Root"
Write-Host "Skill folder: $SkillDir"
Write-Host ""

if (-not (Test-Path -LiteralPath (Join-Path $SkillDir "SKILL.md"))) {
  throw "Missing SKILL.md: $SkillDir"
}

Write-Host "OK ecommerce skill found."
Write-Host "Examples:"
Write-Host "  $Root\examples\listing-template.csv"
Write-Host "  $Root\examples\listing-plan.json"
Write-Host "  $Root\examples\douyin-doudian-plan.json"
Write-Host "  $Root\examples\douyin-goodlife-plan.json"
Write-Host ""
Write-Host "Douyin API config template:"
Write-Host "  $Root\config\douyin-api.config.template.json"
Write-Host "Copy it to:"
Write-Host "  $Root\config\douyin-api.config.json"
Write-Host "Then fill app_key/app_secret/access_token and shop/account fields."

if ($CheckOnly) {
  exit 0
}

$openclaw = Get-Command openclaw -ErrorAction SilentlyContinue
if (-not $openclaw) {
  Write-Host ""
  Write-Host "OpenClaw command not found on PATH."
  Write-Host "After installing OpenClaw, run:"
  Write-Host "  openclaw skills install `"$SkillDir`" --as ecommerce"
  exit 0
}

Write-Host ""
Write-Host "Installing skill into OpenClaw..."
& $openclaw.Source skills install "$SkillDir" --as ecommerce
Write-Host "Done. Restart OpenClaw/Codex if the skill list does not refresh immediately."
