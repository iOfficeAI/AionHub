param(
  [Parameter(Mandatory = $true)]
  [string]$PlanPath,

  [string]$FfmpegPath,
  [string]$FfprobePath
)

$ErrorActionPreference = "Stop"

function Resolve-PlanPath {
  param([string]$BaseDir, [string]$PathValue)
  if (-not $PathValue) { return $null }
  if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
  return [System.IO.Path]::GetFullPath((Join-Path $BaseDir $PathValue))
}

function Find-Tool {
  param([string]$Name, [string]$Bundled, [string]$Override)
  if ($Override -and (Test-Path -LiteralPath $Override)) { return $Override }
  if (Test-Path -LiteralPath $Bundled) { return $Bundled }
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "Missing required tool: $Name. Put it at $Bundled or add it to PATH."
}

function Escape-SubtitlePath {
  param([string]$PathValue)
  return ($PathValue -replace "\\", "/" -replace ":", "\:" -replace "'", "\\'")
}

$planFullPath = [System.IO.Path]::GetFullPath($PlanPath)
$planDir = Split-Path -Parent $planFullPath
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillRoot = Split-Path -Parent $scriptDir
$packageRoot = Split-Path -Parent (Split-Path -Parent $skillRoot)
$binDir = Join-Path $packageRoot "bin\win"

$ffmpeg = Find-Tool "ffmpeg" (Join-Path $binDir "ffmpeg.exe") $FfmpegPath
$ffprobe = Find-Tool "ffprobe" (Join-Path $binDir "ffprobe.exe") $FfprobePath

$plan = Get-Content -LiteralPath $planFullPath -Raw | ConvertFrom-Json
if (-not $plan.clips -or $plan.clips.Count -eq 0) {
  throw "edit_plan.json must include at least one clip."
}

$output = Resolve-PlanPath $planDir $plan.output
if (-not $output) {
  $output = Join-Path $planDir "output\final.mp4"
}

$width = if ($plan.format.width) { [int]$plan.format.width } else { 1080 }
$height = if ($plan.format.height) { [int]$plan.format.height } else { 1920 }
$fps = if ($plan.format.fps) { [int]$plan.format.fps } else { 30 }

$outDir = Split-Path -Parent $output
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$workDir = Join-Path $outDir "_video_editor_work"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$logPath = Join-Path $outDir "render.log"
"Rendering from $planFullPath" | Set-Content -LiteralPath $logPath -Encoding UTF8

$clipFiles = @()
$index = 0
foreach ($clip in $plan.clips) {
  $index++
  $source = Resolve-PlanPath $planDir $clip.file
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing clip file: $source"
  }

  $clipOut = Join-Path $workDir ("clip_{0:D3}.mp4" -f $index)
  $volume = if ($clip.volume -ne $null) { [double]$clip.volume } else { 1.0 }
  $vf = "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setsar=1"

  $args = @("-y")
  if ($clip.start) { $args += @("-ss", [string]$clip.start) }
  if ($clip.duration) { $args += @("-t", [string]$clip.duration) }
  $args += @("-i", $source, "-vf", $vf, "-af", "volume=$volume,aformat=sample_rates=48000:channel_layouts=stereo", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", $clipOut)

  Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ("ffmpeg " + ($args -join " "))
  & $ffmpeg @args 2>&1 | Add-Content -LiteralPath $logPath -Encoding UTF8
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed while rendering clip $index. See $logPath" }
  $clipFiles += $clipOut
}

$concatList = Join-Path $workDir "concat.txt"
$clipFiles | ForEach-Object {
  $safe = ($_ -replace "'", "'\''")
  "file '$safe'"
} | Set-Content -LiteralPath $concatList -Encoding ASCII

$baseVideo = Join-Path $workDir "base.mp4"
$args = @("-y", "-f", "concat", "-safe", "0", "-i", $concatList, "-c", "copy", $baseVideo)
Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ("ffmpeg " + ($args -join " "))
& $ffmpeg @args 2>&1 | Add-Content -LiteralPath $logPath -Encoding UTF8
if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed while concatenating clips. See $logPath" }

$currentVideo = $baseVideo

if ($plan.subtitles -and $plan.subtitles.file -and $plan.subtitles.burn) {
  $subtitlePath = Resolve-PlanPath $planDir $plan.subtitles.file
  if (-not (Test-Path -LiteralPath $subtitlePath)) { throw "Missing subtitle file: $subtitlePath" }
  $subbedVideo = Join-Path $workDir "subtitled.mp4"
  $subFilter = "subtitles='" + (Escape-SubtitlePath $subtitlePath) + "'"
  $args = @("-y", "-i", $currentVideo, "-vf", $subFilter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "copy", $subbedVideo)
  Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ("ffmpeg " + ($args -join " "))
  & $ffmpeg @args 2>&1 | Add-Content -LiteralPath $logPath -Encoding UTF8
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed while burning subtitles. See $logPath" }
  $currentVideo = $subbedVideo
}

$audioInputs = @()
$filterParts = @()
$mixLabels = @()
$inputArgs = @("-i", $currentVideo)

if ($plan.voiceover -and $plan.voiceover.file) {
  $voice = Resolve-PlanPath $planDir $plan.voiceover.file
  if (-not (Test-Path -LiteralPath $voice)) { throw "Missing voiceover file: $voice" }
  $voiceVol = if ($plan.voiceover.volume -ne $null) { [double]$plan.voiceover.volume } else { 1.0 }
  $inputArgs += @("-i", $voice)
  $audioInputs += @{ Index = $audioInputs.Count + 1; Volume = $voiceVol; Label = "voice" }
}

if ($plan.music -and $plan.music.file) {
  $music = Resolve-PlanPath $planDir $plan.music.file
  if (-not (Test-Path -LiteralPath $music)) { throw "Missing music file: $music" }
  $musicVol = if ($plan.music.volume -ne $null) { [double]$plan.music.volume } else { 0.18 }
  $inputArgs += @("-stream_loop", "-1", "-i", $music)
  $audioInputs += @{ Index = $audioInputs.Count + 1; Volume = $musicVol; Label = "music" }
}

if ($audioInputs.Count -gt 0) {
  $mixed = Join-Path $workDir "mixed.mp4"
  $filterParts += "[0:a]volume=1.0[a0]"
  $mixLabels += "[a0]"
  foreach ($audio in $audioInputs) {
    $label = "a$($audio.Index)"
    $filterParts += "[$($audio.Index):a]volume=$($audio.Volume),aformat=sample_rates=48000:channel_layouts=stereo[$label]"
    $mixLabels += "[$label]"
  }
  $filterParts += (($mixLabels -join "") + "amix=inputs=$($mixLabels.Count):duration=first:dropout_transition=2[aout]")
  $filter = $filterParts -join ";"
  $args = @("-y") + $inputArgs + @("-filter_complex", $filter, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", $mixed)
  Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ("ffmpeg " + ($args -join " "))
  & $ffmpeg @args 2>&1 | Add-Content -LiteralPath $logPath -Encoding UTF8
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed while mixing audio. See $logPath" }
  $currentVideo = $mixed
}

Copy-Item -LiteralPath $currentVideo -Destination $output -Force
$duration = & $ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $output 2>$null
Add-Content -LiteralPath $logPath -Encoding UTF8 -Value "Output: $output"
Add-Content -LiteralPath $logPath -Encoding UTF8 -Value "Duration: $duration"
Write-Host "Rendered: $output"
Write-Host "Log: $logPath"
