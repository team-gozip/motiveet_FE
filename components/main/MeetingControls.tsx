'use client';

import { useState, useEffect, useRef } from 'react';
import { meetingApi } from '@/lib/api';
import { useMeeting } from '@/components/providers/MeetingProvider';

const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

interface MeetingControlsProps {
    isActive: boolean;
    meetingId: number | null;
    onMeetingStart: (meetingId: number, chatId: number) => void;
    onMeetingEnd: (summary?: string) => void;
    onSubjectUpdate?: (subject: any) => void;
    memo?: string;
}

export default function MeetingControls({
    isActive,
    meetingId,
    onMeetingStart,
    onMeetingEnd,
    memo,
}: MeetingControlsProps) {
    const { startGlobalMeeting, endGlobalMeeting, volume, activeMeetingId, isRecording } = useMeeting();
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [meetingTitle, setMeetingTitle] = useState('새로운 회의');
    const [elapsedSecs, setElapsedSecs] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const isThisRecording = isRecording && activeMeetingId === meetingId;
    const elapsedStorageKey = meetingId ? `motiveet:meeting:${meetingId}:elapsedSecs` : null;

    useEffect(() => {
        if (!elapsedStorageKey) { setElapsedSecs(0); return; }
        try {
            const saved = localStorage.getItem(elapsedStorageKey);
            setElapsedSecs(saved ? Math.max(0, parseInt(saved, 10) || 0) : 0);
        } catch { setElapsedSecs(0); }
    }, [elapsedStorageKey]);

    useEffect(() => {
        if (!isThisRecording) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        timerRef.current = setInterval(() => {
            setElapsedSecs(s => {
                const next = s + 1;
                if (elapsedStorageKey) {
                    try { localStorage.setItem(elapsedStorageKey, String(next)); } catch { /* ignore */ }
                }
                return next;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isThisRecording, elapsedStorageKey]);

    const handleStart = async () => {
        setIsModalOpen(false);
        const title = meetingTitle.trim() || '새로운 회의';
        setIsLoading(true);
        try {
            const resp = await meetingApi.start(title);
            if (resp.success) {
                try { localStorage.removeItem(`motiveet:meeting:${resp.meetingId}:elapsedSecs`); } catch { /* ignore */ }
                setElapsedSecs(0);
                onMeetingStart(resp.meetingId, resp.chatId);
                await startGlobalMeeting(resp.meetingId, resp.chatId);
            }
        } catch (e) {
            console.error('Failed to start meeting:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEnd = async () => {
        if (!meetingId || !window.confirm('회의를 종료하시겠습니까?')) return;
        setIsLoading(true);
        try {
            const resp = await meetingApi.end(meetingId, memo);
            if (resp.success) {
                try { localStorage.removeItem(`motiveet:meeting:${meetingId}:elapsedSecs`); } catch { /* ignore */ }
                endGlobalMeeting();
                onMeetingEnd(resp.summary);
            }
        } catch (e) {
            console.error('Failed to end meeting:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const barMultipliers = [0.4, 0.6, 0.9, 1.2, 1.5, 1.2, 0.9, 0.6, 0.4];

    return (
        <>
            <div className="flex-shrink-0 h-14 bg-[var(--card-bg)] border-t border-[var(--border-color)] flex items-center px-6 gap-6">
                {/* Left: Status + Waveform */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            isThisRecording
                                ? 'bg-[var(--danger)] animate-pulse'
                                : isActive
                                    ? 'bg-[var(--success)]'
                                    : 'bg-[var(--text-tertiary)]/40'
                        }`} />
                        <span className={`text-[11px] font-medium ${
                            isThisRecording
                                ? 'text-[var(--danger)]'
                                : isActive
                                    ? 'text-[var(--success)]'
                                    : 'text-[var(--text-tertiary)]'
                        }`}>
                            {isThisRecording ? '녹음 중' : isActive ? '회의 중' : '대기'}
                        </span>
                    </div>

                    <div className="flex items-center gap-0.5 h-5">
                        {barMultipliers.map((mult, i) => {
                            const activeHeight = Math.max(3, Math.min(18, (volume * mult) / 6));
                            const h = isThisRecording && volume > 5 ? activeHeight : 3;
                            const color = volume > 80
                                ? 'var(--danger)'
                                : isThisRecording && volume > 5
                                    ? 'var(--accent-primary)'
                                    : 'var(--border-color)';
                            return (
                                <div
                                    key={i}
                                    className="w-0.5 rounded-full transition-all duration-75"
                                    style={{ height: `${h}px`, backgroundColor: color }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Center: Timer */}
                <div className="flex-shrink-0 text-center">
                    {isThisRecording ? (
                        <span className="text-lg font-mono font-semibold text-[var(--foreground)] tabular-nums">
                            {formatTime(elapsedSecs)}
                        </span>
                    ) : isActive ? (
                        <span className="text-xs text-[var(--text-tertiary)] font-mono">
                            {meetingId ? `#${meetingId}` : '—'}
                        </span>
                    ) : null}
                </div>

                {/* Right: Action */}
                <div className="flex-1 flex justify-end">
                    {!isActive ? (
                        <button
                            onClick={() => { setMeetingTitle('새로운 회의'); setIsModalOpen(true); }}
                            disabled={isLoading}
                            className="h-9 px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-md text-sm font-medium transition-colors"
                        >
                            {isLoading ? '시작 중...' : '회의 시작'}
                        </button>
                    ) : (
                        <button
                            onClick={handleEnd}
                            disabled={isLoading}
                            className="h-9 px-4 border border-[var(--border-color)] text-[var(--danger)] hover:bg-[var(--danger)]/5 hover:border-[var(--danger)]/30 disabled:opacity-40 rounded-md text-sm font-medium transition-colors"
                        >
                            {isLoading ? '종료 중...' : '회의 종료'}
                        </button>
                    )}
                </div>
            </div>

            {/* Start Meeting Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
                    onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
                >
                    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-lg w-full max-w-sm">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                            <h3 className="text-sm font-semibold text-[var(--foreground)]">새 회의 시작</h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-5 py-5 space-y-1.5">
                            <label className="text-xs font-medium text-[var(--text-secondary)]">회의 제목</label>
                            <input
                                type="text"
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                                className="w-full h-10 px-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all"
                                placeholder="예: 주간 팀 미팅"
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[var(--highlight-bg)] border-t border-[var(--border-color)] rounded-b-xl">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="h-8 px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleStart}
                                className="h-8 px-3.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium transition-colors"
                            >
                                시작
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
