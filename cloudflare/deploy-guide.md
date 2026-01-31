# 【大清】皇帝模拟器 - Cloudflare 部署完整指南

## 📋 目录
1. [前置准备](#前置准备)
2. [创建 D1 数据库](#创建-d1-数据库)
3. [部署 Workers 后端](#部署-workers-后端)
4. [部署 Pages 前端](#部署-pages-前端)
5. [配置前端 API 地址](#配置前端-api-地址)
6. [测试与验证](#测试与验证)
7. [常见问题](#常见问题)

---

## 前置准备

### 1. 注册 Cloudflare 账号
访问 https://dash.cloudflare.com/sign-up 注册免费账号

### 2. 安装 Wrangler CLI
```bash
npm install -g wrangler
```

### 3. 登录 Cloudflare
```bash
wrangler login
```
浏览器会打开授权页面，点击允许即可。

---

## 创建 D1 数据库

### 1. 创建数据库
```bash
cd cloudflare
wrangler d1 create huangdi-db
```

执行后会返回类似信息：
```
✅ Successfully created DB 'huangdi-db'!

[[d1_databases]]
binding = "DB"
database_name = "huangdi-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. 更新 wrangler.toml
将上面返回的 `database_id` 复制到 `wrangler.toml` 文件中：
```toml
[[d1_databases]]
binding = "DB"
database_name = "huangdi-db"
database_id = "你的数据库ID"  # 替换这里
```

### 3. 初始化数据库结构
```bash
wrangler d1 execute huangdi-db --file=schema.sql
```

### 4. 导入初始数据
```bash
wrangler d1 execute huangdi-db --file=seed.sql
```

### 5. 验证数据库（可选）
```bash
wrangler d1 execute huangdi-db --command="SELECT * FROM emperor"
```

---

## 部署 Workers 后端

### 1. 本地测试（可选）
```bash
wrangler dev
```
访问 http://localhost:8787/api/emperor 测试

### 2. 部署到生产环境
```bash
wrangler deploy
```

部署成功后会返回 Workers 地址，例如：
```
https://huangdi-emperor-sim.your-subdomain.workers.dev
```

**记下这个地址**，后面配置前端时需要用到。

---

## 部署 Pages 前端

### 1. 回到项目根目录
```bash
cd ..  # 回到 huangdi 根目录
```

### 2. 修改前端 API 地址

打开 `src/main.ts`，全局搜索 `http://localhost:3001`，替换为你的 Workers 地址：

```typescript
// 修改前
fetch('http://localhost:3001/api/emperor')

// 修改后
fetch('https://huangdi-emperor-sim.your-subdomain.workers.dev/api/emperor')
```

**建议方式**：创建一个配置文件 `src/config.ts`：
```typescript
export const API_BASE_URL = import.meta.env.PROD 
  ? 'https://huangdi-emperor-sim.your-subdomain.workers.dev'
  : 'http://localhost:3001';
```

然后在 `main.ts` 中使用：
```typescript
import { API_BASE_URL } from './config';

fetch(`${API_BASE_URL}/api/emperor`)
```

### 3. 构建前端
```bash
npm run build
```

### 4. 部署到 Cloudflare Pages

#### 方式一：通过 Wrangler（推荐）
```bash
npx wrangler pages deploy dist --project-name=huangdi-emperor
```

#### 方式二：通过 Cloudflare Dashboard
1. 登录 https://dash.cloudflare.com
2. 进入 **Pages** 页面
3. 点击 **Create a project**
4. 选择 **Upload assets**
5. 上传 `dist` 目录

部署成功后会得到一个地址，例如：
```
https://huangdi-emperor.pages.dev
```

---

## 配置前端 API 地址

### 方案一：环境变量（推荐）

在 Cloudflare Pages 设置中添加环境变量：
1. 进入 Pages 项目设置
2. 找到 **Environment variables**
3. 添加变量：
   - Name: `VITE_API_URL`
   - Value: `https://huangdi-emperor-sim.your-subdomain.workers.dev`

然后在代码中使用：
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

### 方案二：自定义域名

如果你有自己的域名，可以配置：
- Pages: `game.your-domain.com`
- Workers: `api.your-domain.com`

在 Cloudflare Dashboard 中配置 Custom Domain 即可。

---

## 测试与验证

### 1. 测试后端 API
```bash
curl https://huangdi-emperor-sim.your-subdomain.workers.dev/api/emperor
```

应该返回皇帝数据。

### 2. 测试前端
访问你的 Pages 地址，例如：
```
https://huangdi-emperor.pages.dev
```

### 3. 测试完整流程
1. 进入后宫页面，查看妃子列表
2. 进入选秀页面，测试选秀功能
3. 点击妃子卡片，测试交互功能
4. 点击"下一日"，测试游戏逻辑

---

## 常见问题

### Q1: Workers 返回 500 错误
**A**: 检查 `wrangler.toml` 中的 `database_id` 是否正确配置。

### Q2: 前端无法连接后端
**A**: 
1. 检查 CORS 配置（Workers 代码中已包含）
2. 确认 API 地址是否正确
3. 打开浏览器控制台查看具体错误

### Q3: 数据库查询失败
**A**: 
1. 确认已执行 `schema.sql` 和 `seed.sql`
2. 使用 `wrangler d1 execute` 手动查询验证

### Q4: 如何查看 Workers 日志
**A**: 
```bash
wrangler tail
```

### Q5: 如何更新数据库
**A**: 
```bash
# 查看现有数据
wrangler d1 execute huangdi-db --command="SELECT * FROM historical_pool LIMIT 5"

# 插入新数据
wrangler d1 execute huangdi-db --command="INSERT INTO historical_pool (name, beauty, personality, dynasty, description) VALUES ('测试', 90, '温柔', '唐', '测试数据')"
```

### Q6: 如何回滚部署
**A**: 
在 Cloudflare Dashboard 中可以查看部署历史并回滚：
- Pages: 进入项目 → Deployments → 选择历史版本
- Workers: 进入 Workers → Deployments → Rollback

---

## 🎉 完成！

现在你的皇帝模拟器已经成功部署到 Cloudflare，完全免费且全球可访问！

### 下一步
- 配置自定义域名
- 添加更多历史名妃数据
- 优化交互文本（从 `server/data/interactions.ts` 导入完整数据）
- 配置 CDN 加速图片资源

### 成本
- **完全免费**（在免费额度内）
- Workers: 100,000 次请求/天
- Pages: 无限静态请求
- D1: 5GB 存储，500万次读取/天

### 性能
- 全球 CDN 加速
- 响应时间 < 50ms
- 99.99% 可用性

---

## 📞 技术支持

遇到问题？
1. 查看 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
2. 查看 [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
3. 查看 [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
