"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandProfile, BrandProfileVersion, ReadingItem } from "./collection-panels";

export type BrandEvolutionProposal = BrandProfile & { changeNote: string; evidenceIds: number[] };
export type BrandKnowledgeStats = { total: number; newSinceVersion: number };

type Props = {
  profile: BrandProfile;
  history: BrandProfileVersion[];
  knowledgeStats: BrandKnowledgeStats;
  readings: ReadingItem[];
  evolving: boolean;
  proposal: BrandEvolutionProposal | null;
  onSave: (profile: BrandProfile) => Promise<void>;
  onEvolve: () => Promise<void>;
  onDismissProposal: () => void;
};

const profileFields = [
  ["philosophy", "核心理念", "品牌始终相信什么"],
  ["audience", "目标用户", "品牌真正为谁服务"],
  ["keywords", "品牌关键词", "能够约束表达的核心词"],
  ["productDirection", "产品方向", "重点产品、场景与价格方向"],
  ["visualLanguage", "视觉语言", "色彩、材质、比例、摄影与叙事"],
  ["annualGoal", "年度目标", "今年最重要的品牌结果"],
] as const;

const extendedFields = [
  ["story", "品牌故事", "品牌为什么存在，它从哪里来"],
  ["differentiation", "差异化特点", "用户为什么选择你，而不是别人"],
] as const;

const archiveBranches = [
  ["story", "品牌故事", "起源与初心", "品牌为什么存在，它从哪里来"],
  ["philosophy", "核心理念", "长期原则", "品牌始终相信什么"],
  ["audience", "目标用户", "市场与人群", "品牌真正为谁服务"],
  ["keywords", "品牌关键词", "表达边界", "能够约束表达的核心词"],
  ["differentiation", "差异化特点", "竞争优势", "用户为什么选择你，而不是别人"],
  ["productDirection", "产品方向", "产品与商业", "重点产品、场景与价格方向"],
  ["visualLanguage", "视觉语言", "审美系统", "色彩、材质、比例、摄影与叙事"],
  ["annualGoal", "年度目标", "行动结果", "今年最重要的品牌结果"],
] as const;

type ArchiveBranchKey = typeof archiveBranches[number][0];

export function BrandArchivePage({ profile, history, knowledgeStats, readings, evolving, proposal, onSave, onEvolve, onDismissProposal }: Props) {
  const [editingField, setEditingField] = useState<ArchiveBranchKey | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [branchDraft, setBranchDraft] = useState("");
  const [branchTitleDraft, setBranchTitleDraft] = useState("");
  const autoEvolutionKey = useRef("");

  useEffect(() => {
    const key = `${profile.version}:${knowledgeStats.newSinceVersion}`;
    if (!profile.version || !knowledgeStats.newSinceVersion || proposal || evolving || autoEvolutionKey.current === key) return;
    autoEvolutionKey.current = key;
    void onEvolve();
  }, [profile.version, knowledgeStats.newSinceVersion, proposal, evolving, onEvolve]);

  const evidence = proposal ? readings.filter(item => proposal.evidenceIds.includes(item.id)) : [];
  const changedFields = proposal ? [...profileFields, ...extendedFields].filter(([key]) => proposal[key] !== profile[key]) : [];

  function openBranch(key: ArchiveBranchKey) {
    const branch = archiveBranches.find(([branchKey]) => branchKey === key)!;
    setBranchDraft(profile[key]);
    setBranchTitleDraft(profile.branchLabels?.[key] || branch[1]);
    setEditingField(key);
  }

  async function saveBranch() {
    if (!editingField) return;
    const branch = archiveBranches.find(([key]) => key === editingField)!;
    await onSave({ ...profile, [editingField]: branchDraft.trim(), branchLabels: { ...profile.branchLabels, [editingField]: branchTitleDraft.trim() || branch[1] } });
    setEditingField(null);
  }

  async function acceptProposal() {
    if (!proposal) return;
    await onSave({ ...proposal, branchLabels: profile.branchLabels });
    onDismissProposal();
  }

  return <section className="brand-archive-page">
    <header className="brand-archive-hero">
      <div><small>BRAND ARCHIVE · v{profile.version || 0}</small><h1>品牌档案</h1><p>品牌判断的长期基准，也会随知识库持续更新。</p></div>
      <div className="archive-actions"><button onClick={() => setHistoryOpen(value => !value)}>历史迭代记录 {history.length}</button><button className="archive-edit-button" onClick={() => openBranch(archiveBranches.find(([key]) => !profile[key])?.[0] || "story")} aria-label="编辑自定义卡片" title="编辑自定义卡片">✎</button></div>
    </header>

    <section className="archive-evolution-status">
      <span><b>{knowledgeStats.total}</b> 条品牌知识</span>
      <span><b>v{profile.version || 0}</b> 当前档案</span>
      <span className={knowledgeStats.newSinceVersion ? "has-new" : ""}><b>{knowledgeStats.newSinceVersion}</b> 条新资料待吸收</span>
      <button onClick={() => void onEvolve()} disabled={evolving || !profile.version || !knowledgeStats.total}>{evolving ? "AI 正在梳理新信号…" : "✦ 根据知识库迭代"}</button>
    </section>

    <section className="archive-branch-directory" aria-label="品牌档案分支">
      <header><div><small>BRAND BRANCHES</small><h2>档案分支</h2></div><p>{archiveBranches.filter(([key]) => profile[key].trim()).length} / {archiveBranches.length} 已完善</p></header>
      <div>{archiveBranches.map(([key, label, , placeholder]) => { const customLabel = profile.branchLabels?.[key] || label; return <button type="button" className={profile[key].trim() ? "complete" : "empty"} key={key} onClick={() => openBranch(key)} aria-label={`编辑${customLabel}`}>
        <span className="archive-branch-copy"><b>{customLabel}</b><em>{profile[key] || placeholder}</em></span>
        <span className="archive-branch-action">↗</span>
      </button>; })}</div>
    </section>

    {(evolving || proposal) && <section className="archive-proposal">
      <header><div><small>EVOLUTION PROPOSAL · 档案迭代建议</small><h2>{evolving ? "正在从知识库寻找稳定信号" : `建议升级为 v${profile.version + 1}`}</h2></div>{proposal && <button onClick={onDismissProposal}>暂不采用</button>}</header>
      {evolving ? <div className="archive-thinking"><i /><span>AI 正在区分偶然收藏与真正稳定的品牌方向…</span></div> : proposal && <>
        <p className="proposal-note">{proposal.changeNote}</p>
        <div className="proposal-changes">{changedFields.length ? changedFields.map(([key, label]) => <article key={key}><small>{label}</small><div><del>{profile[key] || "尚未定义"}</del><span>→</span><b>{proposal[key] || "暂不定义"}</b></div></article>) : <p>这批资料没有形成足够稳定的新信号，当前档案可以继续使用。</p>}</div>
        {evidence.length > 0 && <div className="proposal-evidence"><small>本次参考</small>{evidence.map(item => <span key={item.id}>#{item.id} {item.title}</span>)}</div>}
        {changedFields.length > 0 && <button className="proposal-accept" onClick={() => void acceptProposal()}>确认并保存为 v{profile.version + 1}</button>}
      </>}
    </section>}

    {historyOpen && <section className="archive-history-panel"><header><div><small>VERSION HISTORY</small><h2>历史迭代记录</h2><p>系统会自动检测每次提交的变化，并保留当时提交的完整内容。</p></div><button onClick={() => setHistoryOpen(false)}>×</button></header>{history.length ? <div>{history.map((version, index) => {
      const older = history[index + 1]?.snapshot;
      const changes = archiveBranches.filter(([key, label]) => (version.snapshot[key] || "").trim() !== (older?.[key] || "").trim() || (version.snapshot.branchLabels?.[key] || label) !== (older?.branchLabels?.[key] || label));
      return <article key={version.id}><header><b>v{version.version}</b><time>{new Date(version.createdAt).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" })}</time></header><p>{version.changeNote || "系统检测到品牌档案已更新"}</p><details><summary>查看本次提交资料 · {changes.length} 个分支</summary><div className="archive-version-materials">{changes.length ? changes.map(([key, label]) => <section key={key}><b>{version.snapshot.branchLabels?.[key] || label}</b><p>{version.snapshot[key] || "已清空"}</p></section>) : <span>本次保存未检测到文字变化。</span>}</div></details></article>;
    })}</div> : <p>保存第一版之后，每一次更新都会自动留在这里。</p>}</section>}

    {editingField && (() => {
      const branch = archiveBranches.find(([key]) => key === editingField)!;
      return <div className="modal-backdrop" onMouseDown={() => setEditingField(null)}><section className="composer brand-branch-editor" role="dialog" aria-modal="true" aria-label={`编辑${branchTitleDraft || branch[1]}`} onMouseDown={event => event.stopPropagation()}><button className="close" onClick={() => setEditingField(null)}>×</button><small>{branch[2]} · BRAND BRANCH</small><h2>编辑自定义卡片</h2><p>标题分类和内容都可以修改。系统会自动识别本次变化并写入历史迭代记录。</p><label><span>卡片标题</span><input autoFocus value={branchTitleDraft} maxLength={30} onChange={event => setBranchTitleDraft(event.target.value)} placeholder={branch[1]} /></label><label><span>卡片内容</span><textarea value={branchDraft} onChange={event => setBranchDraft(event.target.value)} placeholder={branch[3]} /></label><button className="primary-btn wide" onClick={() => void saveBranch()}>保存这张卡片 · v{profile.version + 1}</button></section></div>;
    })()}
  </section>;
}
