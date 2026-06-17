param(
  [ValidateSet("base", "small")]
  [string]$WhisperModel = "base",

  [switch]$SkipPiperVoice
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Bin = Join-Path $Root "bin\win"
$Cache = Join-Path $Root "_downloads"
$WhisperModelDir = Join-Path $Root "models\whisper.cpp"
$PiperModelDir = Join-Path $Root "models\piper"

New-Item -ItemType Directory -Force -Path $Bin, $Cache, $WhisperModelDir, $PiperModelDir | Out-Null

function Download-File {
  param([string]$Url, [string]$OutFile)
  if (Test-Path -LiteralPath $OutFile) {
    Write-Host "Already downloaded: $OutFile"
    return
  }
  Write-Host "Downloading: $Url"
  Invoke-WebRequest -Uri $Url -OutFile $OutFile
}

function Expand-Zip {
  param([string]$ZipPath, [string]$Destination)
  $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
  $resolvedDestination = [System.IO.Path]::GetFullPath($Destination)
  if (-not $resolvedDestination.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clear destination outside package root: $resolvedDestination"
  }
  if (Test-Path -LiteralPath $Destination) {
    Remove-Item -LiteralPath $Destination -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $Destination -Force
}

Write-Host "Package root: $Root"

# FFmpeg release essentials from Gyan.dev includes ffmpeg.exe and ffprobe.exe.
$ffmpegZip = Join-Path $Cache "ffmpeg-release-essentials.zip"
$ffmpegExtract = Join-Path $Cache "ffmpeg"
Download-File "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" $ffmpegZip
Expand-Zip $ffmpegZip $ffmpegExtract
Copy-Item -LiteralPath (Get-ChildItem -LiteralPath $ffmpegExtract -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1).FullName -Destination (Join-Path $Bin "ffmpeg.exe") -Force
Copy-Item -LiteralPath (Get-ChildItem -LiteralPath $ffmpegExtract -Recurse -Filter "ffprobe.exe" | Select-Object -First 1).FullName -Destination (Join-Path $Bin "ffprobe.exe") -Force

# whisper.cpp official Windows x64 release.
$whisperZip = Join-Path $Cache "whisper-bin-x64.zip"
$whisperExtract = Join-Path $Bin "whisper"
Download-File "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.6/whisper-bin-x64.zip" $whisperZip
Expand-Zip $whisperZip $whisperExtract

$modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$WhisperModel.bin"
Download-File $modelUrl (Join-Path $WhisperModelDir "ggml-$WhisperModel.bin")

# Piper Windows runtime and a Mandarin voice. Piper's original repo is archived but the v1.2.0 asset remains available.
$piperZip = Join-Path $Cache "piper_windows_amd64.zip"
$piperExtract = Join-Path $Bin "piper"
Download-File "https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_windows_amd64.zip" $piperZip
Expand-Zip $piperZip $piperExtract

if (-not $SkipPiperVoice) {
  Download-File "https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx" (Join-Path $PiperModelDir "zh_CN-huayan-medium.onnx")
  Download-File "https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx.json" (Join-Path $PiperModelDir "zh_CN-huayan-medium.onnx.json")
}

Write-Host ""
& (Join-Path $Root "skills\video-editor\scripts\check-env.ps1") -PackageRoot $Root
Write-Host ""
Write-Host "Dependencies are ready in: $Root"
