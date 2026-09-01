"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent } from "react";
import { FollowUpPage, HomeDashboard, ReadingTimeline, type BrandMilestone, type BrandPhase, type BrandProfile, type BrandProfileVersion, type BrandProgress, type ReadingCanvasLayout, type ReadingItem } from "./collection-panels";
import { CalendarIcon } from "./calendar-icon";
import { BrandArchivePage, type BrandEvolutionProposal, type BrandKnowledgeStats } from "./brand-archive";

type Task = {
  id: number;
  date: string;
  title: string;
  category: "工作" | "生活" | "成长";
  done: boolean;
};

type Review = {
  mood: string;
  energy: number;
  text: string;
  keep: string;
  start: string;
  improve: string;
  stop: string;
  analysis?: string;
  progressSummary?: string;
};

type CalendarReview = Review & { date: string; win?: string };

type OverviewData = {
  period: "week" | "month" | "year";
  anchor: string;
  from: string;
  to: string;
  label: string;
  summary: { reviewDays: number; taskCount: number; completed: number; completionRate: number; averageEnergy: number; dominantMood: string };
  moodCounts: Record<string, number>;
  weekSummary: { taskCount: number; completed: number; completionRate: number; reviewDays: number };
  goals: Record<GoalScope, GoalItem>;
  monthlyGoals: GoalItem[];
  reviews: Array<CalendarReview & { id: number; analysis?: string | null }>;
  tasksByDate: Record<string, { total: number; completed: number }>;
};

type GoalScope = "week" | "month" | "year";
type GoalItem = { scope: GoalScope; periodKey: string; label: string; content: string; progress: number; updatedAt?: string };
type GoalChecklistItem = { text: string; done: boolean };

type ApiKeyItem = { id: number; name: string; tokenPrefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
type AIProvider = "deepseek" | "openai" | "custom";
type AIConfig = { provider: AIProvider; model: string; baseUrl?: string | null; keyHint: string; updatedAt?: string };
type Account = { id: string; displayName: string; authType: "slowday" | "chatgpt" };
type View = "home" | "calendar" | "review" | "overview" | "reading" | "followup" | "archive";
type DeleteTarget = { kind: "task" | "reading"; id: number; title: string };
type ReadingSummary = { summary: string; themes: string[]; nextStep: string; source: AIProvider };
type ReviewComparison = { summary: string; highlights: string[]; nextFocus: string; source: AIProvider };

const weekDays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const moods = [
  { emoji: "😄", label: "开心" },
  { emoji: "🙂", label: "轻松" },
  { emoji: "😌", label: "平静" },
  { emoji: "😔", label: "低落" },
  { emoji: "😫", label: "疲惫" },
];

const emptyReview: Review = { mood: "平静", energy: 4, text: "", keep: "", start: "", improve: "", stop: "", analysis: "", progressSummary: "" };
const emptyBrandProgress: BrandProgress = { currentPhase: "品牌定位", annualDirection: "", monthlyFocus: "", blocker: "", nextAction: "", updatedAt: null };
const emptyBrandProfile: BrandProfile = { story: "", philosophy: "", audience: "", keywords: "", differentiation: "", productDirection: "", visualLanguage: "", annualGoal: "", version: 0, updatedAt: null };

const toDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const fromDateKey = (key: string) => new Date(`${key}T12:00:00`);
const addDaysKey = (key: string, days: number) => { const date = fromDateKey(key); date.setDate(date.getDate() + days); return toDateKey(date); };

function parseGoalChecklist(content: string): GoalChecklistItem[] {
  return content.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    return match ? { done: match[1].toLowerCase() === "x", text: match[2].trim() } : { done: false, text: line.replace(/^[-•]\s*/, "").trim() };
  }).filter(item => item.text);
}

function serializeGoalChecklist(items: GoalChecklistItem[]) {
  return items.map(item => `- [${item.done ? "x" : " "}] ${item.text.trim()}`).filter(line => !line.endsWith("] ")).join("\n");
}

function splitReadingTags(value: string) {
  return value.split(/[，,、;；\n]+/).map(tag => tag.trim()).filter(Boolean).slice(0, 20);
}

function getCalendarCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const mondayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthIndex, index - mondayOffset + 1);
    return { date, key: toDateKey(date), day: date.getDate(), current: date.getMonth() === monthIndex };
  });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "保存失败，请稍后重试");
  return body;
}

const MAX_BROWSER_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const RETRY_BROWSER_UPLOAD_BYTES = 700 * 1024;

async function optimizeImageForUpload(file: File, aggressive = false) {
  const targetBytes = aggressive ? RETRY_BROWSER_UPLOAD_BYTES : MAX_BROWSER_UPLOAD_BYTES;
  const maxDimension = aggressive ? 1400 : 2200;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (!aggressive && file.size <= targetBytes && Math.max(bitmap.width, bitmap.height) <= maxDimension) return file;
    let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    let quality = aggressive ? 0.78 : 0.86;
    let smallestBlob: Blob | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      context.fillStyle = "#fffaf0";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && (!smallestBlob || blob.size < smallestBlob.size)) smallestBlob = blob;
      if (blob && blob.size <= targetBytes) {
        const name = file.name.replace(/\.[^.]+$/, "") || "slowday-image";
        return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
      }
      scale *= 0.72;
      quality = Math.max(0.5, quality - 0.07);
    }
    if (smallestBlob) {
      const name = file.name.replace(/\.[^.]+$/, "") || "slowday-image";
      return new File([smallestBlob], `${name}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
    }
    return file;
  } finally {
    bitmap?.close();
  }
}

function MiniCalendar({ month, selectedKey, todayKey, onSelect, onMonthChange }: { month: Date; selectedKey: string; todayKey: string; onSelect: (key: string) => void; onMonthChange: (delta: number) => void }) {
  const cells = getCalendarCells(month);
  return (
    <div className="mini-calendar">
      <div className="mini-head"><b>{month.getFullYear()} 年 {month.getMonth() + 1} 月</b><span><button onClick={() => onMonthChange(-1)} aria-label="上个月">‹</button><button onClick={() => onMonthChange(1)} aria-label="下个月">›</button></span></div>
      <div className="mini-grid mini-week">{["一", "二", "三", "四", "五", "六", "日"].map(x => <span key={x}>{x}</span>)}</div>
      <div className="mini-grid">
        {cells.map(cell => <button key={cell.key} className={`${!cell.current ? "muted" : ""} ${cell.key === selectedKey ? "selected" : ""} ${cell.key === todayKey ? "mini-today" : ""}`} onClick={() => onSelect(cell.key)}>{cell.day}</button>)}
      </div>
    </div>
  );
}

export default function Home() {
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [visibleMonth, setVisibleMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [view, setView] = useState<View>("home");
  const [composer, setComposer] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [review, setReview] = useState<Review>(emptyReview);
  const [analysis, setAnalysis] = useState("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [goalDrafts, setGoalDrafts] = useState<Record<GoalScope, string>>({ week: "", month: "", year: "" });
  const [goalProgress, setGoalProgress] = useState<Record<GoalScope, number>>({ week: 0, month: 0, year: 0 });
  const [goalNewItem, setGoalNewItem] = useState<Record<GoalScope, string>>({ week: "", month: "", year: "" });
  const [goalSaving, setGoalSaving] = useState<GoalScope | null>(null);
  const [yearMonthGoalDrafts, setYearMonthGoalDrafts] = useState<Record<string, string>>({});
  const [yearMonthGoalNewItems, setYearMonthGoalNewItems] = useState<Record<string, string>>({});
  const [yearMonthGoalSaving, setYearMonthGoalSaving] = useState<string | null>(null);
  const [reviewPeriod, setReviewPeriod] = useState<"week" | "month" | "year">("month");
  const [reviewComparison, setReviewComparison] = useState<ReviewComparison | null>(null);
  const [reviewComparisonLoading, setReviewComparisonLoading] = useState(false);
  const [apiModal, setApiModal] = useState(false);
  const [apiSection, setApiSection] = useState<"ai" | "developer">("ai");
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [apiKeyName, setApiKeyName] = useState("我的集成");
  const [newApiToken, setNewApiToken] = useState("");
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [aiProvider, setAiProvider] = useState<AIProvider>("deepseek");
  const [aiModel, setAiModel] = useState("deepseek-v4-flash");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [analysisSource, setAnalysisSource] = useState<AIProvider | "">("");
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [authValue, setAuthValue] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [accountModal, setAccountModal] = useState(false);
  const [readingItems, setReadingItems] = useState<ReadingItem[]>([]);
  const [brandProgress, setBrandProgress] = useState<BrandProgress>(emptyBrandProgress);
  const [brandProfile, setBrandProfile] = useState<BrandProfile>(emptyBrandProfile);
  const [brandProfileHistory, setBrandProfileHistory] = useState<BrandProfileVersion[]>([]);
  const [brandKnowledgeStats, setBrandKnowledgeStats] = useState<BrandKnowledgeStats>({ total: 0, newSinceVersion: 0 });
  const [brandEvolution, setBrandEvolution] = useState<BrandEvolutionProposal | null>(null);
  const [brandEvolving, setBrandEvolving] = useState(false);
  const [brandMilestones, setBrandMilestones] = useState<BrandMilestone[]>([]);
  const [readingSummary, setReadingSummary] = useState<ReadingSummary | null>(null);
  const [readingSummaryLoading, setReadingSummaryLoading] = useState(false);
  const [readingModal, setReadingModal] = useState(false);
  const [readingEditingId, setReadingEditingId] = useState<number | null>(null);
  const [readingDraft, setReadingDraft] = useState({ date: todayKey, title: "", source: "", url: "", imageUrl: "", note: "", tags: "", resourceType: "文字想法" as ReadingItem["resourceType"], primaryCategory: "品牌定位", workflowStatus: "pending" as ReadingItem["workflowStatus"], intendedUse: "暂时研究", topic: "" });
  const [readingTagInput, setReadingTagInput] = useState("");
  const [syncState, setSyncState] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [error, setError] = useState("");
  const [cheer, setCheer] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskDate, setEditingTaskDate] = useState("");
  const calendarTaskClickTimers = useRef<Record<number, number>>({});

  const visibleMonthKey = toMonthKey(visibleMonth);
  const selectedDate = fromDateKey(selectedKey);
  const selectedDay = selectedDate.getDate();
  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedYear = selectedDate.getFullYear();
  const overviewAnchor = selectedKey;

  useEffect(() => {
    void api<{ authenticated: boolean; user?: Account }>("/api/auth/session")
      .then(result => setAccount(result.user ?? null))
      .catch(() => setAccount(null))
      .finally(() => setAuthReady(true));
  }, []);

  const loadCalendar = useCallback(async (month: string) => {
    try {
      setSyncState("loading");
      const data = await api<{ tasks: Task[]; reviews: CalendarReview[] }>(`/api/calendar?month=${month}`);
      setTasks(data.tasks);
      setReviews(Object.fromEntries(data.reviews.map(item => [item.date, {
        mood: moods.some(mood => mood.label === item.mood) ? item.mood : "平静",
        energy: item.energy,
        text: item.text || "",
        keep: item.keep || "",
        start: item.start || item.win || "",
        improve: item.improve || "",
        stop: item.stop || "",
        analysis: item.analysis || "",
        progressSummary: item.progressSummary || "",
      }])));
      setSyncState("saved");
    } catch (cause) {
      setTasks([]);
      setReviews({});
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "无法连接云端");
    }
  }, []);

  const loadOverview = useCallback(async (period: "week" | "month" | "year", anchor: string) => {
    try {
      setSyncState("loading");
      const data = await api<OverviewData>(`/api/v1/overview?period=${period}&anchor=${anchor}`);
      setOverview(data);
      setGoalDrafts({ week: data.goals.week.content, month: data.goals.month.content, year: data.goals.year.content });
      setGoalProgress({ week: data.goals.week.progress, month: data.goals.month.progress, year: data.goals.year.progress });
      setYearMonthGoalDrafts(Object.fromEntries(data.monthlyGoals.map(goal => [goal.periodKey, goal.content])));
      setSyncState("saved");
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "复盘总览载入失败");
    }
  }, []);

  const loadCollections = useCallback(async () => {
    try {
      setSyncState("loading");
      const [reading, progress, profile, milestones] = await Promise.all([
        api<{ items: ReadingItem[] }>("/api/reading"),
        api<{ progress: BrandProgress }>("/api/brand-progress"),
        api<{ profile: BrandProfile; history: BrandProfileVersion[]; knowledgeStats: BrandKnowledgeStats }>("/api/brand-profile"),
        api<{ milestones: BrandMilestone[] }>("/api/milestones"),
      ]);
      setReadingItems(reading.items);
      setBrandProgress(progress.progress);
      setBrandProfile(profile.profile);
      setBrandProfileHistory(profile.history);
      setBrandKnowledgeStats(profile.knowledgeStats);
      setBrandMilestones(milestones.milestones);
      setSyncState("saved");
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "阅读记录载入失败");
    }
  }, []);

  useEffect(() => {
    if (!account) return;
    const timer = window.setTimeout(() => void loadCalendar(visibleMonthKey), 0);
    return () => window.clearTimeout(timer);
  }, [visibleMonthKey, loadCalendar, account]);

  useEffect(() => {
    if (view !== "overview") return;
    if (!account) return;
    const timer = window.setTimeout(() => void loadOverview(reviewPeriod, overviewAnchor), 0);
    return () => window.clearTimeout(timer);
  }, [view, reviewPeriod, overviewAnchor, loadOverview, account]);

  useEffect(() => {
    if (!account || (view !== "home" && view !== "reading" && view !== "followup")) return;
    const timer = window.setTimeout(() => void loadCollections(), 0);
    return () => window.clearTimeout(timer);
  }, [account, view, loadCollections]);

  useEffect(() => {
    if (!account || view !== "home") return;
    const timer = window.setTimeout(() => {
      void api<{ data: Task[] }>(`/api/v1/tasks?from=${todayKey}&to=${addDaysKey(todayKey, 7)}&limit=100`)
        .then(result => setUpcomingTasks(result.data))
        .catch(() => setUpcomingTasks([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [account, view, todayKey]);

  const selectedTasks = tasks
    .filter(t => t.date === selectedKey)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.id - b.id);
  const selectedRemaining = selectedTasks.filter(t => !t.done).length;
  const selectedReadingCount = readingItems.filter(item => item.date === selectedKey).length;
  const monthTasks = tasks;
  const done = tasks.filter(t => t.done).length;
  const completion = Math.round((done / Math.max(tasks.length, 1)) * 100);

  const calendarCells = useMemo(() => getCalendarCells(visibleMonth), [visibleMonth]);

  function selectDate(key: string) {
    const date = fromDateKey(key);
    setSelectedKey(key);
    if (date.getFullYear() !== visibleMonth.getFullYear() || date.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  function changeMonth(delta: number) {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1);
    setVisibleMonth(next);
    setSelectedKey(toDateKey(next));
  }

  function goToday() {
    setReviewComparison(null);
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedKey(toDateKey(today));
  }

  function changeReviewRange(delta: number) {
    setReviewComparison(null);
    if (reviewPeriod === "year") {
      const next = new Date(selectedDate.getFullYear() + delta, selectedDate.getMonth(), 1);
      setSelectedKey(toDateKey(next));
      setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
      return;
    }
    if (reviewPeriod === "month") {
      changeMonth(delta);
      return;
    }
    const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + delta * 7);
    setSelectedKey(toDateKey(next));
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  async function openApiSettings() {
    setApiModal(true);
    setApiSection("ai");
    setNewApiToken("");
    setAiApiKey("");
    try {
      const [keyResult, aiResult] = await Promise.all([
        api<{ data: ApiKeyItem[] }>("/api/v1/keys"),
        api<{ configured: boolean; config: AIConfig | null }>("/api/ai-config"),
      ]);
      setApiKeys(keyResult.data);
      setAiConfig(aiResult.config);
      if (aiResult.config) {
        setAiProvider(aiResult.config.provider);
        setAiModel(aiResult.config.model);
        setAiBaseUrl(aiResult.config.baseUrl ?? "");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "API 配置载入失败");
    }
  }

  function changeAiProvider(provider: AIProvider) {
    setAiProvider(provider);
    setAiModel(provider === "deepseek" ? "deepseek-v4-flash" : provider === "openai" ? "gpt-5.6-luna" : "");
  }

  async function saveAiConfig() {
    try {
      setAiSaving(true);
      const result = await api<{ config: AIConfig }>("/api/ai-config", { method: "PUT", body: JSON.stringify({ provider: aiProvider, model: aiModel, baseUrl: aiProvider === "custom" ? aiBaseUrl : undefined, apiKey: aiApiKey || undefined }) });
      setAiConfig(result.config);
      setAiApiKey("");
      showCheer("你的 AI 配置已加密保存。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 配置保存失败");
    } finally {
      setAiSaving(false);
    }
  }

  async function testAiConfig() {
    try {
      setAiSaving(true);
      await api("/api/ai-config/test", { method: "POST", body: "{}" });
      showCheer("连接成功，这把钥匙能用。", true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连接测试失败");
    } finally {
      setAiSaving(false);
    }
  }

  async function deleteAiConfig() {
    try {
      setAiSaving(true);
      await api("/api/ai-config", { method: "DELETE" });
      setAiConfig(null);
      setAiApiKey("");
      showCheer("AI Key 已从你的账号删除。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 配置删除失败");
    } finally {
      setAiSaving(false);
    }
  }

  async function createKey() {
    try {
      const result = await api<{ data: ApiKeyItem; token: string }>("/api/v1/keys", { method: "POST", body: JSON.stringify({ name: apiKeyName }) });
      setApiKeys(prev => [result.data, ...prev]);
      setNewApiToken(result.token);
      showCheer("API Key 已生成，只展示这一次。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "API Key 创建失败");
    }
  }

  async function revokeKey(id: number) {
    try {
      await api(`/api/v1/keys/${id}`, { method: "DELETE" });
      setApiKeys(prev => prev.map(key => key.id === id ? { ...key, revokedAt: new Date().toISOString() } : key));
      showCheer("这把钥匙已经失效。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "撤销失败");
    }
  }

  async function addTask() {
    if (!taskTitle.trim()) return;
    try {
      setSyncState("saving");
      const data = await api<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify({ date: selectedKey, title: taskTitle.trim(), category: "工作" }) });
      setTasks(prev => [...prev, data.task]);
      if (data.task.date >= todayKey && data.task.date <= addDaysKey(todayKey, 7)) setUpcomingTasks(prev => [...prev, data.task].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id));
      setTaskTitle("");
      setComposer(false);
      setSyncState("saved");
      showCheer("收到。已经替未来的你记上一笔 ☕");
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "待办保存失败");
    }
  }

  async function toggleTask(id: number) {
    const current = tasks.find(task => task.id === id);
    if (!current) return;
    const nextDone = !current.done;
    const dayTasks = tasks.filter(task => task.date === current.date);
    const remainingAfter = dayTasks.filter(task => task.id !== id && !task.done).length + (nextDone ? 0 : 1);
    setTasks(prev => prev.map(task => task.id === id ? { ...task, done: nextDone } : task));
    setUpcomingTasks(prev => prev.map(task => task.id === id ? { ...task, done: nextDone } : task));
    try {
      setSyncState("saving");
      await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: nextDone }) });
      setSyncState("saved");
      if (nextDone && remainingAfter === 0) showCheer("全清！今天可以理直气壮地躺了。", true);
      else if (nextDone) showCheer(["拿捏一项，咖啡都更香了。", "好，今天又被你推进了一点。", "划掉的不是待办，是一点点内耗。"][(id + remainingAfter) % 3]);
      else showCheer("任务复活了。没关系，诚实比假装完成酷。");
    } catch (cause) {
      setTasks(prev => prev.map(task => task.id === id ? { ...task, done: current.done } : task));
      setUpcomingTasks(prev => prev.map(task => task.id === id ? { ...task, done: current.done } : task));
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "状态更新失败");
    }
  }

  function beginTaskEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
    setEditingTaskDate(task.date);
  }

  async function updateTask(task: Task, nextTitle: string, nextDate: string) {
    const title = nextTitle.trim();
    if (!title || !nextDate || (title === task.title && nextDate === task.date)) return;
    try {
      const data = await api<{ task: Task }>(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ title, date: nextDate }) });
      setTasks(prev => {
        const withoutTask = prev.filter(item => item.id !== task.id);
        return data.task.date.startsWith(visibleMonthKey) ? [...withoutTask, data.task].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id) : withoutTask;
      });
      setUpcomingTasks(prev => {
        const withoutTask = prev.filter(item => item.id !== task.id);
        return data.task.date >= todayKey && data.task.date <= addDaysKey(todayKey, 7) ? [...withoutTask, data.task].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id) : withoutTask;
      });
      showCheer("待办已经改好。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "修改失败"); }
  }

  async function saveTaskEdit(task: Task) {
    const title = editingTaskTitle;
    const date = editingTaskDate;
    setEditingTaskId(null);
    await updateTask(task, title, date);
  }

  function handleTaskEditorBlur(event: ReactFocusEvent<HTMLDivElement>, task: Task) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    void saveTaskEdit(task);
  }

  function handleCalendarTaskClick(event: ReactMouseEvent<HTMLButtonElement>, task: Task) {
    event.stopPropagation();
    const pending = calendarTaskClickTimers.current[task.id];
    if (pending) window.clearTimeout(pending);
    calendarTaskClickTimers.current[task.id] = window.setTimeout(() => {
      delete calendarTaskClickTimers.current[task.id];
      beginTaskEdit(task);
    }, 240);
  }

  function handleCalendarTaskDoubleClick(event: ReactMouseEvent<HTMLButtonElement>, task: Task) {
    event.stopPropagation();
    const pending = calendarTaskClickTimers.current[task.id];
    if (pending) window.clearTimeout(pending);
    delete calendarTaskClickTimers.current[task.id];
    void toggleTask(task.id);
  }

  function deleteTask(task: Task) {
    setDeleteTarget({ kind: "task", id: task.id, title: task.title });
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target || deleting) return;
    setDeleting(true);
    try {
      if (target.kind === "task") {
        await api(`/api/tasks/${target.id}`, { method: "DELETE" });
        setTasks(prev => prev.filter(item => item.id !== target.id));
        setUpcomingTasks(prev => prev.filter(item => item.id !== target.id));
        showCheer("这件事从日历里拿掉了。");
      } else {
        await api(`/api/reading/${target.id}`, { method: "DELETE" });
        setReadingItems(prev => prev.filter(row => row.id !== target.id));
        showCheer("阅读记录已拿下书架。");
      }
      setDeleteTarget(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "删除失败"); }
    finally { setDeleting(false); }
  }

  function showCheer(message: string, celebrate = false) {
    setCheer(message);
    setCelebrating(celebrate);
    window.setTimeout(() => setCheer(""), 2600);
    if (celebrate) window.setTimeout(() => setCelebrating(false), 2200);
  }

  function openReview(key = selectedKey) {
    selectDate(key);
    const saved = reviews[key] || emptyReview;
    setReview(saved);
    setAnalysis(saved.analysis || "");
    setView("review");
  }

  function openReviewOverview(period: "week" | "month" | "year") {
    setReviewComparison(null);
    setReviewPeriod(period);
    setView("overview");
  }

  function selectReviewPeriod(period: "week" | "month" | "year") {
    setReviewComparison(null);
    setReviewPeriod(period);
  }

  async function saveGoal(scope: GoalScope, nextContent = goalDrafts[scope], nextProgress = goalProgress[scope]) {
    if (!overview || (nextContent === overview.goals[scope].content && nextProgress === overview.goals[scope].progress)) return;
    try {
      setGoalSaving(scope);
      setSyncState("saving");
      const result = await api<{ goal: GoalItem }>("/api/goals", { method: "PUT", body: JSON.stringify({ scope, anchor: overviewAnchor, content: nextContent, progress: nextProgress }) });
      setOverview(current => current ? { ...current, goals: { ...current.goals, [scope]: result.goal } } : current);
      setSyncState("saved");
      showCheer(`${scope === "week" ? "周" : scope === "month" ? "月" : "年"}目标已放进时间里。`);
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "目标保存失败");
    } finally {
      setGoalSaving(null);
    }
  }

  function updateGoalChecklist(scope: GoalScope, items: GoalChecklistItem[], save = false) {
    const content = serializeGoalChecklist(items);
    const progress = items.length ? Math.round(items.filter(item => item.done).length / items.length * 100) : 0;
    setGoalDrafts(current => ({ ...current, [scope]: content }));
    setGoalProgress(current => ({ ...current, [scope]: progress }));
    if (save) void saveGoal(scope, content, progress);
  }

  function addGoalChecklistItem(scope: GoalScope) {
    const text = goalNewItem[scope].trim();
    if (!text) return;
    updateGoalChecklist(scope, [...parseGoalChecklist(goalDrafts[scope]), { text, done: false }], true);
    setGoalNewItem(current => ({ ...current, [scope]: "" }));
  }

  async function saveYearMonthGoal(periodKey: string, nextContent = yearMonthGoalDrafts[periodKey] ?? "") {
    const currentGoal = overview?.monthlyGoals.find(goal => goal.periodKey === periodKey);
    if (!overview || !currentGoal || nextContent === currentGoal.content) return;
    const items = parseGoalChecklist(nextContent);
    const progress = items.length ? Math.round(items.filter(item => item.done).length / items.length * 100) : 0;
    try {
      setYearMonthGoalSaving(periodKey);
      setSyncState("saving");
      const result = await api<{ goal: GoalItem }>("/api/goals", { method: "PUT", body: JSON.stringify({ scope: "month", anchor: `${periodKey}-01`, content: nextContent, progress }) });
      setOverview(current => current ? { ...current, monthlyGoals: current.monthlyGoals.map(goal => goal.periodKey === periodKey ? { ...result.goal, label: goal.label } : goal) } : current);
      setSyncState("saved");
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "月目标保存失败");
    } finally {
      setYearMonthGoalSaving(null);
    }
  }

  function updateYearMonthGoal(periodKey: string, items: GoalChecklistItem[], save = false) {
    const content = serializeGoalChecklist(items);
    setYearMonthGoalDrafts(current => ({ ...current, [periodKey]: content }));
    if (save) void saveYearMonthGoal(periodKey, content);
  }

  function addYearMonthGoalItem(periodKey: string) {
    const text = (yearMonthGoalNewItems[periodKey] ?? "").trim();
    if (!text) return;
    updateYearMonthGoal(periodKey, [...parseGoalChecklist(yearMonthGoalDrafts[periodKey] ?? ""), { text, done: false }], true);
    setYearMonthGoalNewItems(current => ({ ...current, [periodKey]: "" }));
  }

  async function compareReviewPeriod() {
    if (reviewComparisonLoading) return;
    try {
      setReviewComparisonLoading(true);
      const result = await api<ReviewComparison>("/api/review-comparison", { method: "POST", body: JSON.stringify({ period: reviewPeriod, anchor: overviewAnchor }) });
      setReviewComparison(result);
      showCheer(`AI 已完成${reviewPeriod === "week" ? "周" : reviewPeriod === "month" ? "月" : "年"}度对比。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 对比总结生成失败");
    } finally {
      setReviewComparisonLoading(false);
    }
  }

  async function saveReview() {
    try {
      setSyncState("saving");
      const data = await api<{ review: Review }>(`/api/reviews/${selectedKey}`, { method: "PUT", body: JSON.stringify(review) });
      setReview(data.review);
      setReviews(prev => ({ ...prev, [selectedKey]: data.review }));
      setSyncState("saved");
      return true;
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "复盘保存失败");
      return false;
    }
  }

  async function runAnalysis() {
    if (!(await saveReview())) return;
    try {
      setSyncState("saving");
      const data = await api<{ analysis: string; progressSummary: string; source: AIProvider }>("/api/analysis", { method: "POST", body: JSON.stringify({ date: selectedKey }) });
      setAnalysis(data.analysis);
      setReview(prev => ({ ...prev, analysis: data.analysis, progressSummary: data.progressSummary }));
      setReviews(prev => ({ ...prev, [selectedKey]: { ...(prev[selectedKey] || review), analysis: data.analysis, progressSummary: data.progressSummary } }));
      setAnalysisSource(data.source);
      setSyncState("saved");
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "分析生成失败");
    }
  }

  async function submitAuth() {
    try {
      if (authMode === "register") {
        const result = await api<{ user: Account; recoveryKey: string }>("/api/auth/register", { method: "POST", body: JSON.stringify({ displayName: authValue }) });
        setAccount(result.user); setRecoveryKey(result.recoveryKey); setAuthValue("");
      } else {
        const result = await api<{ user: Account }>("/api/auth/login", { method: "POST", body: JSON.stringify({ recoveryKey: authValue }) });
        setAccount(result.user); setAuthValue("");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "登录失败"); }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    window.location.reload();
  }

  function newReading() {
    setReadingEditingId(null);
    setReadingDraft({ date: todayKey, title: "", source: "", url: "", imageUrl: "", note: "", tags: "", resourceType: "文字想法", primaryCategory: "品牌定位", workflowStatus: "pending", intendedUse: "暂时研究", topic: "" });
    setReadingTagInput("");
    setReadingModal(true);
  }

  function editReading(item: ReadingItem) {
    setReadingEditingId(item.id);
    setReadingDraft({ date: item.date, title: item.title, source: item.source, url: item.url, imageUrl: item.imageUrl, note: item.note, tags: item.tags || "", resourceType: item.resourceType, primaryCategory: item.primaryCategory, workflowStatus: item.workflowStatus, intendedUse: item.intendedUse, topic: item.topic || "" });
    setReadingTagInput("");
    setReadingModal(true);
  }

  function addReadingTag(raw = readingTagInput) {
    const additions = splitReadingTags(raw);
    if (!additions.length) return;
    const tags = Array.from(new Set([...splitReadingTags(readingDraft.tags), ...additions])).slice(0, 20);
    setReadingDraft(current => ({ ...current, tags: tags.join("，") }));
    setReadingTagInput("");
  }

  function removeReadingTag(tag: string) {
    setReadingDraft(current => ({ ...current, tags: splitReadingTags(current.tags).filter(item => item !== tag).join("，") }));
  }

  async function saveReading() {
    try {
      setSyncState("saving");
      const tags = Array.from(new Set([...splitReadingTags(readingDraft.tags), ...splitReadingTags(readingTagInput)])).slice(0, 20).join("，");
      const result = await api<{ item: ReadingItem }>(readingEditingId ? `/api/reading/${readingEditingId}` : "/api/reading", { method: readingEditingId ? "PATCH" : "POST", body: JSON.stringify({ ...readingDraft, tags }) });
      setReadingItems(prev => readingEditingId ? prev.map(item => item.id === result.item.id ? result.item : item) : [result.item, ...prev]);
      setReadingTagInput("");
      setReadingModal(false);
      setSyncState("saved");
      showCheer(readingEditingId ? "旁注已经改好。" : "这次阅读没有白白路过。");
    } catch (cause) { setSyncState("error"); setError(cause instanceof Error ? cause.message : "阅读记录保存失败"); }
  }

  function deleteReading(item: ReadingItem) {
    setDeleteTarget({ kind: "reading", id: item.id, title: item.title });
  }

  async function importReadingLink(url: string) {
    if (!/^https?:\/\//i.test(url.trim())) {
      const result = await api<{ item: ReadingItem }>("/api/reading", { method: "POST", body: JSON.stringify({ date: todayKey, title: url.trim().slice(0, 80), note: url.trim(), resourceType: "文字想法", primaryCategory: "品牌定位", workflowStatus: "pending", intendedUse: "暂时研究" }) });
      setReadingItems(prev => [result.item, ...prev]);
      return { item: result.item, duplicate: false, localized: false, imageCaptured: false };
    }
    const result = await api<{ item: ReadingItem; duplicate: boolean; refreshed?: boolean; localized?: boolean; imageCaptured?: boolean }>("/api/reading/import-link", { method: "POST", body: JSON.stringify({ url }) });
    setReadingItems(prev => prev.some(item => item.id === result.item.id) ? prev.map(item => item.id === result.item.id ? result.item : item) : [result.item, ...prev]);
    return result;
  }

  async function importReadingMedia(files: File[], message: string) {
    const imported: ReadingItem[] = [];
    let interpretedCount = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        const form = new FormData();
        form.append("file", file);
        if (message) form.append("message", message);
        const response = await fetch("/api/reading/import-document", { method: "POST", body: form });
        const result = await response.json() as { item?: ReadingItem; error?: string };
        if (!response.ok || !result.item) throw new Error(result.error || "文档上传失败");
        imported.push(result.item);
        setReadingItems(prev => [result.item!, ...prev]);
        continue;
      }
      let upload = await optimizeImageForUpload(file);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const form = new FormData();
        form.append("files", upload);
        if (message) form.append("message", message);
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 75_000);
        try {
          const response = await fetch("/api/reading/import-media", { method: "POST", body: form, signal: controller.signal });
          const raw = await response.text();
          let result: { items?: ReadingItem[]; interpretedCount?: number; error?: string } = {};
          try { result = raw ? JSON.parse(raw) as typeof result : {}; } catch { /* gateway error pages are not JSON */ }
          if (response.status === 413 && attempt === 0) {
            upload = await optimizeImageForUpload(file, true);
            continue;
          }
          if (!response.ok || !result.items) throw new Error(result.error || (response.status === 413 ? "图片自动压缩后仍未上传成功，请换一张图片再试" : `图片保存失败（${response.status || "网络异常"}）`));
          imported.push(...result.items);
          interpretedCount += result.interpretedCount ?? 0;
          setReadingItems(prev => [...result.items!, ...prev]);
          break;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw new Error("图片自动识别超过 75 秒，请重试或换一张图片");
          throw error;
        } finally {
          window.clearTimeout(timeout);
        }
      }
    }
    return { items: imported, interpretedCount };
  }

  async function reanalyzeReading(item: ReadingItem) {
    try {
      setSyncState("saving");
      const result = await api<{ item: ReadingItem }>(`/api/reading/${item.id}/reanalyze`, { method: "POST", body: "{}" });
      setReadingItems(previous => previous.map(current => current.id === result.item.id ? result.item : current));
      setSyncState("saved");
      showCheer(result.item.url ? "已经重新识别，点击标题即可打开原文。" : "图片已重新解读，但地址栏仍不够清晰。", true);
    } catch (cause) {
      setSyncState("error");
      const message = cause instanceof Error ? cause.message : "重新识别失败";
      setError(message);
      if (message.includes("尚未保存 AI Key")) void openApiSettings();
    }
  }

  async function confirmReading(item: ReadingItem) {
    try {
      const result = await api<{ item: ReadingItem }>(`/api/reading/${item.id}`, { method: "PATCH", body: JSON.stringify({ workflowStatus: "confirmed" }) });
      setReadingItems(current => current.map(row => row.id === result.item.id ? result.item : row));
      showCheer(`“${item.title}”已归档到${item.primaryCategory}。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "确认归档失败");
    }
  }

  async function saveBrandProgress(progress: BrandProgress) {
    try {
      setSyncState("saving");
      const result = await api<{ progress: BrandProgress }>("/api/brand-progress", { method: "PUT", body: JSON.stringify(progress) });
      setBrandProgress(result.progress);
      setSyncState("saved");
      showCheer("品牌推进信息已保存。", true);
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "品牌推进信息保存失败");
    }
  }

  async function saveBrandProfile(profile: BrandProfile) {
    try {
      setSyncState("saving");
      const result = await api<{ profile: BrandProfile }>("/api/brand-profile", { method: "PUT", body: JSON.stringify(profile) });
      setBrandProfile(result.profile);
      await loadCollections();
      setSyncState("saved");
      showCheer(`品牌档案 v${result.profile.version} 已保存，AI 将按新版本判断。`, true);
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "品牌档案保存失败");
    }
  }

  async function evolveBrandProfile() {
    try {
      setBrandEvolving(true);
      setError("");
      const result = await api<{ proposal: Omit<BrandEvolutionProposal, "version" | "updatedAt"> }>("/api/brand-profile/evolve", { method: "POST" });
      setBrandEvolution({ ...result.proposal, version: brandProfile.version, updatedAt: brandProfile.updatedAt });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "品牌档案迭代失败");
    } finally {
      setBrandEvolving(false);
    }
  }

  async function addMilestone(input: { title: string; phase: BrandPhase; dueDate: string; deliverable?: string }) {
    try {
      setSyncState("saving");
      const result = await api<{ milestone: BrandMilestone }>("/api/milestones", { method: "POST", body: JSON.stringify(input) });
      setBrandMilestones(current => [result.milestone, ...current.filter(item => item.id !== result.milestone.id)]);
      setSyncState("saved");
      showCheer("新的品牌里程碑已经建立。", true);
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "里程碑创建失败");
    }
  }

  async function updateMilestone(milestone: BrandMilestone, values: Partial<Pick<BrandMilestone, "title" | "phase" | "dueDate" | "status" | "progress" | "deliverable">>) {
    try {
      setSyncState("saving");
      const result = await api<{ milestone: BrandMilestone }>(`/api/milestones/${milestone.id}`, { method: "PATCH", body: JSON.stringify(values) });
      setBrandMilestones(current => current.map(item => item.id === result.milestone.id ? result.milestone : item));
      setSyncState("saved");
      if (result.milestone.status === "done" && milestone.status !== "done") showCheer(`“${result.milestone.title}”已完成。`, true);
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "里程碑更新失败");
    }
  }

  async function deleteMilestone(milestone: BrandMilestone) {
    try {
      setSyncState("saving");
      await api(`/api/milestones/${milestone.id}`, { method: "DELETE" });
      setBrandMilestones(current => current.filter(item => item.id !== milestone.id));
      setSyncState("saved");
      showCheer("这条内容已移出跟进。 ");
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "移出跟进失败");
    }
  }

  async function convertReadingToMilestone(item: ReadingItem) {
    try {
      setSyncState("saving");
      const result = await api<{ milestone: BrandMilestone; duplicate: boolean }>("/api/milestones", { method: "POST", body: JSON.stringify({ title: item.title, phase: item.intendedUse || "暂时研究", dueDate: addDaysKey(todayKey, 14), deliverable: item.note, sourceReadingId: item.id }) });
      setBrandMilestones(current => [result.milestone, ...current.filter(row => row.id !== result.milestone.id)]);
      setSyncState("saved");
      showCheer(result.duplicate ? "这条灵感已经收录到跟进。" : "灵感已收录到独立跟进页。", !result.duplicate);
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "收录跟进失败");
    }
  }

  async function loadReadingCanvas(tag: string) {
    const result = await api<{ layout: ReadingCanvasLayout }>(`/api/reading/canvas?tag=${encodeURIComponent(tag)}`);
    return result.layout;
  }

  async function saveReadingCanvas(tag: string, layout: ReadingCanvasLayout) {
    await api<{ layout: ReadingCanvasLayout }>("/api/reading/canvas", { method: "PUT", body: JSON.stringify({ tag, ...layout }) });
  }

  async function summarizeReading() {
    if (!readingItems.length || readingSummaryLoading) return;
    try {
      setReadingSummaryLoading(true);
      const result = await api<ReadingSummary>("/api/reading/summary", { method: "POST", body: "{}" });
      setReadingSummary(result);
      showCheer("AI 已经把这段阅读积累整理好了。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "阅读总结生成失败");
    } finally {
      setReadingSummaryLoading(false);
    }
  }

  function contextualCreate() {
    if (view === "reading") newReading();
    else setComposer(true);
  }

  if (!authReady) return <main className="auth-page"><section className="auth-card"><span className="brand-mark">S</span><h1>Slowday</h1><p>正在磨一杯属于你的日历…</p></section></main>;
  if (!account) return <main className="auth-page"><section className="auth-card"><span className="brand-mark">S</span><small>OPEN SOURCE · YOUR DATA</small><h1>Slowday</h1><p>日历、待办、复盘和你的 AI。无需 GPT 账号，也不会共享任何人的模型密钥。</p><div className="auth-tabs"><button className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setAuthValue(""); }}>创建账号</button><button className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthValue(""); }}>已有账号</button></div><label>{authMode === "register" ? "你的昵称" : "恢复密钥"}<input autoFocus type={authMode === "register" ? "text" : "password"} value={authValue} onChange={e => setAuthValue(e.target.value)} onKeyDown={e => e.key === "Enter" && void submitAuth()} placeholder={authMode === "register" ? "例如：小慢" : "slowday_recovery_…"} /></label><button className="primary-btn wide" onClick={() => void submitAuth()}>{authMode === "register" ? "创建我的日历" : "进入我的日历"}</button><div className="auth-divider"><span>或者</span></div><a className="chatgpt-login" href="/signin-with-chatgpt?return_to=/">使用 ChatGPT 账号登录</a><small className="auth-note">注册后会生成一把恢复密钥。服务器只保存摘要，丢失后无法找回，请妥善保管。</small></section>{error && <button className="error-toast" onClick={() => setError("")}><b>没有完成</b><span>{error}</span><i>×</i></button>}</main>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><button className="brand-mark" onClick={() => setView("home")} aria-label="返回首页">S</button><button className="brand-home" onClick={() => setView("home")}>Slowday</button><button className="brand-ai" onClick={() => void openApiSettings()}><b>✦ AI 设置</b><small>使用你自己的 Key</small></button></div>
        <nav aria-label="主导航">
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>首页</button>
          <button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>日历</button>
          <button className={view === "review" || view === "overview" ? "active" : ""} onClick={() => setView("overview")}>复盘</button>
          <button className={view === "reading" ? "active" : ""} onClick={() => setView("reading")}>知识库</button>
          <button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")}>品牌档案</button>
          <button className={view === "followup" ? "active" : ""} onClick={() => setView("followup")}>跟进</button>
        </nav>
        <div className="top-actions">
          {view !== "reading" && <span className={`sync-status ${syncState}`}>{syncState === "loading" ? "正在载入" : syncState === "saving" ? "正在保存" : syncState === "error" ? "云端异常" : "✓ 已同步"}</span>}
          <button className="icon-btn" aria-label="搜索">⌕</button>
          {view !== "home" && view !== "reading" && view !== "followup" && view !== "archive" && <button className="primary-btn context-create" onClick={contextualCreate}><span>＋</span> 新建待办</button>}
          <button className="avatar" aria-label="个人设置" onClick={() => setAccountModal(true)}>{account.displayName.slice(0, 1).toUpperCase()}</button>
        </div>
      </header>

      <section className="workspace">
        {view !== "home" && view !== "reading" && view !== "followup" && view !== "archive" && <aside className="sidebar">
          <MiniCalendar month={visibleMonth} selectedKey={selectedKey} todayKey={todayKey} onSelect={selectDate} onMonthChange={changeMonth} />
          <div className="rule" />
          <section className="side-section">
            <div className="section-label selected-todo-title"><span>{selectedMonth} 月 {selectedDay} 日 · TODO</span><button aria-label="为当天添加待办" onClick={() => setComposer(true)}>＋</button></div>
            <div className="sidebar-todos">
              {selectedTasks.length ? selectedTasks.map(task => (
                <div key={task.id} className={`side-todo ${task.done ? "done" : ""}`}>
                  {editingTaskId === task.id ? <div className="side-todo-editor inline-task-editor" onBlur={event => handleTaskEditorBlur(event, task)}><input className="inline-task-title" autoFocus value={editingTaskTitle} onChange={event => setEditingTaskTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditingTaskId(null); }} aria-label="修改待办内容" /><label className="inline-task-date" title="修改日期"><CalendarIcon /><input className="inline-task-date-input" type="date" value={editingTaskDate} onChange={event => setEditingTaskDate(event.target.value)} aria-label="修改待办日期" /></label></div> : <><button className="todo-check-only" aria-label={task.done ? "标记为未完成" : "标记为已完成"} onClick={() => void toggleTask(task.id)}><i>{task.done ? "✓" : ""}</i></button><button className="todo-title-edit" onClick={() => beginTaskEdit(task)} aria-label={`编辑待办：${task.title}`}>{task.title}</button></>}
                  <span className="todo-tools"><button aria-label="编辑待办" onClick={() => beginTaskEdit(task)}>✎</button><button aria-label="删除待办" onClick={() => void deleteTask(task)}>×</button></span>
                </div>
              )) : <button className="empty-todo" onClick={() => setComposer(true)}>＋ 给这一天安排点剧情</button>}
            </div>
            <p className={`day-vibe ${selectedTasks.length > 0 && selectedRemaining === 0 ? "cleared" : ""}`}>{selectedTasks.length === 0 ? "今日档期：清白得像刚洗的杯子。" : selectedRemaining === 0 ? "今日份全部拿捏，批准收工。" : `还剩 ${selectedRemaining} 项，咖啡还没凉。`}</p>
          </section>
          <section className="side-section paper-note">
            <span className="tape" />
            <small>{visibleMonth.getMonth() + 1} 月关键词</small>
            <strong>专注 · 松弛 · 完成</strong>
            <p>“不要赶路，去感受路。”</p>
          </section>
          <section className="month-progress">
            <div><span>本月完成度</span><b>{completion}%</b></div>
            <div className="progress"><i style={{ width: `${completion}%` }} /></div>
            <small>{done} 项已完成 · {tasks.length - done} 项进行中</small>
          </section>
        </aside>}

        {view === "home" ? (
          <HomeDashboard todayKey={todayKey} upcomingTasks={upcomingTasks} readingItems={readingItems} brandProgress={brandProgress} brandMilestones={brandMilestones} onOpenReading={() => setView("reading")} onOpenCalendar={() => setView("calendar")} onToggleTask={id => void toggleTask(id)} onUpdateTask={updateTask} onEditReading={editReading} onDeleteReading={item => void deleteReading(item)} onReanalyzeReading={reanalyzeReading} onSaveBrandProgress={saveBrandProgress} onAddMilestone={addMilestone} onUpdateMilestone={updateMilestone} onDeleteMilestone={deleteMilestone} onConvertReading={convertReadingToMilestone} onImportLink={importReadingLink} onImportMedia={importReadingMedia} />
        ) : view === "calendar" ? (
          <section className="calendar-panel">
            <div className="calendar-toolbar">
              <div className="date-nav"><button onClick={() => changeMonth(-1)} aria-label="上个月">‹</button><h1>{visibleMonth.getFullYear()} 年 {visibleMonth.getMonth() + 1} 月</h1><button onClick={() => changeMonth(1)} aria-label="下个月">›</button><button className="today" onClick={goToday}>今天</button></div>
            </div>
            <div className="weekday-row">{weekDays.map(day => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {calendarCells.map((cell, index) => {
                const key = cell.key;
                const dayTasks = monthTasks.filter(t => t.date === key).sort((a, b) => Number(a.done) - Number(b.done) || a.id - b.id);
                const hasReview = Boolean(reviews[key]);
                return (
                  <article key={`${cell.key}-${index}`} title="双击快速添加待办" className={`${!cell.current ? "outside" : ""} ${cell.key === todayKey ? "today-cell" : ""} ${cell.key === selectedKey ? "picked" : ""}`} onClick={() => selectDate(cell.key)} onDoubleClick={() => { selectDate(cell.key); setComposer(true); }}>
                    <div className="day-number"><span>{cell.day}</span>{hasReview && <button className="review-stamp" onClick={e => { e.stopPropagation(); openReview(cell.key); }}>已复盘</button>}</div>
                    <div className="day-tasks">
                      {dayTasks.map(task => editingTaskId === task.id ? <div key={task.id} className="task-chip-editor inline-task-editor" onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onBlur={event => handleTaskEditorBlur(event, task)}><input className="task-title-input inline-task-title" autoFocus value={editingTaskTitle} onChange={event => setEditingTaskTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditingTaskId(null); }} aria-label="修改待办内容" /><label className="inline-task-date" title="修改日期"><CalendarIcon /><input className="inline-task-date-input" type="date" value={editingTaskDate} onChange={event => setEditingTaskDate(event.target.value)} aria-label="修改待办日期" /></label></div> : <button key={task.id} className={`task-chip ${task.category} ${task.done ? "done" : ""}`} title="单击修改，双击完成" onClick={event => handleCalendarTaskClick(event, task)} onDoubleClick={event => handleCalendarTaskDoubleClick(event, task)}><i />{task.title}</button>)}
                    </div>
                    <button className="cell-add" aria-label={`${cell.day}日添加待办`} onClick={e => { e.stopPropagation(); selectDate(cell.key); setComposer(true); }}>＋</button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : view === "overview" ? (
          <section className="overview-panel">
            <div className="overview-head">
              <div><div className="overview-kicker"><small>REVIEW ARCHIVE · 复盘总览</small><div className="review-scope" aria-label="复盘周期"><button onClick={() => openReview()}>日复盘</button><button className={reviewPeriod === "week" ? "active" : ""} onClick={() => selectReviewPeriod("week")}>周复盘</button><button className={reviewPeriod === "month" ? "active" : ""} onClick={() => selectReviewPeriod("month")}>月复盘</button><button className={reviewPeriod === "year" ? "active" : ""} onClick={() => selectReviewPeriod("year")}>年复盘</button></div></div><h1>{overview?.label ?? (reviewPeriod === "week" ? "这一周" : reviewPeriod === "year" ? `${visibleMonth.getFullYear()} 年` : `${visibleMonth.getFullYear()} 年 ${visibleMonth.getMonth() + 1} 月`)}</h1><p>{reviewPeriod === "week" ? "把这一周摊开看看：什么值得留下，什么可以轻轻放下。" : reviewPeriod === "year" ? "把这一年慢慢展开，看看长期投入最终把你带到了哪里。" : "别急着评价这个月，先看看它留下了什么。"}</p></div>
              <div className="overview-nav"><button onClick={() => changeReviewRange(-1)}>‹</button><button onClick={goToday}>{reviewPeriod === "week" ? "本周" : reviewPeriod === "year" ? "今年" : "本月"}</button><button onClick={() => changeReviewRange(1)}>›</button></div>
            </div>
            {!overview || overview.period !== reviewPeriod || overview.anchor !== overviewAnchor ? <div className="overview-loading">正在翻找这段时间的咖啡渍与高光时刻…</div> : <>
              {(() => { const scope = reviewPeriod as GoalScope; const periodName = scope === "week" ? "周" : scope === "month" ? "月" : "年"; const periodDays = scope === "week" ? 7 : scope === "month" ? new Date(selectedYear, selectedMonth, 0).getDate() : (new Date(selectedYear, 1, 29).getMonth() === 1 ? 366 : 365); const previousName = scope === "week" ? "上周" : scope === "month" ? "上月" : "去年"; const checklist = parseGoalChecklist(goalDrafts[scope]); return <div className="simple-review-grid">
                <section className={`period-goal-card goal-${scope}`}>
                  <header><div><small>{scope.toUpperCase()} GOAL</small><h2>{scope === "year" ? "年度总目标" : `${periodName}目标`}</h2></div><span>{overview.goals[scope].label}</span></header>
                  <div className="period-goal-list">{checklist.length ? checklist.map((item, index) => <div className={item.done ? "done" : ""} key={index}><button aria-label={item.done ? "标记为未完成" : "标记为完成"} onClick={() => updateGoalChecklist(scope, checklist.map((entry, itemIndex) => itemIndex === index ? { ...entry, done: !entry.done } : entry), true)}>{item.done ? "✓" : ""}</button><input value={item.text} maxLength={180} onChange={event => updateGoalChecklist(scope, checklist.map((entry, itemIndex) => itemIndex === index ? { ...entry, text: event.target.value } : entry))} onBlur={() => void saveGoal(scope)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={`${periodName}目标 ${index + 1}`} /><button className="goal-item-delete" aria-label={`删除目标 ${index + 1}`} onClick={() => updateGoalChecklist(scope, checklist.filter((_, itemIndex) => itemIndex !== index), true)}>×</button></div>) : <p>还没有目标，先添加一件真正重要的事。</p>}</div>
                  <div className="goal-add-row"><input value={goalNewItem[scope]} maxLength={180} onChange={event => setGoalNewItem(current => ({ ...current, [scope]: event.target.value }))} onKeyDown={event => { if (event.key === "Enter") addGoalChecklistItem(scope); }} placeholder={`添加本${periodName}目标…`} /><button onClick={() => addGoalChecklistItem(scope)}>＋ 添加</button></div>
                  <footer>{goalSaving === scope ? "正在保存…" : `${checklist.filter(item => item.done).length} / ${checklist.length} 项完成`}</footer>
                </section>
                <section className="period-metrics" aria-label={`${periodName}度复盘数据`}>
                  <article><small>{periodName}目标完成度</small><b>{goalProgress[scope]}%</b><i><span style={{ width: `${goalProgress[scope]}%` }} /></i><p>{checklist.length ? `${checklist.filter(item => item.done).length} / ${checklist.length} 项已完成` : `先添加本${periodName}目标`}</p></article>
                  <article><small>本{periodName}待办完成率</small><b>{overview.summary.completionRate}%</b><i><span style={{ width: `${overview.summary.completionRate}%` }} /></i><p>{overview.summary.completed} / {overview.summary.taskCount} 项已完成</p></article>
                  <article><small>本{periodName}复盘</small><b>{overview.summary.reviewDays}<em>/{periodDays} 天</em></b><i><span style={{ width: `${Math.round(overview.summary.reviewDays / periodDays * 100)}%` }} /></i><p>{overview.summary.reviewDays ? "持续回看，才能看见变化" : `本${periodName}还没有留下复盘`}</p></article>
                </section>
                {scope === "year" && <section className="year-month-goals">
                  <header><div><small>12 MONTHLY GOALS</small><h2>这一年的 12 个月目标</h2></div><p>这里与每个月的月复盘同步，完成情况会一起更新。</p></header>
                  <div>{overview.monthlyGoals.map(monthGoal => { const monthChecklist = parseGoalChecklist(yearMonthGoalDrafts[monthGoal.periodKey] ?? monthGoal.content); const completedCount = monthChecklist.filter(item => item.done).length; return <article key={monthGoal.periodKey}>
                    <header><div><b>{monthGoal.label}</b><span>{monthChecklist.length ? `${completedCount}/${monthChecklist.length}` : "未设定"}</span></div><i><span style={{ width: `${monthChecklist.length ? Math.round(completedCount / monthChecklist.length * 100) : 0}%` }} /></i></header>
                    <div className="year-month-goal-list">{monthChecklist.length ? monthChecklist.map((item, itemIndex) => <div className={item.done ? "done" : ""} key={itemIndex}><button aria-label={`${monthGoal.label}${item.done ? "标记为未完成" : "标记为完成"}`} onClick={() => updateYearMonthGoal(monthGoal.periodKey, monthChecklist.map((entry, index) => index === itemIndex ? { ...entry, done: !entry.done } : entry), true)}>{item.done ? "✓" : ""}</button><input value={item.text} maxLength={180} onChange={event => updateYearMonthGoal(monthGoal.periodKey, monthChecklist.map((entry, index) => index === itemIndex ? { ...entry, text: event.target.value } : entry))} onBlur={() => void saveYearMonthGoal(monthGoal.periodKey)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={`${monthGoal.label}目标 ${itemIndex + 1}`} /><button className="goal-item-delete" aria-label={`删除${monthGoal.label}目标 ${itemIndex + 1}`} onClick={() => updateYearMonthGoal(monthGoal.periodKey, monthChecklist.filter((_, index) => index !== itemIndex), true)}>×</button></div>) : <p>这个月还没有目标</p>}</div>
                    <div className="year-month-goal-add"><input value={yearMonthGoalNewItems[monthGoal.periodKey] ?? ""} maxLength={180} onChange={event => setYearMonthGoalNewItems(current => ({ ...current, [monthGoal.periodKey]: event.target.value }))} onKeyDown={event => { if (event.key === "Enter") addYearMonthGoalItem(monthGoal.periodKey); }} placeholder={`添加 ${monthGoal.label}目标…`} /><button onClick={() => addYearMonthGoalItem(monthGoal.periodKey)}>＋</button></div>
                    <footer>{yearMonthGoalSaving === monthGoal.periodKey ? "正在保存…" : "与月复盘同步"}</footer>
                  </article>; })}</div>
                </section>}
                <section className={`period-ai-comparison ${reviewComparison ? "ready" : ""}`}>
                  <header><div><small>SLOWDAY AI · PERIOD COMPARE</small><h2>AI 总结 · 相比{previousName}</h2></div><button onClick={() => void compareReviewPeriod()} disabled={reviewComparisonLoading}>{reviewComparisonLoading ? "正在比较…" : reviewComparison ? "重新总结" : `✦ 总结并对比${previousName}`}</button></header>
                  {reviewComparison ? <><p>{reviewComparison.summary}</p>{reviewComparison.highlights.length > 0 && <div>{reviewComparison.highlights.map(item => <span key={item}>{item}</span>)}</div>}<footer><b>下个{periodName}期重点</b><span>{reviewComparison.nextFocus}</span></footer></> : <p>AI 会结合目标、待办与复盘内容，告诉你这段时间相较{previousName}有哪些进步、变化和需要继续关注的地方。</p>}
                </section>
              </div>; })()}
            </>}
          </section>
        ) : view === "archive" ? (
          <BrandArchivePage profile={brandProfile} history={brandProfileHistory} knowledgeStats={brandKnowledgeStats} readings={readingItems} evolving={brandEvolving} proposal={brandEvolution} onSave={saveBrandProfile} onEvolve={evolveBrandProfile} onDismissProposal={() => setBrandEvolution(null)} />
        ) : view === "followup" ? (
          <FollowUpPage milestones={brandMilestones} readings={readingItems} onUpdate={updateMilestone} onDelete={deleteMilestone} onEditReading={editReading} />
        ) : view === "reading" ? (
          <ReadingTimeline items={readingItems} milestones={brandMilestones} summary={readingSummary} summaryLoading={readingSummaryLoading} onSummarize={() => void summarizeReading()} onAdd={newReading} onEdit={editReading} onDelete={item => void deleteReading(item)} onReanalyze={reanalyzeReading} onConvert={convertReadingToMilestone} onLoadCanvas={loadReadingCanvas} onSaveCanvas={saveReadingCanvas} onConfirm={confirmReading} onImportMedia={importReadingMedia} />
        ) : (
          <section className="review-panel">
            <button className="back-link" onClick={() => setView("overview")}>← 返回复盘总览</button>
            <div className="review-heading"><div><div className="overview-kicker"><small>DAILY REVIEW · 日复一日</small><div className="review-scope" aria-label="复盘周期"><button className="active">日复盘</button><button onClick={() => openReviewOverview("week")}>周复盘</button><button onClick={() => openReviewOverview("month")}>月复盘</button><button onClick={() => openReviewOverview("year")}>年复盘</button></div></div><h1>{selectedMonth} 月 {selectedDay} 日复盘</h1><p>把今天轻轻放下，再带走一点清醒。</p></div><div className="date-card"><b>{selectedDay}</b><span>{selectedDate.toLocaleString("en", { month: "short" }).toUpperCase()} · {selectedYear}</span></div></div>
            <div className="review-layout">
              <div className="journal-card">
                <div className="card-title"><span>01</span><div><b>今天感觉如何？</b><small>选择一个最接近此刻的心情</small></div></div>
                <div className="mood-row">{moods.map(mood => <button key={mood.label} aria-label={mood.label} className={review.mood === mood.label ? "active" : ""} onClick={() => setReview({ ...review, mood: mood.label })}><b>{mood.emoji}</b><small>{mood.label}</small></button>)}</div>
                <div className="energy"><label>今日能量 <b>{review.energy}/5</b></label><input type="range" min="1" max="5" value={review.energy} onChange={e => setReview({ ...review, energy: Number(e.target.value) })} /></div>
                <label className="journal-original"><span><b>日记原文</b><small>JOURNAL</small></span><textarea value={review.text} maxLength={5000} onChange={e => setReview({ ...review, text: e.target.value })} placeholder="把这一天原原本本地写下来…" /></label>
                <div className="quadrant-grid">
                  <label className="quadrant keep"><span><b>保持的</b><small>KEEP</small></span><textarea value={review.keep} onChange={e => setReview({ ...review, keep: e.target.value })} placeholder="今天哪些做法值得继续？" /></label>
                  <label className="quadrant start"><span><b>开始的</b><small>START</small></span><textarea value={review.start} onChange={e => setReview({ ...review, start: e.target.value })} placeholder="明天想开始做什么？" /></label>
                  <label className="quadrant improve"><span><b>改进的</b><small>IMPROVE</small></span><textarea value={review.improve} onChange={e => setReview({ ...review, improve: e.target.value })} placeholder="哪件事可以做得更好？" /></label>
                  <label className="quadrant stop"><span><b>舍弃的</b><small>STOP</small></span><textarea value={review.stop} onChange={e => setReview({ ...review, stop: e.target.value })} placeholder="什么不再值得消耗精力？" /></label>
                </div>
                <div className="review-actions"><button className="secondary-btn" onClick={() => void saveReview()}>保存复盘</button><button className="primary-btn" onClick={() => void runAnalysis()}>✦ AI 帮我分析</button></div>
              </div>
              <aside className="review-side">
                <div className="daily-progress-card"><header><div><small>DAILY PROGRESS</small><h3>今日进步</h3></div><span>{reviews[selectedKey] ? "已复盘" : "待复盘"}</span></header><div><span><b>{selectedTasks.filter(task => task.done).length}</b>完成任务</span><span><b>{selectedReadingCount}</b>知识积累</span><span><b>{review.energy}</b>今日能量</span></div>{reviews[selectedKey]?.progressSummary && <p>{reviews[selectedKey].progressSummary}</p>}</div>
                <div className="task-summary"><small>今日待办</small><h3>{selectedTasks.filter(t => t.done).length} / {selectedTasks.length} 已完成</h3>{selectedTasks.length ? selectedTasks.map(task => <button key={task.id} onClick={() => toggleTask(task.id)} className={task.done ? "done" : ""}><i>{task.done ? "✓" : ""}</i>{task.title}</button>) : <p>今天还没有添加待办。</p>}</div>
                <div className={`ai-card ${analysis ? "ready" : ""}`}><div className="ai-title"><span>✦</span><div><b>Slowday AI</b><small>{analysisSource === "deepseek" ? "DeepSeek 智能分析" : analysisSource === "openai" ? "OpenAI 智能分析" : analysisSource === "custom" ? "自定义模型分析" : "使用你自己的模型 Key"}</small></div></div>{analysis ? <p>{analysis}</p> : <><h3>等你写完，再一起看看</h3><p>AI 会结合今日待办、能量和日记，提炼模式并给出一条可行动的建议。</p><button className="ai-setup-link" onClick={() => void openApiSettings()}>配置我的 AI →</button></>}<small className="privacy">每个账号使用自己的加密 Key</small></div>
              </aside>
            </div>
          </section>
        )}
      </section>

      <nav className="mobile-nav" aria-label="移动端主导航"><button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>首页</button><button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>日历</button><button className={view === "review" || view === "overview" ? "active" : ""} onClick={() => setView("overview")}>复盘</button><button className={view === "reading" ? "active" : ""} onClick={() => setView("reading")}>知识库</button><button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")}>档案</button><button className={view === "followup" ? "active" : ""} onClick={() => setView("followup")}>跟进</button></nav>

      {composer && <div className="modal-backdrop" onMouseDown={() => setComposer(false)}><section className="composer" role="dialog" aria-modal="true" aria-label="新建待办" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={() => setComposer(false)}>×</button><small>NEW TODO</small><h2>为 {selectedMonth} 月 {selectedDay} 日添加待办</h2><label>待办内容<input autoFocus value={taskTitle} onChange={e => setTaskTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && void addTask()} placeholder="例如：把最难的事先干掉" /></label><button className="primary-btn wide composer-submit" onClick={() => void addTask()} disabled={syncState === "saving"}>{syncState === "saving" ? "正在保存…" : "塞进这一天"}</button></section></div>}
      {readingModal && <div className="modal-backdrop" onMouseDown={() => setReadingModal(false)}>
        <section className={`composer collection-composer ${readingEditingId ? "inspiration-edit-composer" : ""}`} role="dialog" aria-modal="true" aria-label="品牌灵感" onMouseDown={e => e.stopPropagation()}>
          <button className="close" onClick={() => setReadingModal(false)}>×</button><small>BRAND INSPIRATION</small><h2>{readingEditingId ? "编辑这条灵感" : "留住这次灵感"}</h2>
          {!readingEditingId && <div className="compact-fields"><label>日期<input type="date" value={readingDraft.date} onChange={e => setReadingDraft({ ...readingDraft, date: e.target.value })} /></label><label>来源<input value={readingDraft.source} maxLength={100} onChange={e => setReadingDraft({ ...readingDraft, source: e.target.value })} placeholder="品牌、作者或网站" /></label></div>}
          <label>标题<input autoFocus value={readingDraft.title} maxLength={200} onChange={e => setReadingDraft({ ...readingDraft, title: e.target.value })} placeholder="什么品牌细节让你停了一下？" /></label>
          <div className="compact-fields knowledge-edit-fields"><label>主分类<select value={readingDraft.primaryCategory} onChange={e => setReadingDraft({ ...readingDraft, primaryCategory: e.target.value })}>{["品牌定位", "视觉系统", "产品设计", "材质工艺", "包装", "摄影", "内容文案", "用户洞察"].map(value => <option key={value}>{value}</option>)}</select></label><label>可能用于<select value={readingDraft.intendedUse} onChange={e => setReadingDraft({ ...readingDraft, intendedUse: e.target.value })}>{["产品开发", "视觉设计", "包装设计", "拍摄计划", "内容选题", "品牌定位", "暂时研究"].map(value => <option key={value}>{value}</option>)}</select></label></div>
          <label>专题 / 系列<input value={readingDraft.topic} maxLength={120} onChange={e => setReadingDraft({ ...readingDraft, topic: e.target.value })} placeholder="例如：黑金首饰系列、2027 春夏产品方向" /></label>
          <label className="tag-editor-label">标签（值得借鉴什么）<small>可以添加多个标签，按回车逐个保存</small><div className="tag-editor">{splitReadingTags(readingDraft.tags).map(tag => <button type="button" key={tag} onClick={() => removeReadingTag(tag)}>{tag}<span>×</span></button>)}<input value={readingTagInput} maxLength={80} onChange={e => setReadingTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" || e.key === "," || e.key === "，") { e.preventDefault(); addReadingTag(); } }} onBlur={() => addReadingTag()} placeholder={splitReadingTags(readingDraft.tags).length ? "继续添加…" : "例如：氛围感"} /></div></label>
          {!readingEditingId && <><label>原文链接<input type="url" value={readingDraft.url} maxLength={500} onChange={e => setReadingDraft({ ...readingDraft, url: e.target.value })} placeholder="https://…（可选）" /></label><label>封面图片链接<input type="url" value={readingDraft.imageUrl} maxLength={1000} onChange={e => setReadingDraft({ ...readingDraft, imageUrl: e.target.value })} placeholder="自动读取，也可以手动替换" /></label></>}
          <label>中文解读<textarea value={readingDraft.note} maxLength={3000} onChange={e => setReadingDraft({ ...readingDraft, note: e.target.value })} placeholder="它展示了什么？哪些品牌表达值得留下？" /></label>
          <button className="primary-btn wide composer-submit" onMouseDown={event => event.preventDefault()} onClick={() => void saveReading()} disabled={syncState === "saving"}>{readingEditingId ? "保存修改" : "存入灵感库"}</button>
        </section>
      </div>}
      {apiModal && <div className="modal-backdrop" onMouseDown={() => setApiModal(false)}><section className="composer api-composer" role="dialog" aria-modal="true" aria-label="AI 与 API 配置" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={() => setApiModal(false)}>×</button><small>PRIVATE CONNECTIONS</small><h2>连接你的 AI 与工具</h2><div className="api-tabs"><button className={apiSection === "ai" ? "active" : ""} onClick={() => setApiSection("ai")}>我的 AI 模型</button><button className={apiSection === "developer" ? "active" : ""} onClick={() => setApiSection("developer")}>Slowday 访问密钥</button></div>{apiSection === "ai" ? <div className="ai-config-form"><p>每个账号独立配置。Key 只在服务端加密保存，生成分析时才发送给你选择的模型服务。</p><label>模型服务<select value={aiProvider} onChange={e => changeAiProvider(e.target.value as AIProvider)}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="custom">其他兼容模型</option></select></label>{aiProvider === "custom" && <label>API Base URL<small>须兼容 OpenAI Chat Completions，例如 https://api.example.com/v1</small><input value={aiBaseUrl} maxLength={240} onChange={e => setAiBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" /></label>}<label>模型名称<input value={aiModel} maxLength={80} onChange={e => setAiModel(e.target.value)} placeholder={aiProvider === "deepseek" ? "deepseek-v4-flash" : aiProvider === "openai" ? "gpt-5.6-luna" : "填写服务商提供的模型 ID"} /></label><label>API Key {aiConfig && <small>已保存 {aiConfig.keyHint}；留空表示不更换</small>}<input type="password" autoComplete="new-password" value={aiApiKey} maxLength={500} onChange={e => setAiApiKey(e.target.value)} placeholder={aiConfig ? "留空保留原 Key" : "粘贴你自己的 API Key"} /></label><button className="primary-btn wide composer-submit" onClick={() => void saveAiConfig()} disabled={aiSaving}>{aiSaving ? "处理中…" : aiConfig ? "保存修改" : "加密保存"}</button>{aiConfig && <div className="ai-config-actions"><button onClick={() => void testAiConfig()} disabled={aiSaving}>测试连接</button><button className="danger-text" onClick={() => void deleteAiConfig()} disabled={aiSaving}>删除配置</button></div>}<div className="security-note"><b>🔒 你的 Key 只属于你</b><span>不会显示给其他用户，也不会出现在数据导出中。自定义接口仅允许 HTTPS 公网地址。</span></div></div> : <div className="developer-key-form"><p>这里生成的是访问你个人 Slowday 数据的密钥，不是模型 Key。只在连接快捷指令、机器人或个人脚本时使用。</p><label>密钥名称<input value={apiKeyName} maxLength={50} onChange={e => setApiKeyName(e.target.value)} onKeyDown={e => e.key === "Enter" && void createKey()} placeholder="例如：Raycast 快捷指令" /></label><button className="primary-btn wide composer-submit" onClick={() => void createKey()}>生成 Slowday Key</button>{newApiToken && <div className="api-token"><small>请立即复制，关闭后无法再次查看</small><code>{newApiToken}</code><button onClick={() => { void navigator.clipboard.writeText(newApiToken); showCheer("已复制到剪贴板。"); }}>复制</button></div>}<div className="api-key-list">{apiKeys.map(key => <div key={key.id} className={key.revokedAt ? "revoked" : ""}><span><b>{key.name}</b><small>{key.tokenPrefix} · {key.revokedAt ? "已撤销" : key.lastUsedAt ? "已使用" : "尚未使用"}</small></span>{!key.revokedAt && <button onClick={() => void revokeKey(key.id)}>撤销</button>}</div>)}</div><div className="api-endpoints"><a href="/api/v1" target="_blank" rel="noreferrer">接口说明</a><a href={`/api/v1/overview?period=month&anchor=${selectedKey}`} target="_blank" rel="noreferrer">统计接口</a><a href={`/api/v1/tasks?from=${selectedKey}&to=${selectedKey}`} target="_blank" rel="noreferrer">任务接口</a></div></div>}</section></div>}
      {accountModal && <div className="modal-backdrop" onMouseDown={() => setAccountModal(false)}><section className="composer account-composer" role="dialog" aria-modal="true" aria-label="账号与数据" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={() => setAccountModal(false)}>×</button><small>MY SLOWDAY</small><h2>{account.displayName} 的品牌资产</h2><p>品牌档案、历史版本、知识库、来源链接、任务与跟进都可以随时带走。</p><div className="archive-export-actions"><a className="primary-btn wide export-link" href="/api/export" download>完整备份 JSON</a><a className="secondary-btn wide export-link" href="/api/export?format=markdown" download>导出 Markdown</a><a className="secondary-btn wide export-link" href="/api/export?format=csv" download>导出知识库表格</a></div><small className="export-note">导出完整保留原文与图片地址，但永远不包含 API Key。建议每月下载一次完整备份。</small><button className="danger-account" onClick={() => void logout()}>退出当前账号</button></section></div>}
      {recoveryKey && <div className="modal-backdrop"><section className="composer recovery-composer" role="dialog" aria-modal="true" aria-label="保存恢复密钥"><small>ONE-TIME RECOVERY KEY</small><h2>先收好你的账号钥匙</h2><p>它只显示这一次。换设备或清除浏览器后，需要它才能回到这份日历。</p><code>{recoveryKey}</code><button className="secondary-btn wide" onClick={() => { void navigator.clipboard.writeText(recoveryKey); showCheer("恢复密钥已复制。"); }}>复制恢复密钥</button><button className="primary-btn wide" onClick={() => setRecoveryKey("")}>我已经安全保存</button></section></div>}
      {deleteTarget && <div className="modal-backdrop delete-backdrop" onMouseDown={() => !deleting && setDeleteTarget(null)}><section className="composer delete-composer" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy" onMouseDown={event => event.stopPropagation()}><span className="delete-bean" aria-hidden="true">●</span><small>GENTLE DELETE</small><h2 id="delete-title">要让它离开这一天吗？</h2><p id="delete-copy">“{deleteTarget.title}”删除后无法恢复，但今天依然可以从容继续。</p><div className="delete-actions"><button className="secondary-btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>再想一下</button><button className="delete-confirm" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? "正在收走…" : "确认删除"}</button></div></section></div>}
      {celebrating && <div className="coffee-confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index}>●</i>)}</div>}
      {cheer && <div className="cheer-toast" role="status" aria-live="polite"><span>☕</span>{cheer}</div>}
      {error && <button className="error-toast" onClick={() => setError("")}><b>操作没有完成</b><span>{error}</span><i>×</i></button>}
    </main>
  );
}
