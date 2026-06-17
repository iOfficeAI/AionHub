# 小龙虾修图技能 - 启动器
$ErrorActionPreference = "Continue"
$SkillRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script = Join-Path $SkillRoot "node修图.js"
$Cmd = $args

if ($args.Count -eq 0) {
    Write-Host "🦞 小龙虾修图技能"
    Write-Host "用法: 修图技能.ps1 命令 参数"
    Write-Host "命令: info compress resize format crop rotate flipv fliph blur sharpen negate bw watermark"
    Write-Host "示例: 修图技能.ps1 info `"D:\图片\a.jpg`""
    Write-Host "示例: 修图技能.ps1 compress `"a.jpg`" `"b.jpg`" 70"
    exit 0
}

& node $Script $Cmd
