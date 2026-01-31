# GitHub 上传完整指南

## 📋 准备工作

### 1. 确保已安装 Git
```bash
git --version
```

如果未安装，请访问 https://git-scm.com/ 下载安装。

### 2. 配置 Git（首次使用）
```bash
git config --global user.name "你的用户名"
git config --global user.email "你的邮箱"
```

## 🚀 上传步骤

### 方式一：通过命令行（推荐）

#### 步骤 1: 初始化 Git 仓库
```bash
cd d:\temp\huangdi
git init
```

#### 步骤 2: 添加所有文件
```bash
git add .
```

#### 步骤 3: 创建首次提交
```bash
git commit -m "Initial commit: 皇帝模拟器完整项目"
```

#### 步骤 4: 在 GitHub 创建仓库
1. 访问 https://github.com/new
2. 仓库名称：`huangdi-emperor-simulator`（或你喜欢的名字）
3. 描述：`一款沉浸式后宫模拟游戏`
4. 选择 **Public**（公开）或 **Private**（私有）
5. **不要**勾选 "Add a README file"（我们已经有了）
6. 点击 **Create repository**

#### 步骤 5: 关联远程仓库
复制 GitHub 显示的仓库地址，然后执行：

```bash
# 使用 HTTPS（推荐新手）
git remote add origin https://github.com/你的用户名/huangdi-emperor-simulator.git

# 或使用 SSH（需要配置 SSH 密钥）
git remote add origin git@github.com:你的用户名/huangdi-emperor-simulator.git
```

#### 步骤 6: 推送到 GitHub
```bash
git branch -M main
git push -u origin main
```

如果使用 HTTPS，会提示输入 GitHub 用户名和密码（或 Personal Access Token）。

### 方式二：通过 GitHub Desktop（图形界面）

#### 步骤 1: 下载安装 GitHub Desktop
访问 https://desktop.github.com/ 下载安装。

#### 步骤 2: 登录 GitHub 账号
打开 GitHub Desktop，点击 **Sign in to GitHub.com**

#### 步骤 3: 添加本地仓库
1. 点击 **File** → **Add local repository**
2. 选择 `d:\temp\huangdi` 目录
3. 如果提示"未找到 Git 仓库"，点击 **create a repository**

#### 步骤 4: 创建首次提交
1. 在左侧勾选所有文件
2. 在底部输入提交信息：`Initial commit: 皇帝模拟器完整项目`
3. 点击 **Commit to main**

#### 步骤 5: 发布到 GitHub
1. 点击顶部的 **Publish repository**
2. 填写仓库名称和描述
3. 选择是否公开
4. 点击 **Publish repository**

## ✅ 验证上传成功

访问你的 GitHub 仓库地址：
```
https://github.com/你的用户名/huangdi-emperor-simulator
```

应该能看到所有文件，包括：
- ✅ README.md（项目说明）
- ✅ cloudflare/ 目录（Cloudflare 部署文件）
- ✅ src/ 目录（前端代码）
- ✅ server/ 目录（后端代码）
- ✅ public/ 目录（静态资源）
- ✅ package.json
- ✅ LICENSE

## 📝 后续更新

### 修改代码后推送更新
```bash
# 1. 查看修改的文件
git status

# 2. 添加修改的文件
git add .

# 3. 提交更改
git commit -m "描述你的修改内容"

# 4. 推送到 GitHub
git push
```

### 常用 Git 命令
```bash
# 查看状态
git status

# 查看提交历史
git log --oneline

# 撤销未提交的修改
git checkout -- 文件名

# 创建新分支
git checkout -b feature/新功能

# 切换分支
git checkout main

# 合并分支
git merge feature/新功能
```

## 🔐 安全提示

### 已自动忽略的敏感文件
`.gitignore` 已配置忽略以下文件：
- ✅ `server/data/*.db` - 本地数据库文件
- ✅ `.env` - 环境变量
- ✅ `node_modules/` - 依赖包
- ✅ `public/uploads/*` - 用户上传的文件

### 检查是否有敏感信息
上传前请确认：
- ❌ 不要上传包含密码的配置文件
- ❌ 不要上传 API 密钥
- ❌ 不要上传个人数据库文件
- ✅ `wrangler.toml` 中的 `database_id` 可以上传（这是公开的）

## 🌟 推荐的仓库设置

### 添加 Topics（标签）
在 GitHub 仓库页面点击 ⚙️ Settings，添加以下 topics：
- `typescript`
- `vite`
- `game`
- `simulation`
- `cloudflare-workers`
- `cloudflare-pages`

### 添加仓库描述
在仓库首页点击 ⚙️，添加描述：
```
🏯 一款沉浸式后宫模拟游戏 | TypeScript + Vite + Cloudflare
```

### 启用 GitHub Pages（可选）
如果想直接通过 GitHub Pages 访问：
1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: main → /dist
4. 需要先运行 `npm run build` 并提交 dist 目录

## 🎉 完成！

现在你的项目已经成功上传到 GitHub，可以：
- 📤 分享给朋友
- 🌟 获得 Star
- 🔀 接受 Pull Request
- 📝 管理 Issues
- 🚀 通过 Cloudflare 部署

---

## 🆘 常见问题

### Q: 推送时提示权限错误
**A**: 如果使用 HTTPS，需要使用 Personal Access Token 而不是密码：
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. 勾选 `repo` 权限
4. 复制生成的 token
5. 推送时使用 token 作为密码

### Q: 文件太大无法上传
**A**: GitHub 单个文件限制 100MB，如果有大文件：
1. 使用 Git LFS（Large File Storage）
2. 或将大文件放到 `.gitignore` 中

### Q: 如何删除已上传的敏感文件
**A**: 
```bash
# 从 Git 历史中完全删除
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch 敏感文件路径" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

### Q: 想要重新开始
**A**: 
```bash
# 删除本地 Git 仓库
rm -rf .git

# 重新初始化
git init
git add .
git commit -m "Initial commit"
```
