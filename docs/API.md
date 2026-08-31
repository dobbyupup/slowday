# Slowday API v1

基础路径：`/api/v1`

## 认证

浏览器内调用使用当前 Slowday 或 ChatGPT 登录会话。外部客户端在页面左上角打开 API 配置，创建只展示一次的 API Key，然后发送：

```http
Authorization: Bearer slowday_你的密钥
```

API Key 只以 SHA-256 摘要存储，可随时在配置页撤销。未认证返回 `401`，超过速率限制返回 `429`。

所有数据按当前账号隔离。

网页端提供 `/api/reading` 用于阅读时间线的增删改查；登录用户可调用 `POST /api/reading/import-link` 安全读取公开网页，也可用 multipart 请求调用 `POST /api/reading/import-media` 上传最多四张个人图片。图片保存在账号隔离的 R2 存储中，并通过需要登录的读取路由展示。旧版 `/api/design-ideas` 暂时保留，仅用于兼容和个人数据导出，不再出现在界面中。

## 复盘总览

```http
GET /api/v1/overview?period=month&anchor=2026-07-17
```

`period` 可设为 `week` 或 `month`。接口返回所选周期的复盘天数、待办完成率、平均能量、主要心情、心情分布、每日任务统计和复盘列表。

## 查询待办

```http
GET /api/v1/tasks?from=2026-07-01&to=2026-07-31
```

列表接口支持 `limit`（1–200，默认 100）和 `offset`，响应 `meta.hasMore` 表示是否可能还有下一页。

## 新建待办

```http
POST /api/v1/tasks
Content-Type: application/json

{
  "date": "2026-07-17",
  "title": "写下今天的复盘"
}
```

## 更新与删除待办

```http
PATCH /api/v1/tasks/123
Content-Type: application/json

{ "done": true }
```

```http
DELETE /api/v1/tasks/123
```

## 查询复盘

```http
GET /api/v1/reviews?from=2026-07-01&to=2026-07-31
```

## 写入某日复盘

```http
PUT /api/v1/reviews/2026-07-17
Content-Type: application/json

{
  "mood": "平静",
  "energy": 4,
  "keep": "午后留出一段无会议时间",
  "start": "先写最小版本",
  "improve": "减少上下文切换",
  "stop": "睡前继续刷消息"
}
```

错误统一返回：

```json
{ "error": "可读的错误说明" }
```

无法预期的服务端错误不会暴露内部细节，会额外返回可用于排查的 `requestId`。
