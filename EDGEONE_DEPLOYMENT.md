# EdgeOne Pages 部署指南

## 项目配置

本项目已配置为支持 EdgeOne Pages 部署，并使用 Node Functions 处理 API 请求。

### 配置文件说明

1. **package.json**
   - 已添加 `dev:functions` 脚本用于启动 EdgeOne Functions 开发服务器
   - 使用 `npm run dev` 启动前端开发服务器
   - 使用 `npm run dev:functions` 启动 Functions 开发服务器

2. **next.config.ts**
   - 保持默认配置，支持 SSR/ISR
   - 前端页面位于 `app/` 目录

3. **.gitignore**
   - 已添加 `.edgeone` 目录到忽略列表

## 项目结构

```
address-mapper/
├── app/                    # Next.js App Router（前端页面）
│   └── page.tsx           # 主页面
├── node-functions/        # Node Functions（后端 API）
│   └── api/
│       ├── upload.ts      # 文件上传和地址匹配
│       ├── export.ts      # Excel 导出
│       └── template.ts    # 模板下载
├── components/            # React 组件
├── lib/                   # 工具库（共享代码）
├── data/                  # 数据文件
└── public/                # 静态资源
```

## API Routes（Node Functions）

项目中的 API 已迁移到 Node Functions，提供更好的性能和超时处理能力：

- `/api/upload` - 文件上传和地址匹配处理（POST/GET）
- `/api/export` - 导出 Excel 文件（POST）
- `/api/template` - 下载模板文件（GET）

### Node Functions 优势

1. **更长的执行时间**：Node Functions 支持最长 30 秒的执行时间，适合处理大量数据的地址匹配
2. **完整的 Node.js 生态**：可以使用所有 npm 包，包括 `xlsx` 等文件处理库
3. **更好的性能**：针对复杂业务逻辑优化

## 部署步骤

### 1. 安装 EdgeOne CLI（如果尚未安装）

```bash
npm install -g edgeone
```

### 2. 登录 EdgeOne

```bash
edgeone login
```

### 3. 初始化项目（首次部署）

```bash
edgeone pages init
```

### 4. 本地测试 Node Functions

```bash
# 启动 Functions 开发服务器
npm run dev:functions
```

### 5. 部署到 EdgeOne Pages

```bash
edgeone pages deploy
```

## 环境变量

如果项目需要环境变量，请在 EdgeOne Pages 控制台中配置：

1. 登录 EdgeOne 控制台
2. 进入项目设置
3. 在"环境变量"部分添加所需变量

## 本地开发

### 前端开发

```bash
npm run dev
```

前端开发服务器将在 `http://localhost:3000` 启动。

### Functions 开发

```bash
npm run dev:functions
```

Functions 开发服务器将启动，可以测试 Node Functions 的功能。

### 同时运行前后端（推荐）

打开两个终端窗口：

```bash
# 终端 1：启动前端
npm run dev

# 终端 2：启动 Functions
npm run dev:functions
```

## 从 Next.js API Routes 迁移到 Node Functions

项目已从 Next.js API Routes（`app/api/`）迁移到 Node Functions（`node-functions/api/`），主要变化：

1. **文件位置**：从 `app/api/` 移动到 `node-functions/api/`
2. **导出函数**：使用 `onRequestPost`, `onRequestGet` 等 handlers
3. **响应格式**：使用标准的 `Response` 对象
4. **路径引用**：使用相对路径 `../../lib/` 而不是 `@/lib/`

### 迁移对比

**之前（Next.js API Route）：**
```typescript
// app/api/upload/route.ts
export async function POST(request: NextRequest) {
  return NextResponse.json({ success: true });
}
```

**现在（Node Function）：**
```typescript
// node-functions/api/upload.ts
export async function onRequestPost(context: any) {
  const { request } = context;
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
}
```

## 注意事项

1. **文件大小限制**
   - Node Functions 请求 body 最大支持 6 MB
   - 代码包大小最大支持 128 MB
   - 单次运行时长最长 30 秒

2. **超时处理**
   - 如果处理大量数据可能超时，考虑分批处理
   - 使用进度反馈机制

3. **静态资源**
   - `public/` 目录中的文件会自动部署到 CDN
   - 确保所有静态资源路径使用相对路径

4. **构建输出**
   - 运行 `npm run build` 进行本地构建测试
   - EdgeOne Pages 会自动执行构建过程

5. **日志查看**
   - 在 EdgeOne Pages 控制台可以查看 Node Functions 的调用日志
   - 通过 `context.uuid` 可以追踪请求

## 故障排查

### 构建失败

1. 检查 `package.json` 中的依赖是否正确
2. 确保所有 TypeScript 类型错误已修复
3. 检查 `next.config.ts` 配置是否正确
4. 确保 Node Functions 文件路径正确

### Node Functions 不工作

1. 确保 Node Functions 位于 `node-functions/` 目录
2. 检查函数是否正确导出 handlers（`onRequestPost`, `onRequestGet` 等）
3. 查看 EdgeOne Pages 控制台的日志
4. 检查路径引用是否正确（使用相对路径）

### 文件上传超时

1. 检查文件大小是否超过 6 MB 限制
2. 考虑优化地址匹配算法
3. 对于大量数据，实现分批处理机制
4. 检查是否有无限循环或性能瓶颈

### 路径引用错误

Node Functions 中不能使用 `@/lib` 路径别名，必须使用相对路径：
- ✅ `import { ... } from '../../lib/excel'`
- ❌ `import { ... } from '@/lib/excel'`

## 性能优化

### 已实现的优化

1. **地址数据预加载和缓存**
   - 地址数据在首次请求时加载并缓存
   - 地址匹配器实例全局缓存，避免重复创建
   - 后续请求直接使用缓存，大幅提升响应速度

2. **多级索引优化（核心优化）**
   - 为局方输入建立多级索引：
     - 按省份编码/名称索引
     - 按城市编码/名称索引
     - 按区县编码/名称索引
   - 使用索引快速过滤候选输入，只匹配相关的局方输入
   - 从 O(n*m) 复杂度优化到 O(n*log(m)) 或更优

3. **标准化结果缓存**
   - 缓存地址名称的标准化结果，避免重复计算
   - 大幅减少字符串处理开销

4. **匹配算法优化**
   - 优先使用编码匹配（O(1) 查找）
   - 使用多级索引快速定位候选输入
   - 只对候选输入进行详细匹配，减少遍历范围
   - 缓存生成的骏伯地址列表，避免重复计算

5. **性能监控**
   - 详细的性能日志，记录各阶段耗时
   - 便于识别性能瓶颈和进一步优化

6. **错误处理**
   - 完善的错误处理机制，避免请求失败
   - 详细的错误日志，便于问题排查

### 性能指标

- **首次请求**：需要加载地址数据，耗时较长（通常 1-3 秒）
- **后续请求**：使用缓存，响应速度大幅提升
- **匹配速度**：
  - **优化前**：平均每条数据 5ms（3009条输入，15190ms）
  - **优化后**：预期平均每条数据 < 0.5ms（提升 10倍以上）
  - 通过多级索引，大部分匹配只需要检查少量候选输入，而不是遍历所有输入

### 进一步优化建议

1. **分批处理**：对于超大量数据（> 10000 条），可以考虑分批处理
2. **异步处理**：对于非实时场景，可以考虑异步处理并返回任务 ID
3. **CDN 缓存**：静态资源使用 CDN 缓存，提升加载速度

## 更多信息

- [EdgeOne Pages 文档](https://pages.edgeone.ai/document/product-introduction)
- [Node Functions 文档](https://edgeone.cloud.tencent.com/pages/document/184787642236784640#5b626ca7-c1f5-4058-b448-a88cdc65a0f0)
- [Next.js 文档](https://nextjs.org/docs)
- [EdgeOne CLI 文档](https://edgeone.cloud.tencent.com/pages/document/184787642236784640)

