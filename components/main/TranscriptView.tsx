'use client';

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface TranscriptSegment {
    id: number;
    text: string;
    time: Date;
}

interface TranscriptViewProps {
    segments: TranscriptSegment[];
    isRecording: boolean;
    currentMeeting: any;
}

const toTimeStr = (d: Date) =>
    d.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul',
    });

export default function TranscriptView({ segments, isRecording, currentMeeting }: TranscriptViewProps) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [segments]);

    // No meeting selected
    if (!currentMeeting) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 select-none">
                <div className="w-20 h-20 rounded-full bg-[var(--highlight-bg)] flex items-center justify-center mb-5">
                    <svg className="w-10 h-10 text-[var(--foreground)] opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </div>
                <p className="text-sm font-medium text-[var(--foreground)] opacity-40 mb-1">회의를 시작해 보세요</p>
                <p className="text-xs text-[var(--foreground)] opacity-25 leading-relaxed">
                    아래 버튼을 눌러 새 회의를 시작하거나<br />왼쪽에서 이전 기록을 선택하세요
                </p>
            </div>
        );
    }

    const isEnded = !!currentMeeting.endedAt;

    // Ended meeting with summary — show summary
    if (isEnded && currentMeeting.summary) {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-8 py-8">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            AI 회의 요약
                        </span>
                    </div>
                    <div className="prose dark:prose-invert max-w-none markdown-preview text-[var(--foreground)]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentMeeting.summary}</ReactMarkdown>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-8 py-6 space-y-3">
                {/* Empty state */}
                {segments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        {isRecording ? (
                            <div className="space-y-4">
                                <div className="flex items-end justify-center gap-1 h-8">
                                    {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((h, i) => (
                                        <div
                                            key={i}
                                            className="w-1 bg-indigo-400 rounded-full opacity-70"
                                            style={{
                                                height: `${h * 5}px`,
                                                animation: `pulse 1.2s ease-in-out ${i * 0.08}s infinite alternate`,
                                            }}
                                        />
                                    ))}
                                </div>
                                <p className="text-sm text-[var(--foreground)] opacity-50">대화를 분석 중입니다</p>
                                <p className="text-xs text-[var(--foreground)] opacity-25">30초마다 자동으로 분석됩니다</p>
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--foreground)] opacity-30">
                                {isEnded ? '이 회의에는 저장된 분석 내용이 없습니다.' : '녹음을 시작하면 내용이 표시됩니다.'}
                            </p>
                        )}
                    </div>
                )}

                {/* Transcript segments */}
                {segments.map((seg) => (
                    <div key={seg.id} className="flex gap-4 items-start group">
                        <span className="flex-shrink-0 text-[11px] text-[var(--foreground)] opacity-25 font-mono mt-2.5 w-20 text-right tabular-nums">
                            {toTimeStr(seg.time)}
                        </span>
                        <div className="flex-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
                            <p className="text-[13px] text-[var(--foreground)] leading-relaxed">{seg.text}</p>
                        </div>
                    </div>
                ))}

                {/* Live indicator at bottom when recording */}
                {isRecording && segments.length > 0 && (
                    <div className="flex gap-4 items-start">
                        <span className="flex-shrink-0 w-20" />
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl">
                            <div className="flex gap-0.5 items-end h-3">
                                {[1, 2, 3].map(i => (
                                    <div
                                        key={i}
                                        className="w-1 bg-indigo-400 rounded-full"
                                        style={{
                                            height: `${i * 4}px`,
                                            animation: `pulse 1s ease-in-out ${i * 0.15}s infinite`,
                                        }}
                                    />
                                ))}
                            </div>
                            <span className="text-xs text-[var(--foreground)] opacity-40">분석 대기 중</span>
                        </div>
                    </div>
                )}

                {isEnded && !currentMeeting.summary && (
                    <div className="text-center py-8">
                        <p className="text-sm text-[var(--foreground)] opacity-30">회의가 종료되었습니다.</p>
                    </div>
                )}

                <div ref={endRef} />
            </div>
        </div>
    );
}
