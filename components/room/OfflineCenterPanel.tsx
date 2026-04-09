'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { subjectApi } from '@/lib/api';
import { useMeeting } from '@/components/providers/MeetingProvider';

interface Subject {
    subjectId: number;
    meetingId: number;
    chatId: number;
    text: string;
    createdAt: string;
}

interface OfflineCenterPanelProps {
    meetingId: number | null;
    roomName: string;
    isActive: boolean;
}

/**
 * 오프라인 회의실 상단 "추출된 주제" 스트립.
 * - 회의 시작 전: 안내 메시지
 * - 회의 중: 현재 주제 + 제안 태그 (compact 수평 레이아웃)
 * - 10초 폴링 + 오디오 분석 완료 시 즉시 갱신
 */
export default function OfflineCenterPanel({ meetingId, roomName, isActive }: OfflineCenterPanelProps) {
    const { lastAnalysisResult } = useMeeting();

    const [subject, setSubject] = useState<Subject | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const isFetchingRef = useRef(false);

    const fetchSubject = useCallback(async (id: number) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            const res = await subjectApi.getCurrent(id);
            setSubject(res.subject ?? null);
            setSuggestions(prev => {
                const combined = [...new Set([...prev, ...res.suggestions])];
                return combined.slice(0, 6);
            });
        } catch {
            /* 조용히 유지 */
        } finally {
            isFetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (!meetingId) {
            setSubject(null);
            setSuggestions([]);
            clearInterval(pollTimerRef.current);
            return;
        }
        fetchSubject(meetingId);
        pollTimerRef.current = setInterval(() => fetchSubject(meetingId), 10_000);
        return () => clearInterval(pollTimerRef.current);
    }, [meetingId, fetchSubject]);

    useEffect(() => {
        if (!lastAnalysisResult || !meetingId) return;
        if (lastAnalysisResult.newTopics?.length) {
            setSuggestions(prev => {
                const combined = [...new Set([...prev, ...lastAnalysisResult.newTopics])];
                return combined.slice(0, 6);
            });
        }
        fetchSubject(meetingId);
    }, [lastAnalysisResult, meetingId, fetchSubject]);

    // ── 회의 전: 안내 ─────────────────────────────────────────────
    if (!isActive) {
        return (
            <div className="h-14 flex items-center px-5 gap-2">
                <svg className="w-3.5 h-3.5 text-[var(--foreground)] text-[var(--text-tertiary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-[var(--foreground)] text-[var(--text-tertiary)]">
                    회의를 시작하면 AI가 대화를 분석해 주제를 자동 추출합니다
                </span>
            </div>
        );
    }

    // ── 회의 중: 주제 없음 ────────────────────────────────────────
    if (!subject && suggestions.length === 0) {
        return (
            <div className="h-14 flex items-center px-5 gap-2">
                <div className="flex gap-0.5">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                        />
                    ))}
                </div>
                <span className="text-xs text-[var(--foreground)] text-[var(--text-secondary)]">
                    대화를 감지하면 주제를 자동 추출합니다 (약 30초)
                </span>
            </div>
        );
    }

    // ── 회의 중: 주제 표시 ────────────────────────────────────────
    return (
        <div className="h-14 flex items-center px-5 gap-3 overflow-hidden">
            {/* 현재 주제 */}
            {subject && (
                <div className="flex items-center gap-2 flex-shrink-0 max-w-[40%]">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
                    <span className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {subject.text}
                    </span>
                </div>
            )}

            {/* 구분선 */}
            {subject && suggestions.length > 0 && (
                <div className="w-px h-4 bg-[var(--border-color)] flex-shrink-0" />
            )}

            {/* 제안 태그 (수평 스크롤) */}
            {suggestions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0">
                    {suggestions.map((sug, i) => (
                        <span
                            key={`${sug}-${i}`}
                            className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-[var(--border-color)] bg-[var(--highlight-bg)] text-[var(--foreground)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-opacity whitespace-nowrap"
                        >
                            {sug}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
