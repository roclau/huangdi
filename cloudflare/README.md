# 【大清】皇帝模拟器 - Cloudflare 部署版本

本目录包含将项目部署到 Cloudflare Pages + Workers + D1 的所有配置和代码。

## 📁 目录结构

```
cloudflare/
├── README.md              # 本文件
├── wrangler.toml          # Cloudflare Workers 配置
├── worker.ts              # Workers 后端代码（替代 Express）
├── schema.sql             # D1 数据库结构
├── seed.sql               # 初始数据
└── deploy-guide.md        # 详细部署指南
```

## 🚀 快速开始

### 前置要求

1. 注册 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费）
2. 安装 Wrangler CLI：
   ```bash
   npm install -g wrangler
   ```
3. 登录 Cloudflare：
   ```bash
   wrangler login
   ```

### 部署步骤

详见 `deploy-guide.md`

## 🔄 与原项目的区别

### 保留不变
- ✅ 前端代码（`src/`、`public/`）
- ✅ 数据库结构
- ✅ 所有游戏逻辑

### 改动部分
- 🔄 后端从 Express 改为 Cloudflare Workers
- 🔄 数据库从本地 SQLite 改为 Cloudflare D1
- 🔄 API 调用地址需修改

## 📊 免费额度

Cloudflare 免费计划包含：
- **Pages**: 无限静态请求
- **Workers**: 100,000 次请求/天
- **D1**: 5GB 存储，500万次读取/天

对于个人使用完全足够！

## 🛠️ 本地开发

```bash
# 在 cloudflare 目录下
wrangler dev
```

## 📝 注意事项

- 原项目（`server/` 目录）保持不变，可继续本地开发
- 此目录仅用于 Cloudflare 部署
- 两套代码可以并行维护
