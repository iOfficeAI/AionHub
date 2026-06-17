param(
  [Parameter(Mandatory = $true)]
  [string]$PlanPath,

  [string]$ConfigPath
)

$ErrorActionPreference = "Stop"

function Resolve-PlanPath {
  param([string]$BaseDir, [string]$PathValue)
  if (-not $PathValue) { return $null }
  if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
  return [System.IO.Path]::GetFullPath((Join-Path $BaseDir $PathValue))
}

function Test-Placeholder {
  param([string]$Value)
  if (-not $Value) { return $true }
  return $Value -match "FILL_|fill-this|your-|OPTIONAL_"
}

function Assert-Configured {
  param($Config, [string]$Mode)
  $missing = New-Object System.Collections.Generic.List[string]

  if ($Mode -eq "doudian") {
    foreach ($name in @("app_key", "app_secret", "access_token")) {
      if (Test-Placeholder ([string]$Config.doudian.$name)) { $missing.Add("doudian.$name") }
    }
  } elseif ($Mode -eq "goodlife") {
    foreach ($name in @("client_key", "client_secret", "access_token")) {
      if (Test-Placeholder ([string]$Config.goodlife.$name)) { $missing.Add("goodlife.$name") }
    }
  } else {
    throw "Unsupported Douyin mode: $Mode. Use doudian or goodlife."
  }

  if ($missing.Count -gt 0) {
    throw "Please fill config values first: $($missing -join ', ')"
  }
}

function New-DoudianRequest {
  param($Item, $Config)
  $action = ([string]$Item.action).ToLowerInvariant()
  if ($action -in @("launch", "publish", "online")) {
    $path = "/product/launchProduct"
    $normalizedAction = "launch"
  } elseif ($action -in @("offline", "unpublish")) {
    $path = "/product/setOffline"
    $normalizedAction = "offline"
  } else {
    throw "Unsupported doudian action for SKU $($Item.sku): $($Item.action)"
  }

  if (Test-Placeholder ([string]$Item.product_id)) {
    throw "Missing product_id for SKU $($Item.sku)"
  }

  return [ordered]@{
    platform = "douyin_doudian"
    action = $normalizedAction
    method = "POST"
    endpoint = "$($Config.doudian.base_url)$path"
    api_path = $path
    auth = @{
      app_key = $Config.doudian.app_key
      access_token = "CONFIGURED"
      signature_required = $true
    }
    payload = [ordered]@{
      product_id = [string]$Item.product_id
    }
    meta = [ordered]@{
      sku = [string]$Item.sku
      current_status = [string]$Item.current_status
      target_status = [string]$Item.target_status
      reason = [string]$Item.reason
    }
  }
}

function New-GoodlifeRequest {
  param($Item, $Config)
  $action = ([string]$Item.action).ToLowerInvariant()
  if ($action -in @("launch", "publish", "online")) {
    $opType = 1
    $normalizedAction = "online"
  } elseif ($action -in @("offline", "unpublish")) {
    $opType = 2
    $normalizedAction = "offline"
  } elseif ($action -in @("delete")) {
    $opType = 3
    $normalizedAction = "delete"
  } else {
    throw "Unsupported goodlife action for SKU $($Item.sku): $($Item.action)"
  }

  if (Test-Placeholder ([string]$Item.product_id)) {
    throw "Missing product_id for SKU $($Item.sku)"
  }

  return [ordered]@{
    platform = "douyin_goodlife"
    action = $normalizedAction
    method = "POST"
    endpoint = "$($Config.goodlife.base_url)/goodlife/v1/goods/product/operate/"
    auth = @{
      client_key = $Config.goodlife.client_key
      access_token = "CONFIGURED"
    }
    payload = [ordered]@{
      product_id = [string]$Item.product_id
      op_type = $opType
    }
    meta = [ordered]@{
      sku = [string]$Item.sku
      current_status = [string]$Item.current_status
      target_status = [string]$Item.target_status
      reason = [string]$Item.reason
    }
  }
}

$planFullPath = [System.IO.Path]::GetFullPath($PlanPath)
$planDir = Split-Path -Parent $planFullPath
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillRoot = Split-Path -Parent $scriptDir
$packageRoot = Split-Path -Parent (Split-Path -Parent $skillRoot)

if (-not $ConfigPath) {
  $ConfigPath = Join-Path $packageRoot "config\douyin-api.config.json"
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  $template = Join-Path $packageRoot "config\douyin-api.config.template.json"
  throw "Missing config file: $ConfigPath. Copy template first: $template"
}

$plan = Get-Content -LiteralPath $planFullPath -Raw | ConvertFrom-Json
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$mode = ([string]$plan.mode).ToLowerInvariant()
Assert-Configured $config $mode

if (-not $plan.items -or $plan.items.Count -eq 0) {
  throw "Plan must include items."
}

$outputRequests = Resolve-PlanPath $planDir $plan.output_requests
if (-not $outputRequests) { $outputRequests = Join-Path $planDir "..\exports\douyin-api-requests.jsonl" }
$previewReport = Resolve-PlanPath $planDir $plan.preview_report
if (-not $previewReport) { $previewReport = Join-Path $planDir "..\exports\douyin-api-preview.md" }

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputRequests), (Split-Path -Parent $previewReport) | Out-Null

$requests = New-Object System.Collections.Generic.List[object]
foreach ($item in $plan.items) {
  if ($mode -eq "doudian") {
    $requests.Add((New-DoudianRequest $item $config))
  } elseif ($mode -eq "goodlife") {
    $requests.Add((New-GoodlifeRequest $item $config))
  }
}

$jsonLines = foreach ($req in $requests) {
  $req | ConvertTo-Json -Depth 20 -Compress
}
$jsonLines | Set-Content -LiteralPath $outputRequests -Encoding UTF8

$counts = $requests | Group-Object action | Sort-Object Name
$preview = @(
  "# Douyin API Request Preview",
  "",
  "- Mode: $mode",
  "- Dry run: $($plan.dry_run)",
  "- Request count: $($requests.Count)",
  "- Output JSONL: $outputRequests",
  "- Live execution: disabled in this package by default",
  "",
  "## Actions"
)
foreach ($count in $counts) {
  $preview += "- $($count.Name): $($count.Count)"
}
$preview += ""
$preview += "## Next Steps"
$preview += "1. Review the JSONL request file."
$preview += "2. Confirm product IDs, SKU mapping, target status, and reason."
$preview += "3. Connect a signed Douyin API executor only after explicit user confirmation."

$preview | Set-Content -LiteralPath $previewReport -Encoding UTF8

Write-Host "Wrote requests: $outputRequests"
Write-Host "Preview: $previewReport"
