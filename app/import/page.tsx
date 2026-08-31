"use client";

import { useState } from "react";

type JournalEntry = { date: string; text: string };

export default function ImportJournalsPage() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function importJournals() {
    setLoading(true);
    setStatus("");
    try {
      const entries = JSON.parse(value) as JournalEntry[];
      if (!Array.isArray(entries) || entries.length === 0) throw new Error("请粘贴非空的日记数组");

      let imported = 0;
      let skipped = 0;
      for (let index = 0; index < entries.length; index += 25) {
        const response = await fetch("/api/import/journals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: entries.slice(index, index + 25) }),
        });
        const result = (await response.json()) as { imported?: number; skipped?: number; error?: string };
        if (!response.ok) throw new Error(result.error || "导入失败");
        imported += result.imported || 0;
        skipped += result.skipped || 0;
      }
      setStatus(`导入完成：新增 ${imported} 篇，跳过 ${skipped} 篇。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "导入失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="import-page">
      <section className="import-card">
        <p className="eyebrow">JOURNAL IMPORT</p>
        <h1>批量导入日记</h1>
        <p>粘贴日期与日记原文组成的 JSON 数组。已有日记原文的日期会自动跳过，不会覆盖。</p>
        <textarea
          aria-label="日记 JSON"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={'[{"date":"2026-04-02","text":"今天……"}]'}
          spellCheck={false}
        />
        <button className="primary-btn" type="button" onClick={importJournals} disabled={loading}>
          {loading ? "正在导入…" : "开始导入"}
        </button>
        <p className="import-status" role="status">{status}</p>
      </section>
    </main>
  );
}
