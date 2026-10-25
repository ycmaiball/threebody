<#
.SYNOPSIS
    三体档案 · 本地预览脚本

.DESCRIPTION
    启动零依赖本地服务器预览网站，并自动打开浏览器。

.PARAMETER Port
    端口号，默认 4173。

.PARAMETER NoBrowser
    不自动打开浏览器。

.EXAMPLE
    .\preview.ps1
    .\preview.ps1 -Port 8080
#>

[CmdletBinding()]
param(
    [int]$Port = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
if (-not (Test-Path (Join-Path $Root 'dev-server.js'))) {
    $Root = $PSScriptRoot
}

Write-Host ''
Write-Host '  三体档案 · 本地预览' -ForegroundColor Cyan
Write-Host '  ──────────────────────────────────' -ForegroundColor DarkGray

# 查找 node
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
        'C:\Users\ycm\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
    )
    $node = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $node) {
    Write-Host '  ! 未找到 node，无法启动本地服务器。' -ForegroundColor Yellow
    Write-Host '' 
    Write-Host '  不过本项目是纯静态站点，你也可以直接双击 index.html 预览。' -ForegroundColor Gray
    Write-Host ''
    if (-not $NoBrowser) { Start-Process (Join-Path $Root 'index.html') }
    exit 0
}

Write-Host "  · node: $node" -ForegroundColor DarkGray
Write-Host "  · 目录: $Root" -ForegroundColor DarkGray
Write-Host "  · 地址: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host ''

if (-not $NoBrowser) {
    Start-Job -ScriptBlock {
        param($u)
        Start-Sleep -Seconds 2
        Start-Process $u
    } -ArgumentList "http://127.0.0.1:$Port" | Out-Null
}

Write-Host '  按 Ctrl+C 停止' -ForegroundColor DarkGray
Write-Host ''

& $node (Join-Path $Root 'dev-server.js') $Port