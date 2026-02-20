'use client';

import React from 'react';
import Button from '../common/Button';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
}

export default function SummaryModal({ isOpen, onClose, summary }: SummaryModalProps) {
  if (!isOpen) return null;

  // Convert markdown headings to bold for simple display (or use a real library if preferred, 
  // but vanilla CSS/HTML is priority)
  const formattedSummary = summary.split('\n').map((line, i) => {
    if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mb-4 mt-6 text-[var(--foreground)]">{line.replace('# ', '')}</h1>;
    if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mb-3 mt-5 text-[var(--foreground)]">{line.replace('## ', '')}</h2>;
    if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mb-2 mt-4 text-[var(--foreground)]">{line.replace('### ', '')}</h3>;
    if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-2 text-[var(--foreground)] opacity-80">{line.replace('- ', '')}</li>;
    return <p key={i} className="mb-2 text-[var(--foreground)] opacity-80 leading-relaxed">{line}</p>;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--card-bg)] w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl border border-[var(--border-color)] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-[var(--border-color)] bg-[var(--background)] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">회의 요약 보고서</h2>
            <p className="text-xs text-[var(--foreground)] opacity-40 mt-1">회의가 성공적으로 종료되었습니다. 요약된 내용을 확인하세요.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--highlight-bg)] rounded-full transition-colors text-[var(--foreground)] opacity-40 hover:opacity-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="prose prose-invert max-w-none">
            {formattedSummary}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-[var(--border-color)] bg-[var(--background)] flex justify-end space-x-3">
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(summary);
              alert('요약 내용이 클립보드에 복사되었습니다.');
            }}
          >
            클립보드 복사
          </Button>
          <Button
            variant="primary"
            onClick={onClose}
          >
            다시 대시보드로
          </Button>
        </div>
      </div>
    </div>
  );
}
