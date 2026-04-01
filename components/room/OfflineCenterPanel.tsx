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
    /** 회의 활성 여부 */
    isActive: boolean;
}

/**
 * 오프라인 회의실 중앙 패널.
 *
 * - 회의 시작 전: 대기 안내 화면
 * - 회의 중: AI가 추출한 현재 주제 + 제안 주제 태그
 * - 폴링: 10초마다 getCurrent 호출, meetingId가 null이면 즉시 중지
 * - lastAnalysisResult(오디오 업로드 완료) 변경 시 즉시 갱신
 */
export default function OfflineCenterPanel({ meetingId, roomName, isActive }: OfflineCenterPanelProps) {
    const { lastAnalysisResult } = useMeeting();

    const [subject, setSubject] = useState<Subject | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSubject, setIsLoadingSubject] = useState(false);

    const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const isFetchingRef = useRef(false);

    const fetchSubject = useCallback(async (id: number) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            const res = await subjectApi.getCurrent(id);
            setSubject(res.subject ?? null);
            // suggestions: 중복 제거 후 최대 8개
            setSuggestions(prev => {
                const combined = [...new Set([...prev, ...res.suggestions])];
                return combined.slice(0, 8);
            });
        } catch (err) {
            // 404 등 → 조용히 유지 (기존 subject 그대로)
            console.warn('[SubjectPoll] getCurrent failed:', err);
        } finally {
            isFetchingRef.current = false;
        }
    }, []);

    // 폴링 설정/해제
    useEffect(() => {
        if (!meetingId) {
            // 회의 없음 → 상태 초기화 + 폴링 중지
            setSubject(null);
            setSuggestions([]);
            clearInterval(pollTimerRef.current);
            console.warn('[SubjectPoll] stopped: meetingId=null');
            return;
        }

        // 회의 시작 시 첫 로드
        setIsLoadingSubject(true);
        fetchSubject(meetingId).finally(() => setIsLoadingSubject(false));

        // 10초 폴링
        pollTimerRef.current = setInterval(() => fetchSubject(meetingId), 10_000);

        return () => {
            clearInterval(pollTimerRef.current);
        };
    }, [meetingId, fetchSubject]);

    // 오디오 업로드 완료 시 즉시 갱신 (폴링 주기 기다리지 않음)
    useEffect(() => {
        if (!lastAnalysisResult || !meetingId) return;
        // newTopics가 있으면 suggestions에 즉시 반영
        if (lastAnalysisResult.newTopics?.length) {
            setSuggestions(prev => {
                const combined = [...new Set([...prev, ...lastAnalysisResult.newTopics])];
                return combined.slice(0, 8);
            });
        }
        // 최신 subject도 갱신
        fetchSubject(meetingId);
    }, [lastAnalysisResult, meetingId, fetchSubject]);

    // ── 회의 시작 전 ─────────────────────────────────────────────
    if (!isActive) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center space-y-4 max-w-sm">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-[var(--highlight-bg)]">
                        <svg className="w-8 h-8 text-[var(--foreground)] opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">오프라인 회의실</p>
                        <p className="text-xs text-[var(--foreground)] opacity-40 mt-1">
                            하단의 <span className="font-semibold">회의 시작</span> 버튼을 누르면<br />AI가 대화를 분석해 주제를 자동 추출합니다
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── 회의 중: 첫 로드 스피너 ─────────────────────────────────
    if (isLoadingSubject) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <div className="mx-auto w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                    <p className="text-xs text-[var(--foreground)] opacity-40">AI 주제 분석 중...</p>
                </div>
            </div>
        );
    }

    // ── 회의 중: 주제 없음 ───────────────────────────────────────
    if (!subject && suggestions.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center space-y-3 max-w-xs">
                    <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/20">
                        <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">회의 녹음 중</p>
                        <p className="text-xs text-[var(--foreground)] opacity-40 mt-1">
                            대화가 감지되면 AI가 주제를 자동으로 추출합니다<br />
                            <span className="opacity-60">(약 30초마다 분석)</span>
                        </p>
                    </div>
                    <div className="flex justify-center gap-1">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── 회의 중: 주제 표시 ───────────────────────────────────────
    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* 현재 주제 카드 */}
            {subject && (
                <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10">
                    {/* 카드 헤더 */}
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-indigo-700 dark:to-indigo-600 px-5 py-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                            {roomName || '오프라인 회의'} · 현재 주제
                        </span>
                    </div>
                    {/* 주제 텍스트 */}
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 px-5 py-5">
                        <p className="text-xl font-bold text-white leading-snug">{subject.text}</p>
                    </div>
                </div>
            )}

            {/* AI 추출 주제 제안 */}
            {suggestions.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)] opacity-30">
                            AI 추출 주제
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {suggestions.map((sug, i) => (
                            <span
                                key={`${sug}-${i}`}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border-color)] bg-[var(--highlight-bg)] text-[var(--foreground)] opacity-80 transition-opacity hover:opacity-100"
                            >
                                {sug}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* 하단 여백 */}
            <div className="h-4" />
        </div>
    );
}
