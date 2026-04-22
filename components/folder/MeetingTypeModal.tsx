'use client';

interface MeetingTypeModalProps {
    onClose: () => void;
    onSelect: (type: 'ONLINE' | 'OFFLINE') => void;
}

export default function MeetingTypeModal({ onClose, onSelect }: MeetingTypeModalProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-lg w-full max-w-md">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">회의 방식 선택</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 space-y-2">
                    <button
                        onClick={() => onSelect('ONLINE')}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-md border border-[var(--border-color)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/5 transition-colors group text-left"
                    >
                        <div className="w-9 h-9 rounded-md bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-[var(--foreground)]">온라인 회의</p>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">화상·음성 연결로 원격 회의를 진행합니다</p>
                        </div>
                        <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    <button
                        onClick={() => onSelect('OFFLINE')}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-md border border-[var(--border-color)] hover:border-[var(--success)]/40 hover:bg-[var(--success)]/5 transition-colors group text-left"
                    >
                        <div className="w-9 h-9 rounded-md bg-[var(--success)]/10 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-[var(--foreground)]">오프라인 회의</p>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">현장 대화를 AI로 녹취·분석합니다</p>
                        </div>
                        <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--success)] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
