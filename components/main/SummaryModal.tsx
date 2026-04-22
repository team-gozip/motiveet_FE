'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: string;
}

export default function SummaryModal({ isOpen, onClose, summary }: SummaryModalProps) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* ignore */
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center h-5 px-2 text-[10px] font-semibold rounded text-[var(--success)] bg-[var(--success)]/10 uppercase tracking-wider">
                            AI 요약
                        </span>
                        <h2 className="text-sm font-semibold text-[var(--foreground)]">회의 요약 보고서</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 prose dark:prose-invert max-w-none markdown-preview text-[var(--foreground)]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-[var(--highlight-bg)] border-t border-[var(--border-color)] rounded-b-xl">
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                        회의가 성공적으로 종료되었습니다
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCopy}
                            className="h-8 px-3 border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--foreground)] rounded-md text-sm font-medium transition-colors"
                        >
                            {copied ? '복사됨' : '클립보드 복사'}
                        </button>
                        <button
                            onClick={onClose}
                            className="h-8 px-3.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium transition-colors"
                        >
                            확인
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
