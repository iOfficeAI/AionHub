param(
  [string]$PackageRoot
)

$ErrorActionPreference = "Stop"

if (-not $PackageRoot) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $skillRoot = Split-Path -Parent $scriptDir
  $PackageRoot = Split-Path -Parent (Split-Path -Parent $skillRoot)
}

function Find-Tool {
  param([string]$Name, [string[]]$Bundled)
  foreach ($candidate in $Bundled) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }
  return $null
}

$bin = Join-Path $PackageRoot "bin\win"
$tools = [ordered]@{
  ffmpeg = Find-Tool "ffmpeg" @((Join-Path $bin "ffmpeg.exe"))
  ffprobe = Find-Tool "ffprobe" @((Join-Path $bin "ffprobe.exe"))
  "whisper.cpp" = Find-Tool "whisper-cli" @((Join-Path $bin "whisper-cli.exe"), (Join-Path $bin "whisper\whisper-cli.exe"))
  piper = Find-Tool "piper" @((Join-Path $bin "piper.exe"), (Join-Path $bin "piper\piper.exe"))
}

$models = [ordered]@{
  "whisper models" = Join-Path $PackageRoot "models\whisper.cpp"
  "piper models" = Join-Path $PackageRoot "models\piper"
}

Write-Host "Package root: $PackageRoot"
Write-Host ""
Write-Host "Tools:"
foreach ($key in $tools.Keys) {
  if ($tools[$key]) {
    Write-Host "  OK      $key -> $($tools[$key])"
  } else {
    Write-Host "  MISSING $key"
  }
}

Write-Host ""
Write-Host "Model folders:"
foreach ($key in $models.Keys) {
  if (Test-Path -LiteralPath $models[$key]) {
    $count = @(Get-ChildItem -LiteralPath $models[$key] -File -ErrorAction SilentlyContinue).Count
    Write-Host "  OK      $key -> $($models[$key]) ($count files)"
  } else {
    Write-Host "  MISSING $key -> $($models[$key])"
  }
}
