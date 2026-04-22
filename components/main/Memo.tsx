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
    const activeMeetingId = useRef<number | null>(null);
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
                if (activeMeetingId.current === targetMeetingId) setIsSaved(true);
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
        <div className="h-full flex flex-col bg-[var(--card-bg)]">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                        메모
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                        {readOnly ? '· 읽기 전용' : isEditing ? '· 편집 중' : '· 미리보기'}
                    </span>
                </div>
                {isSaved && !readOnly && (
                    <span className="text-[10px] text-[var(--success)] font-medium">저장됨</span>
                )}
            </div>

            {/* Content */}
            <div
                className="flex-1 overflow-y-auto cursor-text"
                onClick={!isEditing ? enableEditMode : undefined}
            >
                {!isEditing ? (
                    <div className="p-4 prose prose-sm dark:prose-invert max-w-none text-[var(--foreground)] markdown-preview">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content || (readOnly ? '*메모 없음*' : '*클릭하여 작성을 시작하세요. 마크다운을 지원합니다.*')}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <textarea
                        className="w-full h-full p-4 bg-transparent text-sm text-[var(--foreground)] border-none outline-none resize-none leading-relaxed placeholder:text-[var(--text-tertiary)]"
                        value={content}
                        onChange={handleChange}
                        onBlur={disableEditMode}
                        autoFocus
                        placeholder="회의 내용을 마크다운으로 기록하세요..."
                    />
                )}
            </div>
        </div>
    );
}
