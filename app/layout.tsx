import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slowday 日历复盘",
  description: "一个把待办、日记与 AI 复盘放在同一张月历里的慢生活效率工具。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
