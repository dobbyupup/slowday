# Slowday

Slowday 是一个把月历、Todo List、四象限复盘和 AI 分析放在一起的复古咖啡风效率工具。

## 在线体验

[打开公开体验站](https://slowday-calendar-review.handy-yew-9633.chatgpt.site/)。任何人都可以打开并创建自己的独立账号；体验数据不会与仓库维护者或其他用户共享。

## 隐私边界

- 本仓库不包含生产数据库、用户上传文件、个人待办、复盘、品牌资料、恢复密钥或模型 API Key。
- `.env*`、本地数据库、构建产物和运行时文件均不会提交；`.env.example` 只保留空的配置项说明。
- 线上数据按账号隔离。模型 Key 只在服务端加密保存，不会写入源码、页面或导出文件。
- 公共源码使用全新的干净 Git 历史，未包含开发阶段的个人参考资料。

## 功能

- 真实可交互的月历与当天 Todo List
- 云端持久化任务、完成状态和每日复盘
- Keep / Start / Improve / Stop 四象限复盘
- 五种心情、能量记录与月度复盘总览
- 首页展示未来七天安排和每天的真实成果；复盘 AI 会结合任务、阅读时间线与四象限生成反馈和“今日进步”摘要
- 按日期沉淀链接与旁注的阅读时间线
- 在首页输入栏中粘贴链接、粘贴图片或选择附件；网页会自动读取标题、来源、封面与简介
- 任何人均可创建 Slowday 独立账号，也可选择 Sign in with ChatGPT
- 每个账号独立配置自己的 DeepSeek、OpenAI 或兼容 Chat Completions 的模型 API Key
- API Key 使用服务端 AES-256-GCM 加密，不在界面或接口中回显
- 一键导出个人待办、复盘与阅读记录（永不导出模型 API Key）
- 可创建、撤销 API Key 的 REST API v1
- 服务端账号、会话与数据所有权隔离
- 输入校验、速率限制、安全响应头与跨站写入防护

## 技术栈

- React 19、Next.js 兼容路由、Vinext
- Cloudflare Workers 与 D1
- Drizzle ORM
- TypeScript

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

构建与测试：

```bash
npm test
```

本地运行需要提供与生产环境等价的 D1 `DB` 绑定。Slowday 自有账号使用只展示一次的恢复密钥，服务端仅保存其 SHA-256 摘要；ChatGPT 登录是可选入口。不要在直接暴露到公网的服务中自行伪造 `oai-authenticated-user-*` 请求头。

复制 `.env.example` 并配置 `AI_KEY_ENCRYPTION_SECRET`。它是用于加密各账号模型 Key 的 32 字节主密钥，不是任何模型服务的访问密钥，不能使用 `NEXT_PUBLIC_` 前缀。用户自己的模型 Key 只通过登录后的设置界面提交；DeepSeek 使用 Chat Completions，OpenAI 使用 Responses API，其他服务须提供兼容的 Chat Completions HTTPS 接口。

## 数据库

数据结构位于 `db/schema.ts`，版本迁移位于 `drizzle/`。修改结构后运行：

```bash
npm run db:generate
```

## Slowday API v1

API 入口为 `/api/v1`。完整说明见 [docs/API.md](docs/API.md)。浏览器使用当前 Slowday 或 ChatGPT 会话；外部工具使用“Slowday 访问密钥”中创建的 Bearer Key。它与模型 API Key 完全分离，且不能调用会消耗模型额度的 AI 分析接口。数据按稳定用户 ID 隔离。

## 部署

`.openai/hosting.json` 声明了 D1 与 R2 的逻辑绑定。Fork 后请将占位的 `project_id` 替换为自己的 Sites 项目 ID，或在首次创建站点时让 Sites 自动写入。生产数据库、附件存储与环境密钥不会随源码复制。

## 参与贡献

欢迎提交 issue 与 pull request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## License

[MIT](LICENSE)
