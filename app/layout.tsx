import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motiveet",
  description: "실시간 AI 회의 어시스턴트 — 주제 감지, 자동 요약, 인터랙티브 채팅",
};

import { ThemeProvider } from "@/components/common/ThemeProvider";
import { MeetingProvider } from "@/components/providers/MeetingProvider";
import { FolderProvider } from "@/components/providers/FolderProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <ThemeProvider>
          <FolderProvider>
            <MeetingProvider>
              {children}
            </MeetingProvider>
          </FolderProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
