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

    if (!currentMeeting) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 select-none">
                <div className="w-14 h-14 rounded-full bg-[var(--highlight-bg)] flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </div>
                <p className="text-sm font-medium text-[var(--foreground)] mb-1">회의를 선택하거나 시작하세요</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    왼쪽에서 이전 기록을 선택하거나,<br />아래 버튼으로 새 회의를 시작할 수 있습니다.
                </p>
            </div>
        );
    }

    const isEnded = !!currentMeeting.endedAt;

    if (isEnded && currentMeeting.summary) {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-8 py-10">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[var(--border-color)]">
                        <span className="inline-flex items-center h-5 px-2 text-[10px] font-semibold rounded text-[var(--success)] bg-[var(--success)]/10 uppercase tracking-wider">
                            AI 요약
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)]">회의 종료 후 자동 생성됨</span>
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
            <div className="max-w-2xl mx-auto px-8 py-6 space-y-2">
                {segments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        {isRecording ? (
                            <>
                                <div className="flex items-end justify-center gap-1 h-8 mb-4">
                                    {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((h, i) => (
                                        <div
                                            key={i}
                                            className="w-1 bg-[var(--accent-primary)] rounded-full opacity-70"
                                            style={{
                                                height: `${h * 5}px`,
                                                animation: `pulse 1.2s ease-in-out ${i * 0.08}s infinite alternate`,
                                            }}
                                        />
                                    ))}
                                </div>
                                <p className="text-sm text-[var(--foreground)] mb-1">대화를 분석 중입니다</p>
                                <p className="text-xs text-[var(--text-tertiary)]">30초마다 자동으로 분석됩니다</p>
                            </>
                        ) : (
                            <p className="text-sm text-[var(--text-tertiary)]">
                                {isEnded ? '저장된 분석 내용이 없습니다.' : '녹음을 시작하면 내용이 표시됩니다.'}
                            </p>
                        )}
                    </div>
                )}

                {segments.map((seg) => (
                    <div key={seg.id} className="flex gap-4 items-start group py-1">
                        <span className="flex-shrink-0 text-[11px] text-[var(--text-tertiary)] font-mono mt-1 w-14 tabular-nums">
                            {toTimeStr(seg.time)}
                        </span>
                        <div className="flex-1 text-[14px] text-[var(--foreground)] leading-[1.7]">
                            {seg.text}
                        </div>
                    </div>
                ))}

                {isRecording && segments.length > 0 && (
                    <div className="flex gap-4 items-center py-1">
                        <span className="flex-shrink-0 w-14" />
                        <div className="flex items-center gap-2">
                            <div className="flex gap-0.5 items-end h-3">
                                {[1, 2, 3].map(i => (
                                    <div
                                        key={i}
                                        className="w-1 bg-[var(--accent-primary)] rounded-full"
                                        style={{
                                            height: `${i * 4}px`,
                                            animation: `pulse 1s ease-in-out ${i * 0.15}s infinite`,
                                        }}
                                    />
                                ))}
                            </div>
                            <span className="text-xs text-[var(--text-tertiary)]">분석 대기 중</span>
                        </div>
                    </div>
                )}

                {isEnded && !currentMeeting.summary && (
                    <div className="text-center py-10">
                        <p className="text-sm text-[var(--text-tertiary)]">회의가 종료되었습니다.</p>
                    </div>
                )}

                <div ref={endRef} />
            </div>
        </div>
    );
}
