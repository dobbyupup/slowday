# Security Policy

## 支持范围

安全修复优先进入默认分支的最新版本。请先确认问题在最新提交中仍可复现。

## 报告漏洞

请不要在公开 issue 中披露可利用细节、个人数据、API Key 或生产环境信息。请通过仓库维护者提供的私密联系方式报告，并包含影响范围、复现步骤和建议修复方式。

## 部署注意事项

- `oai-authenticated-user-*` 只能信任由 Sites / SIWC 网关注入的请求头；自托管时必须在可信反向代理处清除外部同名请求头。
- `AI_KEY_ENCRYPTION_SECRET` 仅配置在服务端环境，绝不提交到仓库或暴露为 `NEXT_PUBLIC_*`；模型 API Key 按账号使用 AES-256-GCM 加密保存。
- Slowday 恢复密钥只展示一次，服务端仅保存 SHA-256 摘要；会话使用 `Secure`、`HttpOnly`、`SameSite=Lax` 的主机级 Cookie。
- 自定义模型只接受公网 HTTPS Base URL，拒绝本机、私网、链路本地、元数据地址、凭据、查询参数、非 443 端口及重定向。高安全部署可进一步改为服务商域名 allowlist，以降低 DNS 重绑定风险。
- AI 分析仅接受当前登录会话，不接受 Slowday Bearer Key，避免第三方工具消耗用户的模型额度。
- 保持 D1 迁移、依赖安全更新和 HTTPS 响应头同步部署。
- API Key 仅展示一次；疑似泄露时立即撤销并创建新 Key。
