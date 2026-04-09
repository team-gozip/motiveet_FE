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
          <div className="w-10 h-10 border-3 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--text-secondary)]">요약을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-[var(--highlight-bg)] rounded-2xl flex items-center justify-center mb-2">
          <svg className="w-8 h-8 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[var(--foreground)]">아직 요약이 없습니다</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed">
          회의가 종료되면 녹취록, 채팅 내역, 메모를 바탕으로 AI가 요약을 생성합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 bg-[var(--card-bg)]">
      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-[var(--foreground)] prose-p:text-[var(--foreground)] prose-li:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-a:text-[var(--accent-primary)] hover:prose-a:underline">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {summary}
        </ReactMarkdown>
      </div>
    </div>
  );
}
