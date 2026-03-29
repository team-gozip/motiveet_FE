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

    useEffect(() => {
        if (isThisRecording) {
            setElapsedSecs(0);
            timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isThisRecording]);

    const handleStart = async () => {
        setIsModalOpen(false);
        const title = meetingTitle.trim() || '새로운 회의';
        setIsLoading(true);
        try {
            const resp = await meetingApi.start(title);
            if (resp.success) {
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
                endGlobalMeeting();
                onMeetingEnd(resp.summary);
            }
        } catch (e) {
            console.error('Failed to end meeting:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // Volume bars (9 bars, symmetric)
    const barMultipliers = [0.4, 0.6, 0.9, 1.2, 1.5, 1.2, 0.9, 0.6, 0.4];

    return (
        <>
            <div className="flex-shrink-0 h-16 bg-[var(--card-bg)] border-t border-[var(--border-color)] flex items-center px-6 gap-6">
                {/* Left: Mic + Waveform + Status */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Mic icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center relative ${
                        isActive ? 'bg-red-50 dark:bg-red-950/20' : 'bg-[var(--highlight-bg)]'
                    }`}>
                        <svg
                            className={`w-4 h-4 ${isActive ? 'text-red-500' : 'text-[var(--foreground)] opacity-30'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        {isActive && isThisRecording && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                    </div>

                    {/* Waveform */}
                    <div className="flex items-center gap-0.5 h-6">
                        {barMultipliers.map((mult, i) => {
                            const activeHeight = Math.max(3, Math.min(22, (volume * mult) / 5));
                            const h = isThisRecording && volume > 5 ? activeHeight : 3;
                            const color = volume > 80
                                ? '#ef4444'
                                : isThisRecording && volume > 5
                                    ? '#6366f1'
                                    : 'var(--border-color)';
                            return (
                                <div
                                    key={i}
                                    className="w-1 rounded-full transition-all duration-75"
                                    style={{ height: `${h}px`, backgroundColor: color }}
                                />
                            );
                        })}
                    </div>

                    <span className={`text-xs font-medium ${
                        isActive
                            ? isThisRecording ? 'text-red-500' : 'text-emerald-500'
                            : 'text-[var(--foreground)] opacity-30'
                    }`}>
                        {isActive
                            ? isThisRecording ? '녹음 중' : '회의 중'
                            : '대기'}
                    </span>
                </div>

                {/* Center: Timer */}
                <div className="flex-shrink-0 min-w-[80px] text-center">
                    {isThisRecording ? (
                        <span className="text-xl font-mono font-bold text-[var(--foreground)] tabular-nums">
                            {formatTime(elapsedSecs)}
                        </span>
                    ) : isActive ? (
                        <span className="text-sm text-[var(--foreground)] opacity-30 font-medium">
                            {meetingId ? `#${meetingId}` : '—'}
                        </span>
                    ) : null}
                </div>

                {/* Right: Action button */}
                <div className="flex-1 flex justify-end">
                    {!isActive ? (
                        <button
                            onClick={() => { setMeetingTitle('새로운 회의'); setIsModalOpen(true); }}
                            disabled={isLoading}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-indigo-500/20"
                        >
                            {isLoading ? '...' : '회의 시작'}
                        </button>
                    ) : (
                        <button
                            onClick={handleEnd}
                            disabled={isLoading}
                            className="px-5 py-2 text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {isLoading ? '...' : '회의 종료'}
                        </button>
                    )}
                </div>
            </div>

            {/* Start Meeting Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
                        <h3 className="text-base font-bold text-[var(--foreground)] mb-1">새 회의 시작</h3>
                        <p className="text-xs text-[var(--foreground)] opacity-50 mb-4">
                            회의 이름을 입력해주세요
                        </p>
                        <input
                            type="text"
                            value={meetingTitle}
                            onChange={(e) => setMeetingTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                            className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mb-4 placeholder-[var(--foreground)] placeholder-opacity-20"
                            placeholder="예: 주간 팀 미팅"
                            autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm text-[var(--foreground)] opacity-50 hover:opacity-100 transition-opacity"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleStart}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
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
