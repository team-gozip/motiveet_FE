'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MemoProps {
    meetingId: number | null;
    onContentChange?: (content: string) => void;
}

export default function Memo({ meetingId, onContentChange }: MemoProps) {
    const [content, setContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // meetingId가 바뀔 때마다 해당 회의의 메모를 불러옴
    useEffect(() => {
        if (!meetingId) {
            setContent('');
            if (onContentChange) onContentChange('');
            return;
        }
        const savedMemo = localStorage.getItem(`meeting_memo_${meetingId}`);
        const initialContent = savedMemo || '';
        setContent(initialContent);
        if (onContentChange) {
            onContentChange(initialContent);
        }
    }, [meetingId, onContentChange]);

    // 회의별로 독립된 키에 저장
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);

        if (onContentChange) {
            onContentChange(newContent);
        }

        if (meetingId) {
            localStorage.setItem(`meeting_memo_${meetingId}`, newContent);
        }
    };

    const enableEditMode = () => setIsEditing(true);
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
                        <span className="text-[10px] font-bold text-[var(--accent-primary)] opacity-40">{isEditing ? 'EDITING' : 'PREVIEW'}</span>
                    </div>
                </div>
                <div className="flex space-x-1">
                    <div className="w-1 h-1 rounded-full bg-[var(--accent-primary)] opacity-20"></div>
                    <div className="w-1 h-1 rounded-full bg-[var(--accent-primary)] opacity-20"></div>
                    <div className="w-1 h-1 rounded-full bg-[var(--accent-primary)] opacity-20"></div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto relative group cursor-text custom-scrollbar" onClick={!isEditing ? enableEditMode : undefined}>
                {!isEditing ? (
                    <div className="p-8 prose prose-slate dark:prose-invert max-w-none text-[var(--foreground)] markdown-preview">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content || '*메모가 비어 있습니다. 클릭하여 작성을 시작하세요.*'}
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
