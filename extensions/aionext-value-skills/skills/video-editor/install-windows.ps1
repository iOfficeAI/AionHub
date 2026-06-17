param(
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Join-Path $Root "skills\video-editor"

Write-Host "剪辑技能 package: $Root"
Write-Host "Skill folder: $SkillDir"
Write-Host ""

& (Join-Path $SkillDir "scripts\check-env.ps1") -PackageRoot $Root

if ($CheckOnly) {
  exit 0
}

Write-Host ""
$openclaw = Get-Command openclaw -ErrorAction SilentlyContinue
if (-not $openclaw) {
  Write-Host "OpenClaw command not found on PATH."
  Write-Host "After installing OpenClaw, run:"
  Write-Host "  openclaw skills install `"$SkillDir`" --as video-editor"
  exit 0
}

Write-Host "Installing skill into OpenClaw..."
& $openclaw.Source skills install "$SkillDir" --as video-editor
Write-Host ""
Write-Host "Done. Restart OpenClaw/Codex if the skill list does not refresh immediately."
