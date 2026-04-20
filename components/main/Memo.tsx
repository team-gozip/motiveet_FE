'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { meetingApi } from '@/lib/api';

interface MemoProps {
    meetingId: number | null;
    initialContent?: string | null;
    readOnly?: boolean;
    onContentChange?: (content: string) => void;
}

export default function Memo({ meetingId, initialContent, readOnly, onContentChange }: MemoProps) {
    const [content, setContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    // meetingId가 바뀔 때 이전 회의 잔여 타이머가 새 회의의 memo를 덮어쓰는 것을 방지
    const activeMeetingId = useRef<number | null>(null);
    // unmount 시 미전송 debounce 저장을 flush 하기 위한 pending 상태
    const pendingSaveRef = useRef<{ meetingId: number; content: string } | null>(null);

    useEffect(() => {
        activeMeetingId.current = meetingId;
        const next = initialContent ?? '';
        setContent(next);
        if (onContentChange) onContentChange(next);
        setIsSaved(false);
    }, [meetingId, initialContent, onContentChange]);

    useEffect(() => {
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            const pending = pendingSaveRef.current;
            if (pending) {
                meetingApi.updateMemo(pending.meetingId, pending.content)
                    .catch(err => console.error('[Memo] flush save failed:', err));
            }
        };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        if (onContentChange) onContentChange(newContent);

        if (!meetingId) return;
        const targetMeetingId = meetingId;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setIsSaved(false);
        pendingSaveRef.current = { meetingId: targetMeetingId, content: newContent };
        saveTimer.current = setTimeout(async () => {
            try {
                await meetingApi.updateMemo(targetMeetingId, newContent);
                if (activeMeetingId.current === targetMeetingId) {
                    setIsSaved(true);
                }
                if (
                    pendingSaveRef.current?.meetingId === targetMeetingId &&
                    pendingSaveRef.current?.content === newContent
                ) {
                    pendingSaveRef.current = null;
                }
            } catch (err) {
                console.error('[Memo] save failed:', err);
            }
        }, 600);
    };

    const enableEditMode = () => { if (!readOnly) setIsEditing(true); };
    const disableEditMode = () => setIsEditing(false);

    return (
        <div className="h-full flex flex-col bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${isEditing ? 'bg-[var(--accent-primary)] animate-pulse shadow-[0_0_8px_var(--accent-primary)]' : 'bg-emerald-500'}`}></div>
                    </div>
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">Meeting Memo</h2>
                        <span className="text-[10px] font-bold text-[var(--accent-primary)] opacity-40">
                            {readOnly ? 'READ ONLY' : isEditing ? 'EDITING' : 'PREVIEW'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isSaved && !readOnly && (
                        <span className="text-[10px] text-emerald-500 font-semibold">저장됨</span>
                    )}
                    <div className="flex space-x-1">
                        <div className="w-1 h-1 rounded-full bg-[var(--accent-primary)] opacity-20"></div>
                        <div className="w-1 h-1 rounded-full bg-[var(--accent-primary)] opacity-20"></div>
                        <div className="w-1 h-1 rounded-full bg-[var(--accent-primary)] opacity-20"></div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto relative group cursor-text custom-scrollbar" onClick={!isEditing ? enableEditMode : undefined}>
                {!isEditing ? (
                    <div className="p-8 prose prose-slate dark:prose-invert max-w-none text-[var(--foreground)] markdown-preview">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content || (readOnly ? '*메모 없음*' : '*메모가 비어 있습니다. 클릭하여 작성을 시작하세요.*')}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <textarea
                        className="w-full h-full p-8 bg-transparent text-[var(--foreground)] border-none outline-none resize-none focus:ring-0 leading-relaxed custom-scrollbar text-base"
                        value={content}
                        onChange={handleChange}
                        onBlur={disableEditMode}
                        autoFocus
                        placeholder="회의 내용을 마크다운으로 기록해보세요..."
                    />
                )}
            </div>
        </div>
    );
}
