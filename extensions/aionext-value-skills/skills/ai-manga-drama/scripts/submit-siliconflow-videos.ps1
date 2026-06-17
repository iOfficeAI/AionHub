param(
  [Parameter(Mandatory = $true)]
  [string]$JobsPath,

  [string]$ConfigPath = "",

  [string]$OutputPath,

  [switch]$DryRun,

  [int]$Limit = 0
)

$ErrorActionPreference = "Stop"

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "File not found: $Path"
  }
  return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Resolve-JobPath([string]$Path, [string]$BaseDir) {
  if ([string]::IsNullOrWhiteSpace($Path)) {
    return $null
  }
  if ($Path -match '^https?://') {
    return $Path
  }
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }
  return [System.IO.Path]::GetFullPath((Join-Path $BaseDir $Path))
}

function Convert-ImageToDataUrl([string]$ImagePath) {
  if ($ImagePath -match '^https?://' -or $ImagePath -match '^data:image/') {
    return $ImagePath
  }
  if (-not (Test-Path -LiteralPath $ImagePath)) {
    throw "Image file not found: $ImagePath"
  }
  $ext = [System.IO.Path]::GetExtension($ImagePath).ToLowerInvariant()
  $mime = switch ($ext) {
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".webp" { "image/webp" }
    default { "image/png" }
  }
  $bytes = [System.IO.File]::ReadAllBytes($ImagePath)
  return "data:$mime;base64,$([Convert]::ToBase64String($bytes))"
}

function Add-IfValue($Table, [string]$Name, $Value) {
  if ($null -ne $Value -and "$Value".Trim().Length -gt 0) {
    $Table[$Name] = $Value
  }
}

$jobsFile = [System.IO.Path]::GetFullPath($JobsPath)
$jobsDir = Split-Path -Parent $jobsFile
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $skillRoot = Split-Path -Parent $PSScriptRoot
  $ConfigPath = Join-Path $skillRoot "config\siliconflow.config.json"
}
$plan = Read-JsonFile $jobsFile
$config = if (Test-Path -LiteralPath $ConfigPath) { Read-JsonFile $ConfigPath } else { [pscustomobject]@{} }

$baseUrl = if ($plan.defaults.base_url) { $plan.defaults.base_url } elseif ($config.base_url) { $config.base_url } else { "https://api.siliconflow.cn/v1" }
$baseUrl = $baseUrl.TrimEnd("/")
$apiKey = if ($env:SILICONFLOW_API_KEY) { $env:SILICONFLOW_API_KEY } elseif ($config.api_key) { $config.api_key } else { "" }

if (-not $OutputPath) {
  $suffix = if ($DryRun) { "requests.jsonl" } else { "results.json" }
  $OutputPath = Join-Path $jobsDir ("siliconflow-video-jobs.$suffix")
}

$selectedJobs = @($plan.jobs)
if ($Limit -gt 0) {
  $selectedJobs = @($selectedJobs | Select-Object -First $Limit)
}
if ($selectedJobs.Count -eq 0) {
  throw "No jobs found in $JobsPath"
}

$requests = New-Object System.Collections.Generic.List[object]
$results = New-Object System.Collections.Generic.List[object]
$modelT2V = if ($plan.defaults.model_t2v) { $plan.defaults.model_t2v } else { "Wan-AI/Wan2.2-T2V-A14B" }
$modelI2V = if ($plan.defaults.model_i2v) { $plan.defaults.model_i2v } else { "Wan-AI/Wan2.2-I2V-A14B" }
$imageSize = if ($plan.defaults.image_size) { $plan.defaults.image_size } elseif ($config.default_image_size) { $config.default_image_size } else { "720x1280" }
$negativePrompt = if ($plan.defaults.negative_prompt) { $plan.defaults.negative_prompt } else { "" }

foreach ($job in $selectedJobs) {
  $mode = if ($job.mode) { "$($job.mode)".ToLowerInvariant() } elseif ($job.image) { "i2v" } else { "t2v" }
  $body = [ordered]@{
    model = if ($mode -eq "i2v") { $modelI2V } else { $modelT2V }
    prompt = "$($job.prompt)"
    image_size = if ($job.image_size) { "$($job.image_size)" } else { "$imageSize" }
  }
  Add-IfValue $body "negative_prompt" $(if ($job.negative_prompt) { "$($job.negative_prompt)" } else { "$negativePrompt" })
  if ($null -ne $job.seed) {
    $body["seed"] = [int]$job.seed
  }
  if ($mode -eq "i2v") {
    if (-not $job.image) {
      throw "Job $($job.id) is i2v but has no image."
    }
    $imagePath = Resolve-JobPath "$($job.image)" $jobsDir
    $body["image"] = Convert-ImageToDataUrl $imagePath
  }

  $request = [ordered]@{
    id = "$($job.id)"
    mode = $mode
    url = "$baseUrl/video/submit"
    body = $body
  }
  $requests.Add([pscustomobject]$request) | Out-Null
}

if ($DryRun) {
  $lines = foreach ($request in $requests) {
    $request | ConvertTo-Json -Depth 20 -Compress
  }
  [System.IO.File]::WriteAllLines($OutputPath, $lines, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Dry-run request list written: $OutputPath"
  exit 0
}

if ([string]::IsNullOrWhiteSpace($apiKey) -or $apiKey -like "在这里填*") {
  throw "Missing API key. Fill $ConfigPath api_key or set SILICONFLOW_API_KEY."
}

$headers = @{
  Authorization = "Bearer $apiKey"
  "Content-Type" = "application/json"
}

foreach ($request in $requests) {
  $jsonBody = $request.body | ConvertTo-Json -Depth 20
  Write-Host "Submitting $($request.id) $($request.mode)..."
  try {
    $response = Invoke-RestMethod -Method Post -Uri $request.url -Headers $headers -Body $jsonBody
    $results.Add([pscustomobject]@{
      id = $request.id
      mode = $request.mode
      requestId = $response.requestId
      status = "Submitted"
      submitted_at = (Get-Date).ToString("s")
      body = $request.body
    }) | Out-Null
  } catch {
    $results.Add([pscustomobject]@{
      id = $request.id
      mode = $request.mode
      requestId = $null
      status = "SubmitFailed"
      error = $_.Exception.Message
      body = $request.body
    }) | Out-Null
  }
}

$outObj = [ordered]@{
  project = $plan.project
  episode = $plan.episode
  base_url = $baseUrl
  jobs = $results
}
$outObj | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host "Submit results written: $OutputPath"
