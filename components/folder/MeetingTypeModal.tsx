'use client';

interface MeetingTypeModalProps {
    onClose: () => void;
    onSelect: (type: 'ONLINE' | 'OFFLINE') => void;
}

export default function MeetingTypeModal({ onClose, onSelect }: MeetingTypeModalProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-[var(--foreground)]">회의 방식 선택</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md text-[var(--foreground)] opacity-40 hover:opacity-100 transition-opacity"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Online */}
                    <button
                        onClick={() => onSelect('ONLINE')}
                        className="group flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-[var(--border-color)] hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-[var(--foreground)] group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                온라인 회의
                            </p>
                            <p className="text-xs text-[var(--foreground)] opacity-40 mt-1">
                                화상·음성 연결
                            </p>
                        </div>
                    </button>

                    {/* Offline */}
                    <button
                        onClick={() => onSelect('OFFLINE')}
                        className="group flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-[var(--border-color)] hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-[var(--foreground)] group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                                오프라인 회의
                            </p>
                            <p className="text-xs text-[var(--foreground)] opacity-40 mt-1">
                                AI 음성 녹취·분석
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
