import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id"),
  ownerEmail: text("owner_email").notNull(),
  date: text("date").notNull(),
  title: text("title").notNull(),
  category: text("category", { enum: ["工作", "生活", "成长"] }).notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  index("tasks_owner_date_idx").on(table.ownerId, table.date),
]);

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id"),
  ownerEmail: text("owner_email").notNull(),
  date: text("date").notNull(),
  mood: text("mood").notNull().default("◡"),
  energy: integer("energy").notNull().default(3),
  text: text("text").notNull().default(""),
  win: text("win").notNull().default(""),
  keep: text("keep").notNull().default(""),
  start: text("start").notNull().default(""),
  improve: text("improve").notNull().default(""),
  stop: text("stop").notNull().default(""),
  analysis: text("analysis"),
  progressSummary: text("progress_summary"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  uniqueIndex("reviews_owner_date_unique").on(table.ownerId, table.date),
]);

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  scope: text("scope", { enum: ["week", "month", "year"] }).notNull(),
  periodKey: text("period_key").notNull(),
  content: text("content").notNull().default(""),
  progress: integer("progress").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  uniqueIndex("goals_owner_scope_period_unique").on(table.ownerId, table.scope, table.periodKey),
  index("goals_owner_period_idx").on(table.ownerId, table.periodKey),
]);

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  uniqueIndex("api_keys_token_hash_unique").on(table.tokenHash),
  index("api_keys_owner_idx").on(table.ownerId),
]);

export const apiRateLimits = sqliteTable("api_rate_limits", {
  identity: text("identity").notNull(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull().default(1),
}, table => [
  uniqueIndex("api_rate_limits_identity_window_unique").on(table.identity, table.windowStart),
]);

export const aiConfigs = sqliteTable("ai_configs", {
  ownerId: text("owner_id").primaryKey(),
  provider: text("provider", { enum: ["deepseek", "openai", "custom"] }).notNull(),
  model: text("model").notNull(),
  baseUrl: text("base_url"),
  encryptedKey: text("encrypted_key").notNull(),
  keyIv: text("key_iv").notNull(),
  keyHint: text("key_hint").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  recoveryHash: text("recovery_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  uniqueIndex("users_recovery_hash_unique").on(table.recoveryHash),
]);

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  index("sessions_user_idx").on(table.userId),
  index("sessions_expires_idx").on(table.expiresAt),
]);

export const readingItems = sqliteTable("reading_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  date: text("date").notNull(),
  title: text("title").notNull(),
  source: text("source").notNull().default(""),
  url: text("url").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  note: text("note").notNull().default(""),
  tags: text("tags").notNull().default(""),
  resourceType: text("resource_type", { enum: ["图片", "网页链接", "文档", "文字想法", "用户反馈", "供应商资料"] }).notNull().default("图片"),
  primaryCategory: text("primary_category").notNull().default("产品设计"),
  workflowStatus: text("workflow_status", { enum: ["pending", "confirmed"] }).notNull().default("pending"),
  intendedUse: text("intended_use").notNull().default("暂时研究"),
  contentHash: text("content_hash").notNull().default(""),
  duplicateOf: integer("duplicate_of"),
  topic: text("topic").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  index("reading_items_owner_date_idx").on(table.ownerId, table.date),
  index("reading_items_owner_workflow_idx").on(table.ownerId, table.workflowStatus),
  index("reading_items_owner_category_idx").on(table.ownerId, table.primaryCategory),
  index("reading_items_owner_hash_idx").on(table.ownerId, table.contentHash),
]);

export const brandProfiles = sqliteTable("brand_profiles", {
  ownerId: text("owner_id").primaryKey(),
  story: text("story").notNull().default(""),
  philosophy: text("philosophy").notNull().default(""),
  audience: text("audience").notNull().default(""),
  keywords: text("keywords").notNull().default(""),
  differentiation: text("differentiation").notNull().default(""),
  productDirection: text("product_direction").notNull().default(""),
  visualLanguage: text("visual_language").notNull().default(""),
  annualGoal: text("annual_goal").notNull().default(""),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const brandProfileVersions = sqliteTable("brand_profile_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  version: integer("version").notNull(),
  snapshot: text("snapshot").notNull(),
  changeNote: text("change_note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  uniqueIndex("brand_profile_versions_owner_version_unique").on(table.ownerId, table.version),
  index("brand_profile_versions_owner_idx").on(table.ownerId, table.createdAt),
]);

export const knowledgeTopics = sqliteTable("knowledge_topics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  uniqueIndex("knowledge_topics_owner_title_unique").on(table.ownerId, table.title),
]);

export const readingCanvases = sqliteTable("reading_canvases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  tag: text("tag").notNull(),
  layout: text("layout").notNull().default('{"nodes":[],"edges":[]}'),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  uniqueIndex("reading_canvases_owner_tag_unique").on(table.ownerId, table.tag),
]);

export const designIdeas = sqliteTable("design_ideas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  readingItemId: integer("reading_item_id"),
  title: text("title").notNull(),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["seed", "making", "done"] }).notNull().default("seed"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  index("design_ideas_owner_status_idx").on(table.ownerId, table.status),
  index("design_ideas_reading_idx").on(table.readingItemId),
]);

export const brandProgress = sqliteTable("brand_progress", {
  ownerId: text("owner_id").primaryKey(),
  currentPhase: text("current_phase", { enum: ["品牌定位", "产品研发", "视觉建立", "上市准备", "品牌推广", "渠道增长", "品牌扩张"] }).notNull().default("品牌定位"),
  annualDirection: text("annual_direction").notNull().default(""),
  monthlyFocus: text("monthly_focus").notNull().default(""),
  blocker: text("blocker").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const brandMilestones = sqliteTable("brand_milestones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  sourceReadingId: integer("source_reading_id"),
  title: text("title").notNull(),
  phase: text("phase", { enum: ["产品开发", "视觉设计", "包装设计", "拍摄计划", "内容选题", "品牌定位", "暂时研究"] }).notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["planned", "in_progress", "done"] }).notNull().default("planned"),
  progress: integer("progress").notNull().default(0),
  deliverable: text("deliverable").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, table => [
  index("brand_milestones_owner_status_idx").on(table.ownerId, table.status),
  index("brand_milestones_owner_due_idx").on(table.ownerId, table.dueDate),
  index("brand_milestones_source_reading_idx").on(table.sourceReadingId),
]);
