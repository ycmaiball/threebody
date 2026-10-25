<#
.SYNOPSIS
    三体档案 - 一键部署脚本(GitHub + Vercel)

.DESCRIPTION
    自动完成：环境检测 -> git 准备 -> 仓库初始化 -> 提交 -> 推送到 GitHub。
    若检测到 git 未安装，会给出安装指引(可选用 winget 自动安装)。

    Vercel 部分：推送成功后给出导入指引，或在检测到 vercel CLI 时自动部署。

.PARAMETER RepoUrl
    GitHub 仓库地址，例如 https://github.com/yourname/three-body-site.git
    未提供时会交互式询问。

.PARAMETER Message
    提交信息，默认 "feat: 三体沉浸式设定集网站"。

.PARAMETER UseVercelCli
    推送后尝试用 Vercel CLI 部署(需已安装并登录)。

.PARAMETER DryRun
    只做检测与预演，不实际执行 git 写操作。

.EXAMPLE
    .\deploy.ps1 -RepoUrl https://github.com/yourname/three-body-site.git

.EXAMPLE
    .\deploy.ps1 -DryRun
#>

[CmdletBinding()]
param(
    [string]$RepoUrl,
    [string]$Message = 'feat: 三体沉浸式设定集网站',
    [switch]$UseVercelCli,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$script:StepNo = 0

# ---------- 输出工具 ----------
function Write-Head($t) {
    Write-Host ''
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  $t" -ForegroundColor Cyan
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
}
function Write-Step($t) {
    $script:StepNo++
    Write-Host ''
    Write-Host "[$script:StepNo] $t" -ForegroundColor White
}
function Write-Ok($t)   { Write-Host "    [OK] $t" -ForegroundColor Green }
function Write-Warn2($t) { Write-Host "    ! $t" -ForegroundColor Yellow }
function Write-Err2($t) { Write-Host "    [X] $t" -ForegroundColor Red }
function Write-Info($t) { Write-Host "    - $t" -ForegroundColor DarkGray }

function Fail($msg, $hint) {
    Write-Err2 $msg
    if ($hint) { Write-Host ''; Write-Host "  解决建议：$hint" -ForegroundColor Yellow }
    Write-Host ''
    exit 1
}

# ---------- 定位项目根目录 ----------
$Root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
if (-not (Test-Path (Join-Path $Root 'index.html'))) {
    # 允许脚本就放在项目根目录
    if (Test-Path (Join-Path $PSScriptRoot 'index.html')) { $Root = $PSScriptRoot }
    else { Fail "未找到 index.html，请在 three-body-site 项目目录内运行本脚本。" }
}

Write-Head '三体档案 - 一键部署'
Write-Info "项目目录: $Root"
if ($DryRun) { Write-Warn2 '预演模式(DryRun)：不会实际执行写操作' }

# ---------- 1. 检查必要文件 ----------
Write-Step '检查项目文件'

$required = @(
    'index.html', '404.html', 'vercel.json', 'package.json',
    'README.md', '.gitignore',
    'css/style.css', 'js/data.js', 'js/main.js'
)
$missing = @()
foreach ($f in $required) {
    $p = Join-Path $Root ($f -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path $p)) { $missing += $f }
}

if ($missing.Count -gt 0) {
    Fail ("缺少必要文件: " + ($missing -join ', ')) '请确认项目文件完整后再部署。'
}
Write-Ok "核心文件齐全($($required.Count) 项)"

# ---------- 2. 检测 git ----------
Write-Step '检测 git 环境'

$git = Get-Command git -ErrorAction SilentlyContinue
$gitExe = $null

if ($git) {
    $gitExe = $git.Source
    $ver = & $gitExe --version 2>$null
    Write-Ok "git 已安装：$ver"
} else {
    # 搜索常见安装位置
    $candidates = @(
        "$env:ProgramFiles\Git\cmd\git.exe",
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    )
    $found = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($found) {
        $gitExe = $found
        Write-Ok "在非 PATH 位置找到 git：$found"
        Write-Info '建议将该目录加入 PATH，或重启终端使 git 生效'
    }
}

if (-not $gitExe) {
    Write-Warn2 'git 未安装 ---- 无法通过命令行推送'
    Write-Host ''
    Write-Host '  +- 方案一：自动安装(推荐，需管理员权限)--------------' -ForegroundColor Yellow
    Write-Host '  |  winget install --id Git.Git -e --source winget' -ForegroundColor Gray
    Write-Host '  |  安装后[关闭并重开终端]，再运行本脚本' -ForegroundColor Gray
    Write-Host '  +- 方案二：手动下载 -----------------------------------' -ForegroundColor Yellow
    Write-Host '  |  https://git-scm.com/download/win' -ForegroundColor Gray
    Write-Host '  +- 方案三：完全无需安装(零安装路线)------------------' -ForegroundColor Yellow
    Write-Host '  |  1) 打开 https://github.com/new 创建空仓库' -ForegroundColor Gray
    Write-Host '  |  2) 选择 "uploading an existing file"' -ForegroundColor Gray
    Write-Host '  |  3) 把本项目全部文件拖入并提交' -ForegroundColor Gray
    Write-Host '  |  4) 到 https://vercel.com/new 导入该仓库即可' -ForegroundColor Gray
    Write-Host '  +-------------------------------------------------------' -ForegroundColor Yellow
    Write-Host ''
    Write-Info '详细步骤见 部署手册.md 的「路线 A：零安装部署」'

    # 尝试 winget 自动安装
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host ''
        $ans = Read-Host '  是否现在尝试用 winget 自动安装 git？(y/N)'
        if ($ans -match '^[yY]') {
            Write-Info '正在安装 git...(可能需要管理员权限)'
            try {
                & winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
                Write-Ok '安装命令已执行'
                Write-Warn2 '请[关闭并重新打开终端]，然后重新运行本脚本'
            } catch {
                Write-Err2 "自动安装失败：$_"
                Write-Info '请改用方案二或方案三'
            }
        }
    } else {
        Write-Info '未检测到 winget，请使用方案二或方案三'
    }
    Write-Host ''
    exit 1
}

# ---------- 3. git 用户身份 ----------
Write-Step '检查 git 身份配置'

$userName = (& $gitExe config --global user.name) 2>$null
$userMail = (& $gitExe config --global user.email) 2>$null

if ([string]::IsNullOrWhiteSpace($userName)) {
    $userName = Read-Host '    请输入 git 用户名(如 yourname)'
    if ([string]::IsNullOrWhiteSpace($userName)) { Fail '用户名不能为空' }
    if (-not $DryRun) { & $gitExe config --global user.name $userName }
    Write-Ok "已设置 user.name = $userName"
} else {
    Write-Ok "user.name  = $userName"
}

if ([string]::IsNullOrWhiteSpace($userMail)) {
    $userMail = Read-Host '    请输入 git 邮箱'
    if ([string]::IsNullOrWhiteSpace($userMail)) { Fail '邮箱不能为空' }
    if (-not $DryRun) { & $gitExe config --global user.email $userMail }
    Write-Ok "已设置 user.email = $userMail"
} else {
    Write-Ok "user.email = $userMail"
}

# 中文文件名显示
if (-not $DryRun) {
    & $gitExe config --global core.quotepath false 2>$null
}

# ---------- 4. 初始化仓库 ----------
Write-Step '初始化 git 仓库'

Push-Location $Root
try {
    $isRepo = Test-Path (Join-Path $Root '.git')

    if (-not $isRepo) {
        if ($DryRun) {
            Write-Info '将执行: git init'
        } else {
            & $gitExe init --quiet
            & $gitExe branch -M main 2>$null
            Write-Ok 'git 仓库已初始化(分支 main)'
        }
    } else {
        Write-Ok '已存在 git 仓库，跳过初始化'
    }

    # ---------- 5. 暂存与提交 ----------
    Write-Step '暂存文件并提交'

    if ($DryRun) {
        Write-Info '将执行: git add -A'
        Write-Info "将执行: git commit -m `"$Message`""
    } else {
        & $gitExe add -A
        $staged = (& $gitExe diff --cached --name-only) 2>$null
        $stagedCount = if ($staged) { @($staged).Count } else { 0 }

        if ($stagedCount -eq 0) {
            Write-Warn2 '没有需要提交的变更'
        } else {
            Write-Info "已暂存 $stagedCount 个文件"
            & $gitExe commit --quiet -m $Message
            if ($LASTEXITCODE -eq 0) {
                Write-Ok "提交完成: $Message"
            } else {
                Write-Warn2 '提交失败或无可提交内容'
            }
        }

        # 确认忽略规则生效
        $ignored = (& $gitExe status --porcelain --ignored) 2>$null
        if ($ignored -match 'node_modules|_shots|\.vercel') {
            Write-Ok '.gitignore 规则已生效'
        }
    }

    # ---------- 6. 关联远程仓库 ----------
    Write-Step '关联 GitHub 远程仓库'

    $existing = (& $gitExe remote get-url origin) 2>$null
    if ($existing) {
        Write-Ok "已存在 origin: $existing"
        $RepoUrl = $existing
    } else {
        if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
            Write-Host ''
            Write-Host '    请先在 https://github.com/new 创建一个[空仓库]' -ForegroundColor Yellow
            Write-Host '    (不要勾选 README / .gitignore / license)' -ForegroundColor Yellow
            Write-Host ''
            $RepoUrl = Read-Host '    粘贴仓库地址(如 https://github.com/yourname/three-body-site.git)'
        }

        if ([string]::IsNullOrWhiteSpace($RepoUrl)) { Fail '未提供仓库地址' }

        if ($RepoUrl -notmatch '^https://github\.com/.+/.+?(\.git)?$') {
            Write-Warn2 "地址格式可能不正确: $RepoUrl"
            Write-Info '预期格式: https://github.com/<用户名>/<仓库名>.git'
            $c = Read-Host '    仍要继续吗？(y/N)'
            if ($c -notmatch '^[yY]') { exit 1 }
        }

        if ($DryRun) {
            Write-Info "将执行: git remote add origin $RepoUrl"
        } else {
            & $gitExe remote add origin $RepoUrl
            Write-Ok "已关联 origin: $RepoUrl"
        }
    }

    # ---------- 7. 推送 ----------
    Write-Step '推送到 GitHub'

    if ($DryRun) {
        Write-Info '将执行: git push -u origin main'
    } else {
        Write-Info '正在推送(首次会弹出 GitHub 登录授权)...'
        & $gitExe push -u origin main
        if ($LASTEXITCODE -eq 0) {
            Write-Ok '推送成功'
        } else {
            Write-Err2 '推送失败'
            Write-Host ''
            Write-Host '  常见原因与解决：' -ForegroundColor Yellow
            Write-Host '  1) 认证失败 ---- GitHub 已停用密码推送：' -ForegroundColor Gray
            Write-Host '     改用 Personal Access Token(勾选 repo 权限)作为密码，' -ForegroundColor Gray
            Write-Host '     或安装 GitHub CLI 后执行: gh auth login' -ForegroundColor Gray
            Write-Host '  2) 远程有内容冲突 ---- 先执行: git pull --rebase origin main' -ForegroundColor Gray
            Write-Host '  3) 仓库不存在 ---- 请先在 GitHub 网页端创建空仓库' -ForegroundColor Gray
            Write-Host ''
            exit 1
        }
    }

    # ---------- 8. Vercel ----------
    Write-Step '部署到 Vercel'

    $vercel = Get-Command vercel -ErrorAction SilentlyContinue
    if ($UseVercelCli -and $vercel) {
        Write-Info '正在用 Vercel CLI 部署...'
        if ($DryRun) {
            Write-Info '将执行: vercel --prod'
        } else {
            & vercel --prod
            if ($LASTEXITCODE -eq 0) { Write-Ok 'Vercel 部署完成' }
            else { Write-Warn2 'Vercel CLI 部署未成功，可改用网页导入' }
        }
    } elseif ($UseVercelCli -and -not $vercel) {
        Write-Warn2 '未检测到 vercel CLI'
        Write-Info '安装: npm i -g vercel'
    } else {
        Write-Host ''
        Write-Host '  +-- 最后一步：部署到 Vercel ---------------------------' -ForegroundColor Cyan
        Write-Host '  |  1) 打开 https://vercel.com/new' -ForegroundColor Gray
        Write-Host '  |  2) 用 GitHub 账号登录并授权' -ForegroundColor Gray
        Write-Host '  |  3) 选择刚推送的仓库 -> Import' -ForegroundColor Gray
        Write-Host '  |  4) 配置全部留空(纯静态站，无构建步骤)-> Deploy' -ForegroundColor Gray
        Write-Host '  |' -ForegroundColor Gray
        Write-Host '  |  之后每次 git push，Vercel 会自动重新部署' -ForegroundColor Gray
        Write-Host '  +------------------------------------------------------' -ForegroundColor Cyan
    }
}
finally {
    Pop-Location
}

# ---------- 完成 ----------
Write-Head '部署流程结束'
Write-Ok 'GitHub 仓库已就绪'
Write-Host ''
Write-Host '  给岁月以文明，而不是给文明以岁月。' -ForegroundColor DarkGray
Write-Host ''