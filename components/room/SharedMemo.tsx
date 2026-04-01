'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { roomApi } from '@/lib/api';

interface SharedMemoProps {
    roomId: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 방 참가자 전체가 공유하는 메모.
 * DB (PUT /rooms/{roomId}/notes) 에 저장, localStorage 미사용.
 *
 * - 마운트 시 서버에서 기존 노트 로드
 * - 입력 후 1초 debounce → 자동 저장
 * - 저장 실패 시 에러 배너 표시
 * - 언마운트 시 미저장 내용 즉시 flush
 */
export default function SharedMemo({ roomId }: SharedMemoProps) {
    const [content, setContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [isLoading, setIsLoading] = useState(true);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const contentRef = useRef('');
    const isSavingRef = useRef(false);
    const pendingSaveRef = useRef<string | null>(null);

    // content 최신값을 ref에 동기화 (unmount flush에서 사용)
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    // 마운트 시 서버 노트 로드
    useEffect(() => {
        let cancelled = false;
        roomApi.getById(roomId)
            .then(room => {
                if (!cancelled) {
                    setContent(room.note || '');
                    contentRef.current = room.note || '';
                    setSaveStatus('idle');
                }
            })
            .catch(err => {
                console.error('[SharedMemo] failed to load note:', err);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [roomId]);

    const save = useCallback(async (text: string): Promise<void> => {
        if (isSavingRef.current) {
            pendingSaveRef.current = text;
            return;
        }
        isSavingRef.current = true;
        setSaveStatus('saving');
        try {
            await roomApi.updateNotes(roomId, text);
            setSaveStatus('saved');
            console.log('[SharedMemo] saved, length:', text.length);
            // 저장 완료 후 대기 중인 저장이 있으면 처리
            if (pendingSaveRef.current !== null) {
                const pending = pendingSaveRef.current;
                pendingSaveRef.current = null;
                isSavingRef.current = false;
                await save(pending);
            }
        } catch (err) {
            console.error('[SharedMemo] save failed:', err);
            setSaveStatus('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [roomId]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);
        setSaveStatus('saving');
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => save(val), 1000);
    }, [save]);

    // 언마운트 시 미저장 내용 flush
    useEffect(() => {
        return () => {
            clearTimeout(debounceRef.current);
            // fire-and-forget: 언마운트 시 현재 내용 즉시 저장 시도
            roomApi.updateNotes(roomId, contentRef.current).catch(() => {});
        };
    }, [roomId]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-[var(--foreground)] opacity-30 text-xs">노트 불러오는 중...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[var(--card-bg)] overflow-hidden">
            {/* 헤더 */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full transition-colors ${isEditing ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)] opacity-50">
                        {isEditing ? 'EDITING' : 'PREVIEW'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {saveStatus === 'saving' && (
                        <span className="text-[10px] text-amber-500 animate-pulse font-medium">저장 중...</span>
                    )}
                    {saveStatus === 'saved' && (
                        <span className="text-[10px] text-emerald-500 font-medium">저장됨</span>
                    )}
                    {saveStatus === 'error' && (
                        <span className="text-[10px] text-red-500 font-semibold">저장 실패 ⚠</span>
                    )}
                    <span className="text-[10px] text-[var(--foreground)] opacity-30">공유 · 마크다운</span>
                </div>
            </div>

            {/* 저장 실패 배너 */}
            {saveStatus === 'error' && (
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/30">
                    <span className="text-xs text-red-600 dark:text-red-400">
                        노트 저장에 실패했습니다. 중요한 내용은 따로 복사해 두세요.
                    </span>
                    <button
                        onClick={() => setSaveStatus('idle')}
                        className="ml-3 flex-shrink-0 text-red-400 hover:text-red-600 text-xs font-bold transition-colors"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* 에디터 / 프리뷰 */}
            <div
                className="flex-1 overflow-y-auto cursor-text"
                onClick={!isEditing ? () => setIsEditing(true) : undefined}
            >
                {isEditing ? (
                    <textarea
                        className="w-full h-full p-6 bg-transparent text-[var(--foreground)] text-sm border-none outline-none resize-none leading-relaxed"
                        value={content}
                        onChange={handleChange}
                        onBlur={() => setIsEditing(false)}
                        autoFocus
                        placeholder={
                            '회의 내용을 마크다운으로 기록해보세요...\n\n# 제목\n- 항목\n**굵게** *기울임*'
                        }
                    />
                ) : (
                    <div className="p-6 prose prose-sm dark:prose-invert max-w-none text-[var(--foreground)]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content ||
                                '*노트가 비어 있습니다. 클릭하여 작성을 시작하세요.*\n\n*이 노트는 방 참가자 전체와 공유됩니다.*'}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
}
