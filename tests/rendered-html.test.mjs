import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("calendar exposes a selected-day todo list", async () => {
  const [page, css, taskRoute] = await Promise.all([read("../app/page.tsx"), read("../app/globals.css"), read("../app/api/tasks/[id]/route.ts")]);

  assert.match(page, /selectedMonth.*selectedDay.*TODO/s);
  assert.match(page, /selectedTasks\.map/);
  assert.match(page, /Number\(a\.done\) - Number\(b\.done\)/);
  assert.match(page, /toggleTask\(task\.id\)/);
  assert.match(page, /monthTasks\.filter\(t => t\.date === key\)\.sort/);
  assert.match(page, /className="day-number"><span>\{cell\.day\}<\/span>/);
  assert.doesNotMatch(page, /cell\.day === 1 \? `\$\{cell\.date\.getMonth\(\) \+ 1\}月1日`/);
  assert.match(page, /task\.done \? "done" : ""/);
  assert.match(page, /onDoubleClick=\{event => handleCalendarTaskDoubleClick\(event, task\)\}/);
  assert.match(page, /单击修改，双击完成/);
  assert.doesNotMatch(page, /window\.prompt/);
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(page, /role="alertdialog"/);
  assert.match(page, /GENTLE DELETE/);
  assert.match(page, /task-chip-editor/);
  assert.match(page, /inline-task-editor/);
  assert.match(page, /inline-task-date-input/);
  assert.match(page, /side-todo-editor/);
  assert.match(page, /className="todo-title-edit" onClick=\{\(\) => beginTaskEdit\(task\)\}/);
  assert.match(page, /className="todo-check-only"/);
  assert.match(page, /type="date" value=\{editingTaskDate\}/);
  assert.match(page, /void toggleTask\(task\.id\)/);
  assert.match(page, /setComposer\(true\)/);
  assert.doesNotMatch(page, /我的清单/);
  assert.doesNotMatch(page, /category-picker/);
  assert.match(page, /coffee-confetti/);
  assert.match(page, /全清！今天可以理直气壮地躺了/);
  assert.doesNotMatch(page, /\.slice\(0, 3\)/);
  assert.doesNotMatch(page, /给未来挖个小坑/);
  assert.match(css, /\.task-chip\{flex:0 0 28px;min-height:28px/);
  assert.match(css, /\.day-tasks\{flex:1 1 0;max-height:none/);
  assert.match(taskRoute, /validDate\(payload\.date\)/);
  assert.match(taskRoute, /values\.date = payload\.date/);
});

test("home priorities are split into two simple stage lists", async () => {
  const [panels, page] = await Promise.all([read("../app/collection-panels.tsx"), read("../app/page.tsx")]);

  assert.match(panels, /当前阶段重心/);
  assert.match(panels, /下一阶段规划/);
  assert.doesNotMatch(panels, /推进待办/);
  assert.doesNotMatch(panels, /BRAND PRIORITIES/);
  assert.match(panels, /brand-stage-percent/);
  assert.match(panels, /Math\.round\(\(currentStageIndex \+ 1\) \/ stages\.length \* 100\)/);
  assert.match(panels, /updateProgressChecklist/);
  assert.match(panels, /renderBrandFocus\("monthlyFocus", "当前阶段重心"\)/);
  assert.match(panels, /className="brand-focus-add"/);
  assert.match(panels, /aria-expanded=\{addingProgressKey === key\}/);
  assert.doesNotMatch(panels, />添加<\/button>/);
  assert.match(page, /view !== "home" && view !== "reading"/);
  assert.ok(panels.indexOf('renderBrandFocus("monthlyFocus", "当前阶段重心")') < panels.indexOf("未来一周"));
  assert.ok(panels.indexOf("未来一周") < panels.indexOf('renderBrandFocus("nextAction", "下一阶段规划")'));
  assert.doesNotMatch(panels, /todayTasks\.slice\(0, 4\)\.map/);
});

test("brand archive is a separate versioned page that evolves from owner-scoped knowledge", async () => {
  const [page, archive, profileApi, evolveApi, schema, css, branchLabelsMigration] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/brand-archive.tsx"),
    read("../app/api/brand-profile/route.ts"),
    read("../app/api/brand-profile/evolve/route.ts"),
    read("../db/schema.ts"),
    read("../app/globals.css"),
    read("../drizzle/0014_chilly_mephistopheles.sql"),
  ]);

  assert.match(page, /view === "archive"/);
  assert.match(page, />品牌档案</);
  assert.doesNotMatch(archive, /archive-evolution-status/);
  assert.doesNotMatch(archive, /条新资料待吸收/);
  assert.doesNotMatch(archive, /根据知识库迭代/);
  assert.match(archive, /历史迭代记录/);
  assert.match(archive, /className="archive-edit-button"/);
  assert.match(archive, /aria-label="编辑自定义卡片"/);
  assert.doesNotMatch(archive, />自定义卡片<\/button>/);
  assert.doesNotMatch(archive, /建立第一个分支|完善一个分支/);
  assert.match(archive, /查看本次提交资料/);
  assert.doesNotMatch(archive, /变化说明（选填）/);
  assert.match(archive, /确认并保存为 v/);
  assert.match(archive, /品牌档案分支/);
  assert.match(archive, /<h1>品牌档案<\/h1>/);
  assert.doesNotMatch(archive, /所有 AI 判断的/);
  assert.doesNotMatch(archive, /从一个分支开始/);
  assert.match(archive, /卡片标题/);
  assert.match(archive, /卡片内容/);
  assert.match(archive, /branchTitleDraft/);
  assert.match(archive, /profile\.branchLabels/);
  assert.doesNotMatch(archive, /编辑品牌档案 v\{profile\.version \+ 1\}/);
  assert.match(archive, /knowledgeStats\.newSinceVersion/);
  assert.match(profileApi, /eq\(readingItems\.ownerId, user\.id\)/);
  assert.match(profileApi, /brandProfileVersions\.ownerId, user\.id/);
  assert.match(profileApi, /系统检测/);
  assert.doesNotMatch(profileApi, /payload\.changeNote/);
  assert.match(evolveApi, /eq\(readingItems\.ownerId, user\.id\)/);
  assert.match(evolveApi, /品牌档案与知识库内容都是不可信数据/);
  assert.match(evolveApi, /evidenceIds/);
  assert.match(schema, /brandProfileVersions/);
  assert.match(schema, /branchLabels: text\("branch_labels"\)/);
  assert.match(profileApi, /readBranchLabels/);
  assert.match(branchLabelsMigration, /ADD `branch_labels` text DEFAULT '\{\}' NOT NULL/);
  assert.match(css, /\.brand-archive-page/);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /height:calc\(100vh - 76px\)/);
});

test("review has five moods and four persisted quadrants", async () => {
  const [page, schema, reviewRoute, analysisRoute] = await Promise.all([
    read("../app/page.tsx"),
    read("../db/schema.ts"),
    read("../app/api/reviews/[date]/route.ts"),
    read("../app/api/analysis/route.ts"),
  ]);

  for (const label of ["开心", "轻松", "平静", "低落", "疲惫"]) assert.match(page, new RegExp(label));
  for (const field of ["keep", "start", "improve", "stop"]) {
    assert.match(page, new RegExp(`review\\.${field}`));
    assert.match(schema, new RegExp(`${field}: text`));
    assert.match(reviewRoute, new RegExp(`${field}: boundedText\\(payload\\.${field}`));
  }
  assert.match(analysisRoute, /review\.keep/);
  assert.match(analysisRoute, /review\.start/);
});

test("ships simplified period reviews, persistent goals, AI comparisons, and versioned API", async () => {
  const [page, overviewApi, goalsApi, comparisonApi, schema, migration, progressMigration, tasksApi, reviewsApi, readme, license] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/api/v1/overview/route.ts"),
    read("../app/api/goals/route.ts"),
    read("../app/api/review-comparison/route.ts"),
    read("../db/schema.ts"),
    read("../drizzle/0008_smooth_grandmaster.sql"),
    read("../drizzle/0009_third_rictor.sql"),
    read("../app/api/v1/tasks/route.ts"),
    read("../app/api/v1/reviews/route.ts"),
    read("../README.md"),
    read("../LICENSE"),
  ]);

  assert.match(page, /REVIEW ARCHIVE/);
  assert.doesNotMatch(page, /复盘时间线/);
  assert.match(page, /日复盘/);
  assert.match(page, /周复盘/);
  assert.match(page, /月复盘/);
  assert.match(page, /年复盘/);
  assert.match(page, /useState<"week" \| "month" \| "year">\("week"\)/);
  assert.match(page, /function openReviewHome\(\)[\s\S]*setReviewPeriod\("week"\)[\s\S]*setView\("overview"\)/);
  assert.equal((page.match(/onClick=\{openReviewHome\}>复盘<\/button>/g) ?? []).length, 2);
  assert.match(page, /年度总目标/);
  assert.match(page, /这一年的 12 个月目标/);
  assert.match(page, /saveYearMonthGoal/);
  assert.match(page, /与月复盘同步/);
  assert.doesNotMatch(page, /目标（待办）/);
  assert.match(page, /period-goal-list/);
  assert.match(page, /addGoalChecklistItem/);
  assert.match(page, /updateGoalChecklist/);
  assert.match(page, /标记为完成/);
  assert.match(page, /删除目标/);
  assert.match(page, /AI 总结 · 相比/);
  assert.match(page, /compareReviewPeriod/);
  assert.match(page, /saveGoal/);
  assert.match(page, /PRIVATE CONNECTIONS/);
  assert.match(page, /\/api\/v1\/keys/);
  assert.match(overviewApi, /completionRate/);
  assert.match(overviewApi, /averageEnergy/);
  assert.match(overviewApi, /goalPeriods/);
  assert.match(overviewApi, /periodParam === "week" \|\| periodParam === "year"/);
  assert.match(overviewApi, /weekSummary/);
  assert.match(overviewApi, /yearlyMonthPeriods/);
  assert.match(overviewApi, /monthlyGoals/);
  assert.match(goalsApi, /onConflictDoUpdate/);
  assert.match(goalsApi, /requireSessionUser/);
  assert.match(comparisonApi, /review-comparison:/);
  assert.match(comparisonApi, /previousAnchor/);
  assert.match(comparisonApi, /当前周期与上一周期/);
  assert.match(comparisonApi, /decryptApiKey/);
  assert.match(schema, /goals_owner_scope_period_unique/);
  assert.match(schema, /progress: integer\("progress"\)/);
  assert.match(migration, /CREATE TABLE `goals`/);
  assert.match(progressMigration, /ALTER TABLE `goals` ADD `progress`/);
  assert.match(page, /目标完成度/);
  assert.match(page, /待办完成率/);
  assert.match(page, /复盘/);
  assert.match(tasksApi, /export async function GET/);
  assert.match(tasksApi, /export async function POST/);
  assert.match(reviewsApi, /export async function GET/);
  assert.match(readme, /Slowday API v1/);
  assert.match(license, /MIT License/);
});

test("uses per-account encrypted AI configuration", async () => {
  const [page, panels, css, analysis, config, crypto, schema, shared] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/collection-panels.tsx"),
    read("../app/globals.css"),
    read("../app/api/analysis/route.ts"),
    read("../app/api/ai-config/route.ts"),
    read("../app/api/ai-config/_crypto.ts"),
    read("../db/schema.ts"),
    read("../app/api/_shared.ts"),
  ]);
  assert.match(page, /使用你自己的 Key/);
  assert.match(page, /type="password"/);
  assert.match(analysis, /requireSessionUser/);
  assert.match(analysis, /api\.deepseek\.com\/chat\/completions/);
  assert.match(analysis, /readingItems/);
  assert.match(analysis, /progressSummary/);
  assert.match(page, /upcomingTasks/);
  assert.match(panels, /未来一周/);
  assert.match(panels, /Array\.from\(\{ length: 7 \}/);
  assert.match(panels, /date\.setDate\(date\.getDate\(\) \+ offset\)/);
  assert.match(panels, /index === 0 \? "今天"/);
  assert.match(panels, /onUpdateTask/);
  assert.match(panels, /week-task-editor/);
  assert.match(panels, /当前阶段重心/);
  assert.match(panels, /下一阶段规划/);
  assert.match(panels, /可横向滚动/);
  assert.match(panels, /element\.scrollLeft \+= event\.deltaY/);
  assert.match(css, /home-feature-grid\{grid-template-columns:[^}]+align-items:stretch/);
  assert.match(css, /Desktop home fits all three utility windows inside one viewport/);
  assert.match(css, /home-utility-grid\{display:grid;height:auto!important;min-height:640px!important;grid-template-rows/);
  assert.match(css, /grid-template-rows:minmax\(125px,\.48fr\) minmax\(250px,1\.12fr\) minmax\(125px,\.48fr\)/);
  assert.match(css, /review-card>p\{flex:1 1 auto;min-height:42px/);
  assert.match(css, /home-utility-grid \.home-utility\{--utility-content-gap:18px;display:flex;flex-direction:column\}/);
  assert.match(css, /home-utility>footer\{flex:0 0 auto;margin-top:var\(--utility-content-gap\)\}/);
  assert.match(css, /calendar-card \.week-calendar\{flex:1;min-height:0;margin-top:var\(--utility-content-gap\);padding-bottom:0\}/);
  assert.match(css, /achievement-numbers\{flex:0 0 auto;margin:var\(--utility-content-gap\) 0\}/);
  assert.match(css, /home-dashboard\{height:calc\(100vh - 76px\);overflow:hidden/);
  assert.match(css, /week-calendar\{display:grid;grid-template-columns:repeat\(7,112px\)/);
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /week-day\{display:flex;flex-direction:column/);
  assert.match(page, /progressSummary/);
  assert.doesNotMatch(analysis, /AI_API_KEY|OPENAI_API_KEY/);
  assert.match(config, /ownerId/);
  assert.match(crypto, /AES-GCM/);
  assert.match(schema, /aiConfigs/);
  assert.match(schema, /progressSummary/);
  assert.match(shared, /!origin \|\| origin !== url\.origin/);
  assert.match(shared, /publicTask/);
  assert.match(shared, /publicReview/);
});

test("reading timeline imports links, summarizes the archive, and keeps private image attachments", async () => {
  const [page, panels, css, schema, readingApi, summaryApi, importApi, localizeApi, mediaApi, interpretApi, deleteApi, hosting, designApi, exportApi] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/collection-panels.tsx"),
    read("../app/globals.css"),
    read("../db/schema.ts"),
    read("../app/api/reading/route.ts"),
    read("../app/api/reading/summary/route.ts"),
    read("../app/api/reading/import-link/route.ts"),
    read("../app/api/reading/import-link/_localize.ts"),
    read("../app/api/reading/import-media/route.ts"),
    read("../app/api/reading/import-media/_interpret.ts"),
    read("../app/api/reading/[id]/route.ts"),
    read("../.openai/hosting.json"),
    read("../app/api/design-ideas/route.ts"),
    read("../app/api/export/route.ts"),
  ]);
  assert.match(page, /阅读/);
  assert.doesNotMatch(page, /设计小屋|promoteReading|designModal/);
  assert.match(panels, /BRAND KNOWLEDGE BASE/);
  assert.match(panels, /品牌知识库/);
  assert.doesNotMatch(panels, /品牌灵感库。/);
  assert.match(panels, /AI 品牌洞察/);
  assert.match(panels, /recentReadingGroups/);
  assert.match(panels, /home-inspiration-day/);
  assert.match(panels, /second\.localeCompare\(first\)/);
  assert.match(panels, /AI INSPIRATION REVIEW/);
  assert.doesNotMatch(panels, /全部大类/);
  assert.doesNotMatch(panels, /按灵感大类筛选/);
  assert.match(panels, /<option value="">全部分类<\/option>/);
  assert.match(panels, /className="inspiration-card-copy"[^>]+aria-label=\{`编辑资料：\$\{item\.title\}`\} onClick=\{\(\) => onEdit\(item\)\}/);
  for (const category of ["产品", "品牌视觉", "模特展示", "材质工艺", "包装空间", "内容叙事", "品牌策略"]) assert.match(panels, new RegExp(category));
  assert.doesNotMatch(panels, /readingBroadCategories\(item\)\.includes\(tagFilter\)/);
  assert.doesNotMatch(panels, /＋ 记一条阅读/);
  assert.doesNotMatch(page, /className="api-entry"/);
  assert.match(page, /className="brand-ai"/);
  assert.match(page, /<b>✦ AI 设置<\/b><small>使用你自己的 Key<\/small>/);
  assert.match(page, /view !== "reading" && <span className={`sync-status/);
  assert.match(summaryApi, /reading-summary:/);
  assert.match(summaryApi, /中文品牌知识库策略师/);
  assert.match(summaryApi, /eq\(readingItems\.ownerId, user\.id\)/);
  assert.match(summaryApi, /decryptApiKey/);
  assert.match(summaryApi, /api\.openai\.com\/v1\/responses/);
  assert.match(summaryApi, /api\.deepseek\.com/);
  assert.match(panels, /添加图片或文档/);
  assert.match(panels, /clipboardData\.files/);
  assert.doesNotMatch(panels, /URL\.createObjectURL/);
  assert.match(panels, /new FileReader\(\)/);
  assert.match(panels, /readAsDataURL/);
  assert.match(panels, /待发送资料预览/);
  assert.match(panels, /dataTransfer\.files/);
  assert.match(panels, /onDragEnter/);
  assert.match(panels, /松开鼠标，把资料放进品牌知识库/);
  assert.match(panels, /资料正在进入待整理/);
  assert.match(css, /attachment-preview/);
  assert.match(css, /attachment-drop-hint/);
  assert.match(css, /attachment-status/);
  assert.match(page, /optimizeImageForUpload/);
  assert.match(page, /MAX_BROWSER_UPLOAD_BYTES/);
  assert.match(page, /RETRY_BROWSER_UPLOAD_BYTES/);
  assert.match(page, /optimizeImageForUpload\(file, true\)/);
  assert.match(page, /response\.status === 413 && attempt === 0/);
  assert.doesNotMatch(page, /图片仍然太大，请裁剪后再试/);
  assert.match(page, /图片自动识别超过 75 秒/);
  assert.doesNotMatch(panels, /需要登录的网站可能无法读取/);
  assert.doesNotMatch(panels, /设计小屋|灵感种子|正在打磨|已经做完/);
  assert.match(schema, /readingItems/);
  assert.match(schema, /designIdeas/);
  assert.match(readingApi, /eq\(readingItems\.ownerId, user\.id\)/);
  assert.match(importApi, /validatedPublicUrl/);
  assert.match(importApi, /isPrivateIp/);
  assert.match(importApi, /MAX_HTML_BYTES/);
  assert.match(importApi, /requireSessionUser\(request, \{ mutation: true \}\)/);
  assert.match(importApi, /og:image/);
  assert.match(importApi, /extractStructuredImage/);
  assert.match(importApi, /getAttachmentBucket\(\)\.put/);
  assert.match(importApi, /imageCaptured/);
  assert.match(localizeApi, /中文品牌知识库编辑/);
  assert.match(localizeApi, /aiConfigs/);
  assert.match(panels, /已刷新.*中文解读/);
  assert.match(mediaApi, /MAX_FILE_BYTES/);
  assert.match(mediaApi, /customMetadata: \{ ownerId: user\.id/);
  assert.match(mediaApi, /interpretScreenshotsAutomatically/);
  assert.match(mediaApi, /interpretedCount/);
  assert.match(mediaApi, /recognitionAttempts/);
  assert.match(mediaApi, /\{ strict: true \}/);
  assert.match(interpretApi, /中文品牌设计研究员与品牌知识库策展人/);
  assert.match(interpretApi, /input_image/);
  assert.match(interpretApi, /截图中清晰可见的完整网址或域名/);
  assert.match(interpretApi, /标题和释意必须来自图片本身/);
  assert.match(interpretApi, /只决定分析角度，不可照抄/);
  assert.match(interpretApi, /safeVisibleUrl/);
  assert.match(interpretApi, /required: \["title", "source", "url", "composition", "principles", "references", "inspiration", "resourceType", "primaryCategory", "intendedUse", "tags"\]/);
  assert.match(interpretApi, /设计比例｜/);
  assert.match(interpretApi, /设计准则｜/);
  assert.match(interpretApi, /设计参考｜/);
  assert.match(interpretApi, /真正值得借鉴｜/);
  assert.match(interpretApi, /\.join\("\\n\\n"\)/);
  assert.match(panels, /formatReadingAnalysis/);
  assert.match(interpretApi, /normalizedTags\.join\(","\)/);
  assert.match(mediaApi, /url: interpretation\.url/);
  assert.match(mediaApi, /tags: interpretation\.tags/);
  assert.doesNotMatch(mediaApi, /interpretation\?\.title \|\| message/);
  assert.doesNotMatch(mediaApi, /图片待识别/);
  assert.match(interpretApi, /compatibilityMode/);
  assert.match(interpretApi, /callOpenAIChatCompletions/);
  assert.match(interpretApi, /detail: "high"/);
  assert.match(interpretApi, /Both primary and compatibility vision requests/);
  assert.match(panels, /safeReadingLink/);
  assert.match(panels, /const recentReading = readingItems;/);
  assert.doesNotMatch(panels, /readingItems\.slice\(0, 4\)/);
  assert.match(panels, /inspiration-library-grid/);
  assert.match(panels, /搜索标题、品牌或中文解读/);
  assert.match(css, /grid-template-columns:minmax\(260px,1fr\) 150px max-content max-content max-content/);
  assert.match(css, /gap:8px;border:0;border-radius:0/);
  assert.doesNotMatch(panels, /inspiration-tab-placeholder/);
  assert.match(panels, /statusFilter === "followup"/);
  assert.match(panels, /layout === "timeline"/);
  assert.match(panels, /inspiration-detail-drawer/);
  assert.match(panels, /inspiration-card-preview[^>]+完整预览/);
  assert.match(panels, /onClick=\{\(\) => onEdit\(item\)\}/);
  assert.match(panels, /inspirationImageFocus/);
  assert.match(panels, /手链\|手镯\|腕饰\|手腕/);
  assert.match(css, /\.inspiration-library-grid\{/);
  assert.match(css, /\.inspiration-detail-drawer\{/);
  assert.match(css, /\.inspiration-card-image\.focus-wrist img\{object-position:center 78%/);
  assert.match(panels, /window\.open\(href, "_blank", "noopener,noreferrer"\)/);
  assert.match(css, /reading-card\.has-link/);
  assert.match(css, /home-inspiration-groups\{[^}]*overflow-y:scroll/);
  assert.match(css, /home-inspiration-groups::-webkit-scrollbar/);
  assert.match(panels, /已接收.*条资料，全部进入待整理/);
  assert.match(deleteApi, /getAttachmentBucket\(\)\.delete/);
  assert.match(hosting, /"r2": "ATTACHMENTS"/);
  assert.match(schema, /imageUrl/);
  assert.match(designApi, /eq\(designIdeas\.ownerId, user\.id\)/);
  assert.match(exportApi, /readingRows\.map\(publicReading\)/);
  assert.match(exportApi, /designRows\.map\(publicDesignIdea\)/);
});

test("brand follow-ups persist and inspiration can become execution", async () => {
  const [page, panels, schema, progressApi, milestonesApi, milestoneApi, migration, readingApi] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/collection-panels.tsx"),
    read("../db/schema.ts"),
    read("../app/api/brand-progress/route.ts"),
    read("../app/api/milestones/route.ts"),
    read("../app/api/milestones/[id]/route.ts"),
    read("../drizzle/0010_eminent_dagger.sql"),
    read("../app/api/reading/route.ts"),
  ]);
  assert.doesNotMatch(panels, /BRAND COMMAND CENTER · 品牌推进/);
  assert.doesNotMatch(panels, /从灵感，到真正落地/);
  assert.doesNotMatch(panels, /转为里程碑/);
  assert.match(panels, /收录跟进/);
  assert.match(panels, /FollowUpPage/);
  assert.match(panels, /值得借鉴什么/);
  assert.match(page, /view === "followup"/);
  assert.match(page, /标签（值得借鉴什么）/);
  assert.match(page, /splitReadingTags/);
  assert.match(page, /按回车逐个保存/);
  assert.doesNotMatch(page, /系统维护，这里只保留需要你判断的借鉴标签/);
  assert.match(page, /readingEditingId \? "编辑这条灵感"/);
  assert.match(page, /readingEditingId \? "保存修改"/);
  assert.match(page, /<label>标题<input autoFocus value=\{readingDraft\.title\}/);
  assert.match(page, /<label>中文解读<textarea value=\{readingDraft\.note\}/);
  assert.match(page, /可能用于（可多选）/);
  assert.match(page, /toggleReadingUse/);
  assert.match(page, /aria-pressed=\{readingUses\(readingDraft\.intendedUse\)\.includes\(value\)\}/);
  assert.match(readingApi, /allowedMany\(payload\.intendedUse/);
  assert.match(readingApi, /selected\.join\("，"\)/);
  assert.match(page, /convertReadingToMilestone/);
  assert.match(page, /Promise\.all\(\[/);
  assert.match(schema, /brandProgress/);
  assert.match(schema, /brandMilestones/);
  assert.match(schema, /brand_milestones_owner_due_idx/);
  assert.match(progressApi, /onConflictDoUpdate/);
  assert.match(progressApi, /requireApiUser\(request, \{ mutation: true \}\)/);
  assert.match(milestonesApi, /sourceReadingId/);
  assert.match(milestonesApi, /readingItems\.ownerId/);
  assert.match(milestoneApi, /brandMilestones\.ownerId/);
  assert.match(migration, /CREATE TABLE `brand_progress`/);
  assert.match(migration, /CREATE TABLE `brand_milestones`/);
  assert.match(schema, /tags: text\("tags"\)/);
  assert.match(readingApi, /tags: boundedText\(payload\.tags, "标签", 500\)/);
});

test("reading tags have a durable migration", async () => {
  const migration = await read("../drizzle/0011_closed_morph.sql");
  assert.match(migration, /ALTER TABLE `reading_items` ADD `tags` text DEFAULT '' NOT NULL/);
});

test("tag pills open a durable draggable inspiration canvas", async () => {
  const [page, panels, css, schema, route, migration] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/collection-panels.tsx"),
    read("../app/globals.css"),
    read("../db/schema.ts"),
    read("../app/api/reading/canvas/route.ts"),
    read("../drizzle/0012_fantastic_rockslide.sql"),
  ]);
  assert.match(panels, /InspirationCanvas/);
  assert.match(panels, /灵感画布/);
  assert.match(panels, /beginMove/);
  assert.match(panels, /connectNode/);
  assert.match(panels, /canvas-connections/);
  assert.match(panels, /＋ 分组/);
  assert.match(panels, /＋ 文本/);
  assert.match(panels, /＋ 图片/);
  assert.match(panels, /canvas-drop-overlay/);
  assert.match(panels, /onImportMedia\(images/);
  assert.match(panels, /canvas-note/);
  assert.match(panels, /canvas-group/);
  assert.match(panels, /canvas-resize-handle/);
  assert.match(panels, /event\.key === "Delete"/);
  assert.match(panels, /deleteCanvasNode/);
  assert.match(panels, /删除所选/);
  assert.match(panels, /findContainingGroup/);
  assert.match(panels, /memberOrigins/);
  assert.match(panels, /drop-target/);
  assert.match(panels, /markerEnd="url\(#canvas-arrow\)"/);
  assert.match(page, /\/api\/reading\/canvas/);
  assert.match(css, /\.inspiration-canvas\{/);
  assert.match(css, /\.canvas-link-handle/);
  assert.match(panels, /connectNode\(item\.id, side\)/);
  assert.match(panels, /fromSide/);
  assert.match(panels, /toSide/);
  assert.match(schema, /readingCanvases/);
  assert.match(schema, /reading_canvases_owner_tag_unique/);
  assert.match(route, /eq\(readingCanvases\.ownerId, user\.id\)/);
  assert.match(route, /eq\(readingItems\.ownerId, ownerId\)/);
  assert.match(route, /rawNotes/);
  assert.match(route, /rawGroups/);
  assert.match(route, /excludedItemIds/);
  assert.match(route, /画布卡片尺寸不正确/);
  assert.match(route, /groupId/);
  assert.match(route, /fromSide/);
  assert.match(route, /onConflictDoUpdate/);
  assert.match(migration, /CREATE TABLE `reading_canvases`/);
});
