'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MeetingSummaryProps {
  summary: string | null;
  isLoading?: boolean;
}

export default function MeetingSummary({ summary, isLoading = false }: MeetingSummaryProps) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[var(--foreground)] opacity-60">요약을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-[var(--highlight-bg)] rounded-full flex items-center justify-center mb-2">
          <svg className="w-8 h-8 text-[var(--foreground)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[var(--foreground)]">아직 요약이 없습니다</h3>
        <p className="text-[var(--foreground)] opacity-60 max-w-sm">
          회의가 종료되면 녹취록, 채팅 내역, 메모를 바탕으로 AI가 요약을 생성합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 custom-scrollbar bg-[var(--card-bg)]">
      <div className="prose prose-invert max-w-none prose-headings:text-[var(--foreground)] prose-p:text-[var(--foreground)] prose-p:opacity-80 prose-li:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-a:text-indigo-400 hover:prose-a:text-indigo-300">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {summary}
        </ReactMarkdown>
      </div>
    </div>
  );
}
