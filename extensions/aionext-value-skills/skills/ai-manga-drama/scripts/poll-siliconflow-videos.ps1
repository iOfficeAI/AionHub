param(
  [Parameter(Mandatory = $true)]
  [string]$JobsPath,

  [string]$ConfigPath = "",

  [string]$ClipsDir,

  [switch]$Download,

  [int]$PollIntervalSec = 20,

  [int]$TimeoutMin = 30
)

$ErrorActionPreference = "Stop"

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "File not found: $Path"
  }
  return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Save-JsonFile($Object, [string]$Path) {
  $Object | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$jobsFile = [System.IO.Path]::GetFullPath($JobsPath)
$jobsDir = Split-Path -Parent $jobsFile
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $skillRoot = Split-Path -Parent $PSScriptRoot
  $ConfigPath = Join-Path $skillRoot "config\siliconflow.config.json"
}
$state = Read-JsonFile $jobsFile
$config = if (Test-Path -LiteralPath $ConfigPath) { Read-JsonFile $ConfigPath } else { [pscustomobject]@{} }
$baseUrl = if ($state.base_url) { $state.base_url } elseif ($config.base_url) { $config.base_url } else { "https://api.siliconflow.cn/v1" }
$baseUrl = $baseUrl.TrimEnd("/")
$apiKey = if ($env:SILICONFLOW_API_KEY) { $env:SILICONFLOW_API_KEY } elseif ($config.api_key) { $config.api_key } else { "" }

if ([string]::IsNullOrWhiteSpace($apiKey) -or $apiKey -like "在这里填*") {
  throw "Missing API key. Fill $ConfigPath api_key or set SILICONFLOW_API_KEY."
}

if (-not $ClipsDir) {
  $ClipsDir = Join-Path $jobsDir "assets\clips"
}
if ($Download -and -not (Test-Path -LiteralPath $ClipsDir)) {
  New-Item -ItemType Directory -Force -Path $ClipsDir | Out-Null
}

$headers = @{
  Authorization = "Bearer $apiKey"
  "Content-Type" = "application/json"
}

$deadline = (Get-Date).AddMinutes($TimeoutMin)
do {
  $pending = 0
  foreach ($job in @($state.jobs)) {
    if (-not $job.requestId) {
      continue
    }
    if ($job.status -eq "Succeed" -or $job.status -eq "Failed") {
      continue
    }

    $body = @{ requestId = "$($job.requestId)" } | ConvertTo-Json -Compress
    Write-Host "Polling $($job.id) $($job.requestId)..."
    try {
      $response = Invoke-RestMethod -Method Post -Uri "$baseUrl/video/status" -Headers $headers -Body $body
      $job.status = "$($response.status)"
      $job.reason = "$($response.reason)"
      $job.updated_at = (Get-Date).ToString("s")

      if ($response.status -eq "Succeed") {
        $url = $null
        if ($response.results -and $response.results.videos -and $response.results.videos.Count -gt 0) {
          $url = $response.results.videos[0].url
        }
        $job.video_url = $url
        if ($Download -and $url) {
          $clipPath = Join-Path $ClipsDir ("$($job.id).mp4")
          Invoke-WebRequest -Uri $url -OutFile $clipPath -TimeoutSec $(if ($config.download_timeout_sec) { [int]$config.download_timeout_sec } else { 300 })
          $job.local_video = $clipPath
          Write-Host "Downloaded: $clipPath"
        }
      } elseif ($response.status -eq "Failed") {
        Write-Warning "Job $($job.id) failed: $($response.reason)"
      } else {
        $pending++
      }
    } catch {
      $job.status = "PollError"
      $job.error = $_.Exception.Message
      $job.updated_at = (Get-Date).ToString("s")
      Write-Warning "Poll error for $($job.id): $($_.Exception.Message)"
      $pending++
    }
  }

  Save-JsonFile $state $jobsFile
  if ($pending -le 0) {
    break
  }
  if ((Get-Date) -lt $deadline) {
    Write-Host "Waiting $PollIntervalSec seconds; pending jobs: $pending"
    Start-Sleep -Seconds $PollIntervalSec
  }
} while ((Get-Date) -lt $deadline)

Write-Host "Updated job state: $jobsFile"
