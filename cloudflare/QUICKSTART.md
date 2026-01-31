# Cloudflare 部署快速开始

## 🚀 5分钟快速部署

### 步骤 1: 安装并登录
```bash
npm install -g wrangler
wrangler login
```

### 步骤 2: 创建数据库
```bash
cd cloudflare
wrangler d1 create huangdi-db
```
**复制返回的 `database_id` 到 `wrangler.toml` 文件中！**

### 步骤 3: 初始化数据
```bash
wrangler d1 execute huangdi-db --file=schema.sql
wrangler d1 execute huangdi-db --file=seed.sql
```

### 步骤 4: 部署后端
```bash
wrangler deploy
```
**记下返回的 Workers 地址！**

### 步骤 5: 修改前端配置
编辑 `src/config.ts`，将 `your-worker-name.workers.dev` 替换为你的 Workers 地址。

### 步骤 6: 构建并部署前端
```bash
cd ..
npm run build
npx wrangler pages deploy dist --project-name=huangdi-emperor
```

## ✅ 完成！

访问返回的 Pages 地址即可开始游戏。

---

## 📝 重要提醒

1. **保留原项目**：`server/` 目录保持不变，可继续本地开发
2. **环境变量**：建议在 Pages 设置中配置 `VITE_API_URL`
3. **完整数据**：`seed.sql` 仅包含部分数据，完整的193位名妃需手动导入或通过管理后台添加

---

## 🔧 本地开发

### 测试 Workers
```bash
cd cloudflare
wrangler dev
```

### 测试前端（连接本地 Workers）
```bash
# 终端1：启动 Workers
cd cloudflare && wrangler dev

# 终端2：启动前端
npm run dev
```

---

## 📊 免费额度

- Workers: 100,000 次请求/天
- Pages: 无限静态请求
- D1: 5GB 存储，500万次读取/天

**对于个人使用完全足够！**

---

详细文档请查看 `deploy-guide.md`
