# 快速上传到 GitHub 的脚本
# 使用方法：在 PowerShell 中运行 .\upload-to-github.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  皇帝模拟器 - GitHub 上传助手" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否已安装 Git
try {
    $gitVersion = git --version
    Write-Host "✓ Git 已安装: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 未检测到 Git，请先安装 Git" -ForegroundColor Red
    Write-Host "  下载地址: https://git-scm.com/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 检查是否已初始化 Git 仓库
if (-not (Test-Path ".git")) {
    Write-Host "初始化 Git 仓库..." -ForegroundColor Yellow
    git init
    Write-Host "✓ Git 仓库初始化完成" -ForegroundColor Green
} else {
    Write-Host "✓ Git 仓库已存在" -ForegroundColor Green
}

Write-Host ""

# 添加所有文件
Write-Host "添加文件到暂存区..." -ForegroundColor Yellow
git add .
Write-Host "✓ 文件添加完成" -ForegroundColor Green

Write-Host ""

# 显示将要提交的文件
Write-Host "将要提交的文件:" -ForegroundColor Cyan
git status --short

Write-Host ""

# 询问提交信息
$commitMessage = Read-Host "请输入提交信息（直接回车使用默认信息）"
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "Initial commit: 皇帝模拟器完整项目"
}

# 提交
Write-Host ""
Write-Host "创建提交..." -ForegroundColor Yellow
git commit -m "$commitMessage"
Write-Host "✓ 提交创建完成" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  下一步操作" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 访问 https://github.com/new 创建新仓库" -ForegroundColor White
Write-Host "2. 仓库名称建议: huangdi-emperor-simulator" -ForegroundColor White
Write-Host "3. 不要勾选 'Add a README file'" -ForegroundColor White
Write-Host "4. 创建后，复制仓库地址" -ForegroundColor White
Write-Host ""

# 询问是否要添加远程仓库
$addRemote = Read-Host "是否现在添加远程仓库？(y/n)"
if ($addRemote -eq "y" -or $addRemote -eq "Y") {
    Write-Host ""
    $repoUrl = Read-Host "请输入 GitHub 仓库地址（例如: https://github.com/username/repo.git）"
    
    # 检查是否已有 origin
    $hasOrigin = git remote | Select-String "origin"
    if ($hasOrigin) {
        Write-Host "检测到已有 origin，将先删除..." -ForegroundColor Yellow
        git remote remove origin
    }
    
    git remote add origin $repoUrl
    Write-Host "✓ 远程仓库添加成功" -ForegroundColor Green
    
    Write-Host ""
    $pushNow = Read-Host "是否现在推送到 GitHub？(y/n)"
    if ($pushNow -eq "y" -or $pushNow -eq "Y") {
        Write-Host ""
        Write-Host "推送到 GitHub..." -ForegroundColor Yellow
        git branch -M main
        git push -u origin main
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "  🎉 上传成功！" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "访问你的仓库: $repoUrl" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "推送失败，请检查:" -ForegroundColor Red
            Write-Host "1. 仓库地址是否正确" -ForegroundColor Yellow
            Write-Host "2. 是否有推送权限" -ForegroundColor Yellow
            Write-Host "3. 如果使用 HTTPS，可能需要 Personal Access Token" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host ""
    Write-Host "稍后可以手动执行以下命令:" -ForegroundColor Yellow
    Write-Host "  git remote add origin <你的仓库地址>" -ForegroundColor White
    Write-Host "  git branch -M main" -ForegroundColor White
    Write-Host "  git push -u origin main" -ForegroundColor White
}

Write-Host ""
Write-Host "详细指南请查看: GITHUB_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
