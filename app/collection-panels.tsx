"use client";
/* Remote Open Graph images have arbitrary hosts, so they intentionally bypass next/image. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { CalendarIcon } from "./calendar-icon";

export type ReadingItem = {
  id: number;
  date: string;
  title: string;
  source: string;
  url: string;
  imageUrl: string;
  note: string;
  tags: string;
  resourceType: "图片" | "网页链接" | "文档" | "文字想法" | "用户反馈" | "供应商资料";
  primaryCategory: string;
  workflowStatus: "pending" | "confirmed";
  intendedUse: string;
  duplicateOf: number | null;
  topic: string;
  createdAt: string;
  updatedAt: string;
};

export type BrandProfile = { story: string; philosophy: string; audience: string; keywords: string; differentiation: string; productDirection: string; visualLanguage: string; annualGoal: string; version: number; updatedAt?: string | null };
export type BrandProfileVersion = { id: number; version: number; snapshot: BrandProfile; changeNote: string; createdAt: string };

export type ReadingCanvasLayout = {
  nodes: Array<{ readingItemId: number; x: number; y: number }>;
  edges: Array<{ from: number; to: number }>;
  notes: Array<{ id: string; x: number; y: number; text: string }>;
  groups: Array<{ id: string; x: number; y: number; width: number; height: number; title: string }>;
};

export type BrandStage = "品牌定位" | "产品研发" | "视觉建立" | "上市准备" | "品牌推广" | "渠道增长" | "品牌扩张";
export type BrandPhase = "产品开发" | "视觉设计" | "包装设计" | "拍摄计划" | "内容选题" | "品牌定位" | "暂时研究";
export type BrandProgress = { currentPhase: BrandStage; annualDirection: string; monthlyFocus: string; blocker: string; nextAction: string; updatedAt?: string | null };
export type BrandMilestone = { id: number; sourceReadingId: number | null; title: string; phase: BrandPhase; dueDate: string; status: "planned" | "in_progress" | "done"; progress: number; deliverable: string; createdAt: string; updatedAt: string };

type HomeTask = { id: number; date: string; title: string; category: "工作" | "生活" | "成长"; done: boolean };
type BrandChecklistItem = { text: string; done: boolean };

function parseBrandChecklist(value: string): BrandChecklistItem[] {
  return value.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^[-•]?\s*\[([ xX])\]\s*(.+)$/);
    return match ? { done: match[1].toLowerCase() === "x", text: match[2].trim() } : { done: false, text: line.replace(/^[-•]\s*/, "").trim() };
  }).filter(item => item.text);
}

function serializeBrandChecklist(items: BrandChecklistItem[]) {
  return items.map(item => `- [${item.done ? "x" : " "}] ${item.text.trim()}`).filter(line => !line.endsWith("] ")).join("\n");
}

type HomeDashboardProps = {
  todayKey: string;
  upcomingTasks: HomeTask[];
  readingItems: ReadingItem[];
  brandProgress: BrandProgress;
  brandMilestones: BrandMilestone[];
  onOpenReading: () => void;
  onOpenCalendar: () => void;
  onToggleTask: (id: number) => void;
  onUpdateTask: (task: HomeTask, title: string, date: string) => Promise<void>;
  onEditReading: (item: ReadingItem) => void;
  onDeleteReading: (item: ReadingItem) => void;
  onReanalyzeReading: (item: ReadingItem) => Promise<void>;
  onSaveBrandProgress: (progress: BrandProgress) => Promise<void>;
  onAddMilestone: (input: { title: string; phase: BrandPhase; dueDate: string; deliverable?: string }) => Promise<void>;
  onUpdateMilestone: (milestone: BrandMilestone, values: Partial<Pick<BrandMilestone, "title" | "phase" | "dueDate" | "status" | "progress" | "deliverable">>) => Promise<void>;
  onDeleteMilestone: (milestone: BrandMilestone) => Promise<void>;
  onConvertReading: (item: ReadingItem) => Promise<void>;
  onImportLink: (url: string) => Promise<{ item: ReadingItem; duplicate: boolean; refreshed?: boolean; localized?: boolean; imageCaptured?: boolean }>;
  onImportMedia: (files: File[], message: string) => Promise<{ items: ReadingItem[]; interpretedCount?: number }>;
};

export function HomeDashboard({ todayKey, upcomingTasks, readingItems, brandProgress, brandMilestones, onOpenReading, onOpenCalendar, onToggleTask, onUpdateTask, onEditReading, onDeleteReading, onReanalyzeReading, onSaveBrandProgress, onConvertReading, onImportLink, onImportMedia }: HomeDashboardProps) {
  const taskClickTimers = useRef<Record<number, number>>({});
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskDate, setEditingTaskDate] = useState("");
  const [progressDraft, setProgressDraft] = useState<BrandProgress | null>(null);
  const [newProgressItem, setNewProgressItem] = useState({ monthlyFocus: "", nextAction: "" });
  const [addingProgressKey, setAddingProgressKey] = useState<"monthlyFocus" | "nextAction" | null>(null);
  const progressForm = progressDraft ?? brandProgress;
  const recentReading = readingItems;
  const recentReadingGroups = recentReading.reduce<Record<string, ReadingItem[]>>((result, item) => {
    (result[item.date] ??= []).push(item);
    return result;
  }, {});
  const week = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(`${todayKey}T12:00:00`);
    date.setDate(date.getDate() + offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { key, date, plans: upcomingTasks.filter(task => task.date === key && !task.done) };
  });
  const upcomingCount = week.reduce((total, item) => total + item.plans.length, 0);
  function handleTaskClick(event: ReactMouseEvent<HTMLButtonElement>, task: HomeTask) {
    event.stopPropagation();
    const pending = taskClickTimers.current[task.id];
    if (pending) window.clearTimeout(pending);
    taskClickTimers.current[task.id] = window.setTimeout(() => {
      delete taskClickTimers.current[task.id];
      setEditingTaskId(task.id);
      setEditingTaskTitle(task.title);
      setEditingTaskDate(task.date);
    }, 240);
  }
  function handleTaskDoubleClick(event: ReactMouseEvent<HTMLButtonElement>, task: HomeTask) {
    event.stopPropagation();
    const pending = taskClickTimers.current[task.id];
    if (pending) window.clearTimeout(pending);
    delete taskClickTimers.current[task.id];
    onToggleTask(task.id);
  }
  async function saveTaskEdit(task: HomeTask) {
    const title = editingTaskTitle.trim();
    const date = editingTaskDate;
    setEditingTaskId(null);
    if (title && date && (title !== task.title || date !== task.date)) await onUpdateTask(task, title, date);
  }
  function handleTaskEditorBlur(event: ReactFocusEvent<HTMLDivElement>, task: HomeTask) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    void saveTaskEdit(task);
  }
  const stages: BrandStage[] = ["品牌定位", "产品研发", "视觉建立", "上市准备", "品牌推广", "渠道增长", "品牌扩张"];
  const currentStageIndex = Math.max(0, stages.indexOf(progressForm.currentPhase));
  function updateProgressChecklist(key: "monthlyFocus" | "nextAction", items: BrandChecklistItem[], save = false) {
    const next = { ...progressForm, [key]: serializeBrandChecklist(items) };
    setProgressDraft(next);
    if (save) void onSaveBrandProgress(next);
  }
  function addProgressItem(key: "monthlyFocus" | "nextAction") {
    const text = newProgressItem[key].trim();
    if (!text) return;
    updateProgressChecklist(key, [...parseBrandChecklist(progressForm[key]), { text, done: false }], true);
    setNewProgressItem(current => ({ ...current, [key]: "" }));
    setAddingProgressKey(null);
  }
  function renderBrandFocus(key: "monthlyFocus" | "nextAction", label: string) {
    const checklist = parseBrandChecklist(progressForm[key]);
    return <section className="brand-focus-group"><header><h2>{label}</h2><button className="brand-focus-add" onClick={() => setAddingProgressKey(current => current === key ? null : key)} aria-label={`添加${label}`} aria-expanded={addingProgressKey === key}>＋</button></header><div>{checklist.length ? checklist.map((item, index) => <div className={item.done ? "done" : ""} key={`${key}-${index}`}><button className="brand-check" aria-label={item.done ? "标记为未完成" : "标记为完成"} onClick={() => updateProgressChecklist(key, checklist.map((entry, itemIndex) => itemIndex === index ? { ...entry, done: !entry.done } : entry), true)}>{item.done ? "✓" : ""}</button><input value={item.text} maxLength={180} onChange={event => updateProgressChecklist(key, checklist.map((entry, itemIndex) => itemIndex === index ? { ...entry, text: event.target.value } : entry))} onBlur={() => void onSaveBrandProgress(progressForm)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={`${label} ${index + 1}`} /><button className="brand-check-delete" aria-label="删除这一项" onClick={() => updateProgressChecklist(key, checklist.filter((_, itemIndex) => itemIndex !== index), true)}>×</button></div>) : null}</div>{addingProgressKey === key && <footer><input autoFocus value={newProgressItem[key]} maxLength={180} placeholder="输入后按回车保存" onChange={event => setNewProgressItem(current => ({ ...current, [key]: event.target.value }))} onKeyDown={event => { if (event.key === "Enter") addProgressItem(key); if (event.key === "Escape") setAddingProgressKey(null); }} onBlur={() => { if (!newProgressItem[key].trim()) setAddingProgressKey(null); }} aria-label={`输入${label}`} /></footer>}</section>;
  }
  return <section className="home-dashboard">
    <section className="brand-command-strip">
      <div className="brand-stage-row"><div className="brand-stage-track" style={{ "--stage-progress": `${currentStageIndex / (stages.length - 1) * 100}%` } as CSSProperties}>{stages.map((stage, index) => <button key={stage} className={index < currentStageIndex ? "done" : index === currentStageIndex ? "active" : ""} onClick={() => { const next = { ...progressForm, currentPhase: stage }; setProgressDraft(next); void onSaveBrandProgress(next); }}><i>{index < currentStageIndex ? "✓" : index + 1}</i><span>{stage}</span></button>)}</div><b className="brand-stage-percent">{Math.round((currentStageIndex + 1) / stages.length * 100)}%</b></div>
    </section>
    <div className="home-feature-grid">
      <section className="home-reading">
        <header><div><small>BRAND KNOWLEDGE BASE</small><h1>品牌知识库</h1></div><button onClick={onOpenReading}>查看全部 ↗</button></header>
        {recentReading.length ? <div className="home-inspiration-groups">{Object.entries(recentReadingGroups).sort(([first], [second]) => second.localeCompare(first)).map(([date, dayItems]) => <section className="home-inspiration-day" key={date}>
          <div className="home-day"><i /><b>{Number(date.slice(8))}</b><span>{date.slice(0, 4)} 年 {Number(date.slice(5, 7))} 月<small>{weekdayName(date)} · {dayItems.length} 条灵感</small></span></div>
          <div className="home-reading-list">{dayItems.map((item, index) => { const href = safeReadingLink(item.url); return <article key={item.id} className={item.imageUrl ? "with-image" : ""}>
          <span>{String(index + 1).padStart(2, "0")}</span>{item.imageUrl && <img src={item.imageUrl} alt={href ? `打开原文：${item.title}` : ""} loading="lazy" referrerPolicy="no-referrer" role={href ? "link" : undefined} tabIndex={href ? 0 : undefined} onClick={event => { if (!href) return; event.stopPropagation(); window.open(href, "_blank", "noopener,noreferrer"); }} onKeyDown={event => { if (!href || (event.key !== "Enter" && event.key !== " ")) return; event.preventDefault(); window.open(href, "_blank", "noopener,noreferrer"); }} onError={event => { event.currentTarget.style.display = "none"; }} />}<div><small>{item.source || "私人摘录"}</small>{href ? <a className="home-reading-summary-link" href={href} target="_blank" rel="noreferrer"><h2>{item.title}</h2><p>{item.note || "这条阅读还没有写旁注。"}</p></a> : <div className="home-reading-summary-text"><h2>{item.title}</h2><p>{item.note || "这条阅读还没有写旁注。"}</p></div>}<footer><time>{item.date.replaceAll("-", ".")}</time><span>{item.imageUrl && !href && <button onClick={() => void onReanalyzeReading(item)}>重新识别</button>}<button onClick={() => onEditReading(item)}>编辑</button><button className="timeline-delete" onClick={() => onDeleteReading(item)}>删除</button></span></footer></div>
          <div className="inspiration-execute"><button disabled={brandMilestones.some(milestone => milestone.sourceReadingId === item.id)} onClick={() => void onConvertReading(item)}>{brandMilestones.some(milestone => milestone.sourceReadingId === item.id) ? "已收录跟进" : "收录跟进 →"}</button></div></article>; })}</div>
        </section>)}</div> : <button className="home-empty" onClick={onOpenReading}>灵感库还空着，去存入第一条品牌灵感 →</button>}
        <ReadingLinkChat onImport={onImportLink} onImportMedia={onImportMedia} />
      </section>
      <div className="home-utility-grid">
        <section className="brand-focus-card current">{renderBrandFocus("monthlyFocus", "当前阶段重心")}</section>
        <section className="home-utility calendar-card"><header><div><small>WEEK AHEAD</small><h2>未来一周</h2></div><button onClick={onOpenCalendar}>打开日历 ↗</button></header><div className="week-calendar" tabIndex={0} aria-label="从今天开始的七天安排，可横向滚动" onWheel={event => { const element = event.currentTarget; if (element.scrollWidth <= element.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return; const canMove = event.deltaY > 0 ? element.scrollLeft < element.scrollWidth - element.clientWidth : element.scrollLeft > 0; if (canMove) { event.preventDefault(); element.scrollLeft += event.deltaY; } }}>{week.map((item, index) => <div className={`week-day ${item.plans.length ? "has-plans" : ""}`} key={item.key}><time dateTime={item.key}><b>{index === 0 ? "今天" : item.date.toLocaleDateString("zh-CN", { weekday: "short" })}</b><span>{item.date.getMonth() + 1}/{item.date.getDate()}</span></time><div>{item.plans.length ? item.plans.map(task => editingTaskId === task.id ? <div key={task.id} className="week-task-editor inline-task-editor" onBlur={event => handleTaskEditorBlur(event, task)}><input className="inline-task-title" autoFocus value={editingTaskTitle} onChange={event => setEditingTaskTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditingTaskId(null); }} aria-label="修改待办内容" /><label className="inline-task-date" title="修改日期"><CalendarIcon /><input className="inline-task-date-input" type="date" value={editingTaskDate} onChange={event => setEditingTaskDate(event.target.value)} aria-label="修改待办日期" /></label></div> : <button key={task.id} title="单击修改，双击完成" onClick={event => handleTaskClick(event, task)} onDoubleClick={event => handleTaskDoubleClick(event, task)}>{task.title}</button>) : <span>暂无安排</span>}</div></div>)}</div><footer>{upcomingCount ? `今天起 7 天共有 ${upcomingCount} 项安排` : "今天起一周还没有安排"}<em>横向滚动查看全部 7 天 →</em></footer></section>
        <section className="brand-focus-card next">{renderBrandFocus("nextAction", "下一阶段规划")}</section>
      </div>
    </div>
  </section>;
}

type ReadingProps = {
  items: ReadingItem[];
  summary: { summary: string; themes: string[]; nextStep: string; source: "deepseek" | "openai" | "custom" } | null;
  summaryLoading: boolean;
  onSummarize: () => void;
  onAdd: () => void;
  onEdit: (item: ReadingItem) => void;
  onDelete: (item: ReadingItem) => void;
  onReanalyze: (item: ReadingItem) => Promise<void>;
  milestones: BrandMilestone[];
  onConvert: (item: ReadingItem) => Promise<void>;
  onLoadCanvas: (tag: string) => Promise<ReadingCanvasLayout>;
  onSaveCanvas: (tag: string, layout: ReadingCanvasLayout) => Promise<void>;
  onConfirm: (item: ReadingItem) => Promise<void>;
  onImportMedia: (files: File[], message: string) => Promise<{ items: ReadingItem[]; interpretedCount?: number }>;
};

export function ReadingTimeline({ items, summary, summaryLoading, onSummarize, onAdd, onEdit, onDelete, onReanalyze, milestones, onConvert, onLoadCanvas, onSaveCanvas, onConfirm, onImportMedia }: ReadingProps) {
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "followup" | "untracked">("all");
  const [workflowFilter, setWorkflowFilter] = useState<"all" | "pending" | "confirmed">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [layout, setLayout] = useState<"grid" | "timeline">("grid");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [canvasTag, setCanvasTag] = useState("");
  const trackedIds = new Set(milestones.map(milestone => milestone.sourceReadingId).filter((id): id is number => Boolean(id)));
  const availableBroadCategories = broadTagGroups.map(group => group.label).filter(label => items.some(item => readingBroadCategories(item).includes(label)));
  if (items.some(item => readingBroadCategories(item).includes("其他"))) availableBroadCategories.push("其他");
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const filteredItems = items.filter(item => {
    const matchesQuery = !normalizedQuery || [item.title, item.source, item.note, item.tags].some(value => value.toLocaleLowerCase("zh-CN").includes(normalizedQuery));
    const matchesTag = !tagFilter || readingBroadCategories(item).includes(tagFilter);
    const tracked = trackedIds.has(item.id);
    const matchesStatus = statusFilter === "all" || (statusFilter === "followup" ? tracked : !tracked);
    const matchesWorkflow = workflowFilter === "all" || item.workflowStatus === workflowFilter;
    const matchesCategory = !categoryFilter || item.primaryCategory === categoryFilter;
    return matchesQuery && matchesTag && matchesStatus && matchesWorkflow && matchesCategory;
  });
  const groups = filteredItems.reduce<Record<string, ReadingItem[]>>((result, item) => {
    (result[item.date] ??= []).push(item);
    return result;
  }, {});
  const selectedItem = selectedId ? items.find(item => item.id === selectedId) ?? null : null;
  function openDetails(item: ReadingItem) { setSelectedId(item.id); }
  function handleCardKey(event: ReactKeyboardEvent<HTMLElement>, item: ReadingItem) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDetails(item);
  }
  return <section className="reading-panel collection-panel">
    <header className="collection-hero">
      <div><small>BRAND KNOWLEDGE BASE · 品牌知识库</small><h1 className="inspiration-archive-title">持续收集、整理与沉淀品牌视觉、产品、文化与叙事资料的创意档案馆</h1><p>先放心地丢进来，系统判断类型、来源、分类、用途与重复内容，你只需要确认。</p></div>
    </header>
    <div className="reading-stats"><span><b>{items.length}</b> 条品牌资料</span><span><b>{items.filter(item => item.workflowStatus === "pending").length}</b> 条待整理</span><span><b>{trackedIds.size}</b> 条已收录跟进</span><i>资料先沉淀，再进入行动。</i><button className="reading-summary-trigger" onClick={onSummarize} disabled={!items.length || summaryLoading}>{summaryLoading ? "AI 正在整理…" : summary ? "重新总结" : "✦ AI 品牌洞察"}</button></div>
    {items.some(item => item.workflowStatus === "pending") && <section className="knowledge-inbox"><div><small>INBOX · 待整理</small><h2>系统已经整理，等待你的确认</h2><p>已自动识别资料类型、来源、主分类、细分标签、潜在用途与重复内容。</p></div><button onClick={() => void Promise.all(items.filter(item => item.workflowStatus === "pending").map(onConfirm))}>批量确认 {items.filter(item => item.workflowStatus === "pending").length} 条</button></section>}
    <div className="inspiration-toolbar">
      <label className="inspiration-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、品牌或中文解读" aria-label="搜索品牌灵感" /></label>
      <select value={tagFilter} onChange={event => setTagFilter(event.target.value)} aria-label="按灵感大类筛选"><option value="">全部大类</option>{availableBroadCategories.map(category => <option key={category} value={category}>{category}</option>)}</select>
      <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} aria-label="按品牌主分类筛选"><option value="">全部分类</option>{["品牌定位", "视觉系统", "产品设计", "材质工艺", "包装", "摄影", "内容文案", "用户洞察"].map(category => <option key={category}>{category}</option>)}</select>
      <div className="inspiration-status-filter" aria-label="按整理状态筛选"><button className={workflowFilter === "all" ? "active" : ""} onClick={() => setWorkflowFilter("all")}>全部资料</button><button className={workflowFilter === "pending" ? "active" : ""} onClick={() => setWorkflowFilter("pending")}>待整理</button><button className={workflowFilter === "confirmed" ? "active" : ""} onClick={() => setWorkflowFilter("confirmed")}>已归档</button></div>
      <div className="inspiration-status-filter" aria-label="按跟进状态筛选"><button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>全部</button><button className={statusFilter === "untracked" ? "active" : ""} onClick={() => setStatusFilter("untracked")}>未跟进</button><button className={statusFilter === "followup" ? "active" : ""} onClick={() => setStatusFilter("followup")}>已跟进</button></div>
      <div className="inspiration-layout-switch" aria-label="切换灵感视图"><button className={layout === "grid" ? "active" : ""} onClick={() => setLayout("grid")}>▦ 卡片</button><button className={layout === "timeline" ? "active" : ""} onClick={() => setLayout("timeline")}>≡ 日期</button></div>
    </div>
    {(summary || summaryLoading) && <section className={`reading-ai-summary ${summaryLoading ? "loading" : ""}`} aria-live="polite">
      <header><span>✦</span><div><small>AI INSPIRATION REVIEW</small><h2>{summaryLoading ? "正在梳理你的品牌灵感…" : "这段时间，你在关注什么"}</h2></div></header>
      {summary && <><p>{summary.summary}</p>{summary.themes.length > 0 && <div className="reading-summary-themes">{summary.themes.map(theme => <span key={theme}>{theme}</span>)}</div>}<footer><b>下一步</b><span>{summary.nextStep}</span><small>{summary.source === "deepseek" ? "DeepSeek" : summary.source === "openai" ? "OpenAI" : "自定义模型"} 生成</small></footer></>}
    </section>}
    {filteredItems.length && layout === "grid" ? <div className="inspiration-library-grid">{filteredItems.map(item => {
      const tags = readingTags(item.tags);
      const tracked = trackedIds.has(item.id);
      const focus = inspirationImageFocus(item);
      return <article className="inspiration-library-card" key={item.id} tabIndex={0} role="button" onClick={() => openDetails(item)} onKeyDown={event => handleCardKey(event, item)}>
        <div className={`inspiration-card-image ${focus.className}`}>{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} /> : <span>BRAND<br />REFERENCE</span>}{focus.label && <strong>{focus.label}</strong>}<i className={item.workflowStatus === "pending" ? "pending" : tracked ? "tracked" : ""}>{item.workflowStatus === "pending" ? "待整理" : tracked ? "已跟进" : "已归档"}</i></div>
        <div className="inspiration-card-copy"><small>{item.source || "未标注来源"}<time dateTime={item.date}>{item.date.replaceAll("-", ".")}</time></small><div className="knowledge-classification"><b>{item.primaryCategory}</b><span>{item.resourceType}</span><span>用于：{item.intendedUse}</span>{item.duplicateOf && <em>与 #{item.duplicateOf} 重复</em>}</div><h2>{item.title}</h2><p>{item.note || "这条资料还没有中文解读。"}</p>{tags.length > 0 && <div className="reading-tags">{tags.slice(0, 4).map(tag => <button key={tag} title={`打开“${tag}”灵感画布`} onClick={event => { event.stopPropagation(); setCanvasTag(tag); }}>{tag}</button>)}</div>}{item.workflowStatus === "pending" && <button className="knowledge-confirm" onClick={event => { event.stopPropagation(); void onConfirm(item); }}>确认归档</button>}</div>
      </article>;
    })}</div> : null}
    {filteredItems.length && layout === "timeline" ? <div className="reading-stream">{Object.entries(groups).sort(([first], [second]) => second.localeCompare(first)).map(([date, dayItems]) => <section className="reading-day" key={date}>
      <time dateTime={date}><b>{Number(date.slice(8))}</b><span>{monthName(date)}<small>{weekdayName(date)}</small></span></time>
      <div className="reading-rail" aria-hidden="true"><i /></div>
      <div className="reading-day-list">{dayItems.map((item, index) => { const href = safeReadingLink(item.url); return <article className={`reading-card ${item.imageUrl ? "with-image" : ""} ${href ? "has-link" : ""}`} key={item.id} role="button" tabIndex={0} aria-label={`查看灵感：${item.title}`} onClick={event => { if ((event.target as HTMLElement).closest("button,a")) return; openDetails(item); }} onKeyDown={event => handleCardKey(event, item)}>
        <span className="collection-index">{String(index + 1).padStart(2, "0")}</span>
        {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} />}
        <div className="reading-card-body"><small>{item.source || "未标注来源"}</small><h2>{item.title}</h2><p>{item.note || "这条阅读还没有写下旁注。"}</p>{readingTags(item.tags).length > 0 && <div className="reading-tags">{readingTags(item.tags).map(tag => <span key={tag}>{tag}</span>)}</div>}<footer>{href && <a href={href} target="_blank" rel="noreferrer">查看原文 ↗</a>}<span><button className="promote" disabled={milestones.some(milestone => milestone.sourceReadingId === item.id)} onClick={() => void onConvert(item)}>{milestones.some(milestone => milestone.sourceReadingId === item.id) ? "已收录跟进" : "收录跟进"}</button>{item.imageUrl && !href && <button onClick={() => void onReanalyze(item)}>重新识别</button>}<button onClick={() => onEdit(item)}>编辑</button><button onClick={() => onDelete(item)}>删除</button></span></footer></div>
      </article>; })}</div>
    </section>)}</div> : null}
    {!items.length ? <EmptyCollection title="品牌知识库还是空的" copy="图片、网页、文档或一句想法，都可以先放心丢进来。" action="存入第一条" onAction={onAdd} /> : !filteredItems.length ? <EmptyCollection title="没有符合条件的资料" copy="换一个关键词、分类、标签或状态再看看。" /> : null}
    {selectedItem && <div className="inspiration-detail-backdrop" onMouseDown={() => setSelectedId(null)}><aside className="inspiration-detail-drawer" role="dialog" aria-modal="true" aria-label={`灵感详情：${selectedItem.title}`} onMouseDown={event => event.stopPropagation()}>
      <button className="inspiration-detail-close" onClick={() => setSelectedId(null)} aria-label="关闭灵感详情">×</button>
      {selectedItem.imageUrl && <img className="inspiration-detail-image" src={selectedItem.imageUrl} alt="" referrerPolicy="no-referrer" />}
      <div className="inspiration-detail-content"><small>{selectedItem.source || "未标注来源"}<time dateTime={selectedItem.date}>{selectedItem.date.replaceAll("-", ".")}</time></small><h2>{selectedItem.title}</h2><p>{selectedItem.note || "这条灵感还没有写下中文解读。"}</p>{readingTags(selectedItem.tags).length > 0 && <section><b>值得借鉴什么</b><div className="reading-tags">{readingTags(selectedItem.tags).map(tag => <button key={tag} title={`打开“${tag}”灵感画布`} onClick={() => { setSelectedId(null); setCanvasTag(tag); }}>{tag}</button>)}</div></section>}
        <footer>{safeReadingLink(selectedItem.url) && <a href={safeReadingLink(selectedItem.url)} target="_blank" rel="noreferrer">查看原文 ↗</a>}<div><button onClick={() => { setSelectedId(null); onEdit(selectedItem); }}>编辑</button><button className="promote" disabled={trackedIds.has(selectedItem.id)} onClick={() => void onConvert(selectedItem)}>{trackedIds.has(selectedItem.id) ? "已收录跟进" : "收录跟进"}</button><button onClick={() => { setSelectedId(null); onDelete(selectedItem); }}>删除</button></div></footer>
      </div>
    </aside></div>}
    {canvasTag && <InspirationCanvas tag={canvasTag} items={items} onClose={() => setCanvasTag("")} onLoad={onLoadCanvas} onSave={onSaveCanvas} onImportMedia={onImportMedia} />}
  </section>;
}

function InspirationCanvas({ tag, items, onClose, onLoad, onSave, onImportMedia }: { tag: string; items: ReadingItem[]; onClose: () => void; onLoad: (tag: string) => Promise<ReadingCanvasLayout>; onSave: (tag: string, layout: ReadingCanvasLayout) => Promise<void>; onImportMedia: (files: File[], message: string) => Promise<{ items: ReadingItem[]; interpretedCount?: number }> }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nodesRef = useRef<ReadingCanvasLayout["nodes"]>([]);
  const edgesRef = useRef<ReadingCanvasLayout["edges"]>([]);
  const notesRef = useRef<ReadingCanvasLayout["notes"]>([]);
  const groupsRef = useRef<ReadingCanvasLayout["groups"]>([]);
  const dragRef = useRef<null | { type: "node" | "note" | "group" | "pan"; pointerId: number; id?: number | string; startX: number; startY: number; originX: number; originY: number }>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [canvasItems, setCanvasItems] = useState<ReadingItem[]>([]);
  const [nodes, setNodes] = useState<ReadingCanvasLayout["nodes"]>([]);
  const [edges, setEdges] = useState<ReadingCanvasLayout["edges"]>([]);
  const [notes, setNotes] = useState<ReadingCanvasLayout["notes"]>([]);
  const [groups, setGroups] = useState<ReadingCanvasLayout["groups"]>([]);
  const [view, setView] = useState({ x: 110, y: 90, scale: 1 });
  const [linkingFrom, setLinkingFrom] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropActive, setDropActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");

  useEffect(() => {
    let active = true;
    void onLoad(tag).then(layout => {
      if (!active) return;
      const stored = new Map(layout.nodes.map(node => [node.readingItemId, node]));
      const included = items.filter(item => readingTags(item.tags).includes(tag) || stored.has(item.id));
      const nextNodes = included.map((item, index) => stored.get(item.id) ?? { readingItemId: item.id, x: (index % 4) * 280, y: Math.floor(index / 4) * 260 });
      const ids = new Set(nextNodes.map(node => node.readingItemId));
      const nextEdges = layout.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to));
      const nextNotes = layout.notes || [];
      const nextGroups = layout.groups || [];
      nodesRef.current = nextNodes; edgesRef.current = nextEdges; notesRef.current = nextNotes; groupsRef.current = nextGroups;
      setCanvasItems(included); setNodes(nextNodes); setEdges(nextEdges); setNotes(nextNotes); setGroups(nextGroups); setLoading(false);
      if (nextNodes.length !== layout.nodes.length || nextEdges.length !== layout.edges.length) queueSave(nextNodes, nextEdges, nextNotes, nextGroups);
    }).catch(() => { if (active) { setLoading(false); setSaveState("error"); } });
    document.body.classList.add("canvas-open");
    return () => { active = false; document.body.classList.remove("canvas-open"); if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
    // A tag change creates a distinct saved board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  function queueSave(nextNodes = nodesRef.current, nextEdges = edgesRef.current, nextNotes = notesRef.current, nextGroups = groupsRef.current) {
    nodesRef.current = nextNodes; edgesRef.current = nextEdges; notesRef.current = nextNotes; groupsRef.current = nextGroups;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = window.setTimeout(() => { void onSave(tag, { nodes: nextNodes, edges: nextEdges, notes: nextNotes, groups: nextGroups }).then(() => setSaveState("saved")).catch(() => setSaveState("error")); }, 450);
  }

  function beginMove(event: ReactPointerEvent<HTMLElement>, type: "node" | "note" | "group", id: number | string, x: number, y: number) {
    if ((event.target as HTMLElement).closest("button,textarea,input")) return;
    event.stopPropagation(); rootRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { type, pointerId: event.pointerId, id, startX: event.clientX, startY: event.clientY, originX: x, originY: y };
  }
  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".canvas-node,.canvas-note,.canvas-group,.canvas-connections path,.inspiration-canvas-toolbar")) return;
    rootRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { type: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
  }
  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.type === "pan") { setView(current => ({ ...current, x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY })); return; }
    const x = Math.round(drag.originX + (event.clientX - drag.startX) / view.scale); const y = Math.round(drag.originY + (event.clientY - drag.startY) / view.scale);
    if (drag.type === "node") { const next = nodesRef.current.map(node => node.readingItemId === drag.id ? { ...node, x, y } : node); nodesRef.current = next; setNodes(next); }
    if (drag.type === "note") { const next = notesRef.current.map(note => note.id === drag.id ? { ...note, x, y } : note); notesRef.current = next; setNotes(next); }
    if (drag.type === "group") { const next = groupsRef.current.map(group => group.id === drag.id ? { ...group, x, y } : group); groupsRef.current = next; setGroups(next); }
  }
  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null; if (rootRef.current?.hasPointerCapture(event.pointerId)) rootRef.current.releasePointerCapture(event.pointerId);
    if (drag.type !== "pan") queueSave();
  }
  function zoomCanvas(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect();
    const nextScale = Math.min(2.2, Math.max(.35, view.scale * (event.deltaY > 0 ? .9 : 1.1))); const pointX = event.clientX - rect.left; const pointY = event.clientY - rect.top;
    setView(current => ({ scale: nextScale, x: pointX - ((pointX - current.x) / current.scale) * nextScale, y: pointY - ((pointY - current.y) / current.scale) * nextScale }));
  }
  function connectNode(id: number) {
    if (linkingFrom === null) { setLinkingFrom(id); return; } if (linkingFrom === id) { setLinkingFrom(null); return; }
    const next = edgesRef.current.some(edge => edge.from === linkingFrom && edge.to === id) ? edgesRef.current : [...edgesRef.current, { from: linkingFrom, to: id }];
    setEdges(next); setLinkingFrom(null); queueSave(nodesRef.current, next);
  }
  function removeEdge(from: number, to: number) { const next = edgesRef.current.filter(edge => edge.from !== from || edge.to !== to); setEdges(next); queueSave(nodesRef.current, next); }
  function addNote() {
    const note = { id: crypto.randomUUID(), x: Math.round((220 - view.x) / view.scale), y: Math.round((150 - view.y) / view.scale), text: "写下这组灵感之间的关系…" };
    const next = [...notesRef.current, note]; setNotes(next); queueSave(nodesRef.current, edgesRef.current, next);
  }
  function addGroup() {
    const group = { id: crypto.randomUUID(), x: Math.round((170 - view.x) / view.scale), y: Math.round((130 - view.y) / view.scale), width: 620, height: 390, title: "新分组" };
    const next = [...groupsRef.current, group]; setGroups(next); queueSave(nodesRef.current, edgesRef.current, notesRef.current, next);
  }
  async function importFiles(files: File[], clientX?: number, clientY?: number) {
    const images = files.filter(file => file.type.startsWith("image/")); if (!images.length || importing) return;
    setImporting(true); setDropActive(false);
    try {
      const result = await onImportMedia(images, `导入到“${tag}”灵感画布，请分析图片并推荐与“${tag}”相关的标签。`);
      const rect = rootRef.current?.getBoundingClientRect(); const originX = clientX ?? (rect ? rect.left + rect.width / 2 : 500); const originY = clientY ?? (rect ? rect.top + rect.height / 2 : 400);
      const x = Math.round((originX - (rect?.left || 0) - view.x) / view.scale); const y = Math.round((originY - (rect?.top || 0) - view.y) / view.scale);
      const addedNodes = result.items.map((item, index) => ({ readingItemId: item.id, x: x + (index % 3) * 270, y: y + Math.floor(index / 3) * 230 }));
      setCanvasItems(current => [...current.filter(item => !result.items.some(added => added.id === item.id)), ...result.items]); setNodes(current => [...current, ...addedNodes]);
      queueSave([...nodesRef.current, ...addedNodes]);
    } catch { setSaveState("error"); } finally { setImporting(false); }
  }

  const nodeById = new Map(nodes.map(node => [node.readingItemId, node]));
  return <div className={`inspiration-canvas ${dropActive ? "drop-active" : ""}`} role="dialog" aria-modal="true" aria-label={`${tag}灵感画布`} ref={rootRef} onPointerDown={beginPan} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer} onWheel={zoomCanvas} onDragOver={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDropActive(true); } }} onDragLeave={event => { if (event.currentTarget === event.target) setDropActive(false); }} onDrop={event => { event.preventDefault(); void importFiles(Array.from(event.dataTransfer.files), event.clientX, event.clientY); }}>
    <header className="inspiration-canvas-toolbar">
      <div><small>INSPIRATION CANVAS</small><h2><span>#{tag}</span> 灵感画布</h2></div>
      <p>{linkingFrom === null ? "拖动卡片 · 点击圆点建立有方向的连接 · 可添加分组、文本或外部图片" : "已选择起点，再点击另一张卡片的圆点完成连接"}</p>
      <div className="canvas-toolbar-actions"><span className={`canvas-save-state ${saveState}`}>{importing ? "图片导入中…" : saveState === "saving" ? "保存中…" : saveState === "error" ? "保存失败" : "已保存"}</span><button onClick={addGroup}>＋ 分组</button><button onClick={addNote}>＋ 文本</button><button onClick={() => fileInputRef.current?.click()}>＋ 图片</button><input ref={fileInputRef} className="canvas-file-input" type="file" accept="image/*" multiple onChange={event => { void importFiles(Array.from(event.target.files || [])); event.currentTarget.value = ""; }} /><button onClick={() => setView({ x: 110, y: 90, scale: 1 })}>回到中心</button><button className="canvas-close" onClick={onClose} aria-label="关闭灵感画布">×</button></div>
    </header>
    {loading ? <div className="canvas-loading">正在展开这组灵感…</div> : <div className="inspiration-canvas-world" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})` }}>
      {groups.map(group => <section className="canvas-group" key={group.id} style={{ transform: `translate(${group.x}px,${group.y}px)`, width: group.width, height: group.height }} onPointerDown={event => beginMove(event, "group", group.id, group.x, group.y)}><header><input value={group.title} onChange={event => { const next = groupsRef.current.map(item => item.id === group.id ? { ...item, title: event.target.value } : item); groupsRef.current = next; setGroups(next); }} onBlur={() => queueSave()} aria-label="编辑分组名称" /><button onClick={() => { const next = groupsRef.current.filter(item => item.id !== group.id); setGroups(next); queueSave(nodesRef.current, edgesRef.current, notesRef.current, next); }} aria-label="删除分组">×</button></header></section>)}
      <svg className="canvas-connections" viewBox="-5000 -5000 20000 20000" aria-label="灵感卡片连线"><defs><marker id="canvas-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{edges.map(edge => { const from = nodeById.get(edge.from); const to = nodeById.get(edge.to); if (!from || !to) return null; const x1 = from.x + 240, y1 = from.y + 102, x2 = to.x, y2 = to.y + 102; const bend = Math.max(70, Math.abs(x2 - x1) * .45); return <path markerEnd="url(#canvas-arrow)" key={`${edge.from}-${edge.to}`} d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`} onClick={event => { event.stopPropagation(); removeEdge(edge.from, edge.to); }}><title>点击删除这条连接</title></path>; })}</svg>
      {notes.map(note => <article className="canvas-note" key={note.id} style={{ transform: `translate(${note.x}px,${note.y}px)` }} onPointerDown={event => beginMove(event, "note", note.id, note.x, note.y)}><header><span>TEXT NOTE</span><button onClick={() => { const next = notesRef.current.filter(item => item.id !== note.id); setNotes(next); queueSave(nodesRef.current, edgesRef.current, next); }} aria-label="删除文本">×</button></header><textarea value={note.text} onChange={event => { const next = notesRef.current.map(item => item.id === note.id ? { ...item, text: event.target.value } : item); notesRef.current = next; setNotes(next); }} onBlur={() => queueSave()} aria-label="编辑画布文本" /></article>)}
      {canvasItems.map(item => { const node = nodeById.get(item.id); if (!node) return null; return <article className={`canvas-node ${linkingFrom === item.id ? "linking" : ""}`} key={item.id} style={{ transform: `translate(${node.x}px,${node.y}px)` }} onPointerDown={event => beginMove(event, "node", node.readingItemId, node.x, node.y)}><div className="canvas-node-image">{item.imageUrl ? <img src={item.imageUrl} alt="" draggable={false} referrerPolicy="no-referrer" /> : <span>NO IMAGE</span>}</div><div className="canvas-node-copy"><small>{item.source || `#${tag}`}</small><h3>{item.title}</h3></div><button className="canvas-link-handle" title={linkingFrom === null ? "选择连接起点" : linkingFrom === item.id ? "取消连接" : "连接到这张卡片"} aria-label="连接这张灵感卡片" onClick={event => { event.stopPropagation(); connectNode(item.id); }} /></article>; })}
    </div>}
    {!loading && !canvasItems.length && !notes.length && <div className="canvas-loading">拖入图片，或先添加一个文本与分组</div>}
    {dropActive && <div className="canvas-drop-overlay">松开鼠标，把图片放到画布中</div>}
    <div className="canvas-zoom">{Math.round(view.scale * 100)}%</div>
  </div>;
}

export function FollowUpPage({ milestones, readings, onUpdate, onDelete, onEditReading }: {
  milestones: BrandMilestone[];
  readings: ReadingItem[];
  onUpdate: (milestone: BrandMilestone, values: Partial<Pick<BrandMilestone, "title" | "phase" | "dueDate" | "status" | "progress" | "deliverable">>) => Promise<void>;
  onDelete: (milestone: BrandMilestone) => Promise<void>;
  onEditReading: (item: ReadingItem) => void;
}) {
  const readingById = new Map(readings.map(item => [item.id, item]));
  const ordered = [...milestones].sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.dueDate.localeCompare(b.dueDate));
  const done = milestones.filter(item => item.status === "done").length;
  const average = milestones.length ? Math.round(milestones.reduce((total, item) => total + item.progress, 0) / milestones.length) : 0;
  return <section className="followup-panel collection-panel">
    <header className="collection-hero followup-hero"><div><small>FOLLOW-UP · 品牌行动</small><h1>把借鉴，变成<em>下一步。</em></h1><p>从灵感库收录值得继续研究的案例，明确借鉴点，并一路推进到真正落地。</p></div></header>
    <div className="followup-stats"><span><b>{milestones.length}</b> 条跟进</span><span><b>{milestones.length - done}</b> 条进行中</span><span><b>{average}%</b> 平均进度</span></div>
    {ordered.length ? <div className="followup-grid">{ordered.map(milestone => {
      const source = milestone.sourceReadingId ? readingById.get(milestone.sourceReadingId) : undefined;
      const tags = readingTags(source?.tags || "");
      return <article className={`followup-card ${milestone.status === "done" ? "done" : ""}`} key={milestone.id}>
        <header><span>{milestone.phase}</span><time dateTime={milestone.dueDate}>目标日期 {milestone.dueDate.replaceAll("-", ".")}</time></header>
        <div className="followup-source">{source?.imageUrl && <img src={source.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} />}<div><small>{source?.source || "品牌跟进"}</small><h2>{milestone.title}</h2><p>{milestone.deliverable || source?.note || "补充这条灵感准备如何落地。"}</p></div></div>
        {tags.length > 0 && <div className="followup-tags"><b>值得借鉴什么</b>{tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
        <div className="followup-progress"><span><i style={{ width: `${milestone.progress}%` }} /></span><b>{milestone.progress}%</b></div>
        <footer>{source && <button onClick={() => onEditReading(source)}>编辑灵感</button>}<span><button disabled={milestone.status === "done" || milestone.progress >= 100} onClick={() => void onUpdate(milestone, { progress: Math.min(100, milestone.progress + 25), status: milestone.progress + 25 >= 100 ? "done" : "in_progress" })}>推进 25%</button><button onClick={() => void onUpdate(milestone, milestone.status === "done" ? { status: "in_progress", progress: 75 } : { status: "done", progress: 100 })}>{milestone.status === "done" ? "恢复跟进" : "标记完成"}</button><button className="remove" onClick={() => void onDelete(milestone)}>移出跟进</button></span></footer>
      </article>;
    })}</div> : <EmptyCollection title="还没有需要跟进的灵感" copy="在品牌灵感库点击“收录跟进”，值得行动的案例就会集中到这里。" />}
  </section>;
}

const broadTagGroups = [
  { label: "产品", pattern: /产品设计|产品|耳环|耳饰|耳坠|耳钉|项链|吊坠|颈链|手链|手镯|戒指|指环|首饰|珠宝|配饰|鞋|包袋/ },
  { label: "品牌视觉", pattern: /视觉系统|品牌视觉|视觉|色彩|配色|构图|排版|字体|标志|logo|氛围|极简|形体|比例/ },
  { label: "模特展示", pattern: /模特|佩戴|穿搭|造型|人物|人像|上身|侧脸|手部|展示/ },
  { label: "材质工艺", pattern: /材质工艺|材质|工艺|金属|银饰|铜|黄金|黑金|醋酸|树脂|陶瓷|织物|手工/ },
  { label: "包装空间", pattern: /包装|陈列|空间|橱窗|展台|门店|快闪|展览/ },
  { label: "内容叙事", pattern: /摄影|内容文案|内容|文案|叙事|故事|社交媒体|广告|自然叙事/ },
  { label: "品牌策略", pattern: /品牌定位|定位|用户洞察|用户|市场|文化|差异化|价格|渠道/ },
] as const;

function readingBroadCategories(item: ReadingItem) {
  const content = [item.tags, item.primaryCategory, item.intendedUse, item.title, item.note].join(" ").toLocaleLowerCase("zh-CN");
  const matches = broadTagGroups.filter(group => group.pattern.test(content)).map(group => group.label);
  return matches.length ? matches : ["其他"];
}

function readingTags(value: string) {
  return value.split(/[，,、;；\n]+/).map(tag => tag.trim()).filter(Boolean).slice(0, 8);
}

function inspirationImageFocus(item: ReadingItem) {
  const content = `${item.title} ${item.note} ${item.tags}`.toLocaleLowerCase("zh-CN");
  if (/手链|手镯|腕饰|手腕|手部|bracelet|bangle/.test(content)) return { className: "focus-wrist", label: "手腕首饰" };
  if (/耳环|耳饰|耳坠|耳钉|earring/.test(content)) return { className: "focus-ear", label: "耳部首饰" };
  if (/项链|吊坠|颈链|锁骨链|necklace|pendant/.test(content)) return { className: "focus-neck", label: "颈部首饰" };
  if (/戒指|指环|ring/.test(content)) return { className: "focus-ring", label: "手部首饰" };
  if (/首饰|珠宝|配饰|jewelry|jewellery/.test(content)) return { className: "focus-jewelry", label: "首饰重点" };
  return { className: "", label: "" };
}

function ReadingLinkChat({ onImport, onImportMedia }: { onImport: (url: string) => Promise<{ item: ReadingItem; duplicate: boolean; refreshed?: boolean; localized?: boolean; imageCaptured?: boolean }>; onImportMedia: (files: File[], message: string) => Promise<{ items: ReadingItem[]; interpretedCount?: number }> }) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [placeholder, setPlaceholder] = useState("粘贴链接、图片，或添加附件…");
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  function clearFiles() {
    setFiles([]);
  }
  function removeFile(index: number) {
    setFiles(current => current.filter((_, itemIndex) => itemIndex !== index));
  }
  async function submit() {
    const text = value.trim();
    if ((!text && !files.length) || busy) return;
    setBusy(true); setPlaceholder(files.length ? "资料正在进入待整理，图片会同步完成 AI 识别…" : "正在读取网页…");
    try {
      if (files.length) {
        const result = await onImportMedia(files.map(item => item.file), text);
        setPlaceholder(`已接收 ${result.items.length} 条资料，全部进入待整理`);
        clearFiles();
      } else {
        const result = await onImport(text);
        const cover = result.imageCaptured ? "，封面已保存" : "；网页未开放封面，可点＋粘贴图片补充";
        setPlaceholder(`${result.duplicate ? "已刷新" : "已生成"}中文解读${cover}`);
      }
      setValue("");
    } catch (error) {
      setPlaceholder(error instanceof Error ? error.message : "没有添加成功，请重试");
    } finally { setBusy(false); }
  }
  async function addFiles(incoming: File[]) {
    const accepted = incoming.filter(file => file.type.startsWith("image/") || ["application/pdf", "text/plain", "text/markdown", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.type)).slice(0, Math.max(0, 4 - files.length));
    if (accepted.length) {
      try {
        const additions = await Promise.all(accepted.map(async file => ({ file, previewUrl: file.type.startsWith("image/") ? await imageDataUrl(file) : "" })));
        setFiles(current => [...current, ...additions].slice(0, 4));
      } catch {
        setPlaceholder("图片预览生成失败，请换一张图片再试");
      }
    }
  }
  return <section
    className={`reading-link-chat compact ${files.length ? "has-files" : ""} ${dragActive ? "is-dragging" : ""}`}
    aria-label="阅读链接与附件输入栏"
    onDragEnter={event => { event.preventDefault(); dragDepth.current += 1; setDragActive(true); }}
    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
    onDragLeave={event => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragActive(false); }}
    onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragActive(false); addFiles(Array.from(event.dataTransfer.files)); }}
  >
    {dragActive && <div className="attachment-drop-hint" role="status">松开鼠标，把资料放进品牌知识库</div>}
    {files.length > 0 && <div className="attachment-strip" aria-label="待发送资料预览">{files.map((item, index) => <figure className={`attachment-preview ${item.previewUrl ? "" : "document"}`} key={`${item.file.name}-${index}`}>{item.previewUrl ? <img src={item.previewUrl} alt={`待发送截图 ${index + 1}`} /> : <span>DOC</span>}<figcaption>{item.file.name}</figcaption><button aria-label={`移除资料 ${index + 1}`} onClick={() => removeFile(index)}>×</button></figure>)}</div>}
    {busy && <p className="attachment-status busy" aria-live="polite">{placeholder}</p>}
    <div className="chat-input"><button className="attachment-button" aria-label="添加图片或文档" onClick={() => fileInput.current?.click()}>＋</button><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.md,.txt" multiple onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /><input value={value} disabled={busy} onPaste={event => { const pasted = Array.from(event.clipboardData.files); if (pasted.length) { event.preventDefault(); addFiles(pasted); } }} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void submit(); }} placeholder={placeholder} aria-label="链接、文字想法或附件说明" /><button disabled={busy || (!value.trim() && !files.length)} onClick={() => void submit()}>{busy ? "处理中" : "发送 ↗"}</button></div>
  </section>;
}

function imageDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("preview unavailable"));
    reader.onerror = () => reject(reader.error || new Error("preview unavailable"));
    reader.readAsDataURL(file);
  });
}

function safeReadingLink(value: string) {
  if (/^\/api\/reading\/media\/[a-f0-9-]{36}$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function EmptyCollection({ title, copy, action, onAction, dark = false }: { title: string; copy: string; action?: string; onAction?: () => void; dark?: boolean }) {
  return <div className={`collection-empty ${dark ? "dark" : ""}`}><span>☕</span><h2>{title}</h2><p>{copy}</p>{action && onAction && <button className="primary-btn" onClick={onAction}>{action}</button>}</div>;
}

function monthName(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" }).toUpperCase();
}

function weekdayName(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", { weekday: "short" });
}
