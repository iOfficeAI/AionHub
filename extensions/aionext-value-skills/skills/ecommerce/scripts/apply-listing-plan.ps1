param(
  [Parameter(Mandatory = $true)]
  [string]$PlanPath
)

$ErrorActionPreference = "Stop"

function Resolve-PlanPath {
  param([string]$BaseDir, [string]$PathValue)
  if (-not $PathValue) { return $null }
  if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
  return [System.IO.Path]::GetFullPath((Join-Path $BaseDir $PathValue))
}

function Get-FieldValue {
  param($Row, [string]$Name)
  if ($Row.PSObject.Properties.Name -contains $Name) {
    return [string]$Row.$Name
  }
  return ""
}

$planFullPath = [System.IO.Path]::GetFullPath($PlanPath)
$planDir = Split-Path -Parent $planFullPath
$plan = Get-Content -LiteralPath $planFullPath -Raw | ConvertFrom-Json

$sourceFile = Resolve-PlanPath $planDir $plan.source_file
$outputFile = Resolve-PlanPath $planDir $plan.output_file
$previewFile = Resolve-PlanPath $planDir $plan.preview_report

if (-not (Test-Path -LiteralPath $sourceFile)) {
  throw "Missing source CSV: $sourceFile"
}
if (-not $outputFile) {
  $outputFile = Join-Path $planDir "exports\listing-update.csv"
}
if (-not $previewFile) {
  $previewFile = Join-Path $planDir "exports\listing-preview.md"
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputFile), (Split-Path -Parent $previewFile) | Out-Null

$rows = Import-Csv -LiteralPath $sourceFile
$changed = New-Object System.Collections.Generic.List[object]
$rejected = New-Object System.Collections.Generic.List[object]

$seen = @{}
foreach ($row in $rows) {
  $sku = Get-FieldValue $row "sku"
  if (-not $sku) {
    $rejected.Add([pscustomobject]@{ sku = ""; reason = "Missing SKU" })
    continue
  }
  if ($seen.ContainsKey($sku)) {
    $rejected.Add([pscustomobject]@{ sku = $sku; reason = "Duplicate SKU" })
    continue
  }
  $seen[$sku] = $true
}

foreach ($rule in $plan.rules) {
  $skuSet = @{}
  if ($rule.match -and $rule.match.sku_in) {
    foreach ($sku in $rule.match.sku_in) {
      $skuSet[[string]$sku] = $true
    }
  }

  foreach ($row in $rows) {
    $sku = Get-FieldValue $row "sku"
    if (-not $sku -or $skuSet.Count -eq 0 -or -not $skuSet.ContainsKey($sku)) {
      continue
    }

    $action = [string]$rule.action
    $target = [string]$rule.target_status
    if (-not $action -or -not $target) {
      $rejected.Add([pscustomobject]@{ sku = $sku; reason = "Rule missing action or target_status" })
      continue
    }

    $changed.Add([pscustomobject]@{
      sku = $sku
      title = Get-FieldValue $row "title"
      action = $action
      current_status = Get-FieldValue $row "current_status"
      target_status = $target
      price = Get-FieldValue $row "price"
      stock = Get-FieldValue $row "stock"
      category = Get-FieldValue $row "category"
      reason = [string]$rule.reason
    })
  }
}

$changed | Export-Csv -LiteralPath $outputFile -NoTypeInformation -Encoding UTF8

$publishCount = @($changed | Where-Object { $_.action -eq "publish" }).Count
$unpublishCount = @($changed | Where-Object { $_.action -eq "unpublish" }).Count
$updateCount = @($changed | Where-Object { $_.action -eq "update" }).Count
$deleteCount = @($changed | Where-Object { $_.action -eq "delete" }).Count

$preview = @(
  "# Listing Preview",
  "",
  "- Platform: $($plan.platform)",
  "- Dry run: $($plan.dry_run)",
  "- Source rows: $($rows.Count)",
  "- Changed rows: $($changed.Count)",
  "- Publish: $publishCount",
  "- Unpublish: $unpublishCount",
  "- Update: $updateCount",
  "- Delete: $deleteCount",
  "- Rejected rows: $($rejected.Count)",
  "",
  "Output CSV: $outputFile"
)

if ($rejected.Count -gt 0) {
  $rejectedFile = Join-Path (Split-Path -Parent $outputFile) "rejected-rows.csv"
  $rejected | Export-Csv -LiteralPath $rejectedFile -NoTypeInformation -Encoding UTF8
  $preview += "- Rejected CSV: $rejectedFile"
}

$preview | Set-Content -LiteralPath $previewFile -Encoding UTF8

Write-Host "Wrote: $outputFile"
Write-Host "Preview: $previewFile"
