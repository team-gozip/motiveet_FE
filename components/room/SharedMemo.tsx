'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { roomApi, getAccessToken } from '@/lib/api';

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
    const lastSavedRef = useRef<string | null>(null);
    const isSavingRef = useRef(false);
    const pendingSaveRef = useRef<string | null>(null);
    // 서버에서 초기 데이터를 한 번이라도 수신했는가. 이 값이 false면 저장 일체 금지
    // (초기 로드 이전에 빈 문자열로 서버 메모를 덮어쓰는 사고 방지).
    const hasLoadedRef = useRef(false);
    // 사용자가 실제로 입력을 바꾼 적이 있는가. 이 값이 true일 때만 저장 실행.
    const isDirtyRef = useRef(false);

    // content 최신값을 ref에 동기화 (unmount flush에서 사용)
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    // 마운트 시 서버 노트 로드
    useEffect(() => {
        let cancelled = false;
        // roomId가 바뀔 때는 이전 룸의 로드 상태를 초기화 (안전장치)
        hasLoadedRef.current = false;
        isDirtyRef.current = false;
        roomApi.getById(roomId)
            .then(room => {
                if (!cancelled) {
                    const loaded = room.note || '';
                    setContent(loaded);
                    contentRef.current = loaded;
                    lastSavedRef.current = loaded;
                    hasLoadedRef.current = true;  // 로드 성공 시에만 저장 허용
                    setSaveStatus('idle');
                }
            })
            .catch(err => {
                console.error('[SharedMemo] failed to load note:', err);
                // 실패 시 hasLoadedRef는 false 유지 → 저장 금지
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [roomId]);

    const save = useCallback(async (text: string): Promise<void> => {
        // 초기 로드 전/로드 실패 상태에서는 절대 저장 금지 — 빈 문자열로 서버 값 덮어쓰기 방지
        if (!hasLoadedRef.current) return;
        // 사용자가 실제로 변경한 적이 없으면 저장 생략
        if (!isDirtyRef.current) return;
        if (isSavingRef.current) {
            pendingSaveRef.current = text;
            return;
        }
        isSavingRef.current = true;
        setSaveStatus('saving');
        try {
            await roomApi.updateNotes(roomId, text);
            lastSavedRef.current = text;
            // 저장 성공 이후, 현재 ref가 같은 값이면 dirty 해제
            if (contentRef.current === text) {
                isDirtyRef.current = false;
            }
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
        // 사용자 입력 → dirty 플래그 set
        isDirtyRef.current = true;
        setContent(val);
        setSaveStatus('saving');
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => save(val), 400);
    }, [save]);

    // keepalive fetch로 미저장 내용 즉시 flush (unmount / pagehide 공용)
    const flushNote = useCallback(() => {
        clearTimeout(debounceRef.current);
        // 초기 로드 전이면 절대 저장하지 않음 (빈 문자열 덮어쓰기 사고 차단)
        if (!hasLoadedRef.current) return;
        // 사용자가 실제로 변경하지 않았으면 저장 생략
        if (!isDirtyRef.current) return;
        const current = contentRef.current;
        if (lastSavedRef.current === current) return;
        const token = getAccessToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        try {
            fetch(`/api/rooms/${roomId}/notes`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ content: current }),
                keepalive: true,
            }).catch(() => {});
            lastSavedRef.current = current;
            isDirtyRef.current = false;
        } catch { /* ignore */ }
    }, [roomId]);

    // 10초마다 미저장 내용을 주기적으로 서버에 저장 (debounce/unload flush를 보완)
    // 브라우저가 예기치 않게 꺼지거나 네트워크 이슈로 flush가 누락되는 극단 상황 대비.
    useEffect(() => {
        const id = setInterval(() => {
            // 초기 로드 전/미변경 상태면 저장 생략
            if (!hasLoadedRef.current) return;
            if (!isDirtyRef.current) return;
            const current = contentRef.current;
            if (lastSavedRef.current === current) return;
            if (isSavingRef.current) {
                pendingSaveRef.current = current;
                return;
            }
            save(current);
        }, 10000);
        return () => clearInterval(id);
    }, [save]);

    // 언마운트 시 미저장 내용 flush (SPA 이탈)
    useEffect(() => {
        return () => { flushNote(); };
    }, [flushNote]);

    // 탭 닫기/새로고침/백그라운드 전환 시에도 flush (React cleanup은 unload에서 실행 안 됨)
    useEffect(() => {
        const onHide = () => flushNote();
        const onVisibility = () => { if (document.visibilityState === 'hidden') flushNote(); };
        window.addEventListener('pagehide', onHide);
        window.addEventListener('beforeunload', onHide);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('pagehide', onHide);
            window.removeEventListener('beforeunload', onHide);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [flushNote]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-[var(--foreground)] text-[var(--text-tertiary)] text-xs">노트 불러오는 중...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[var(--card-bg)] overflow-hidden">
            {/* 헤더 */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full transition-colors ${isEditing ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)] text-[var(--text-secondary)]">
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
                    <span className="text-[10px] text-[var(--foreground)] text-[var(--text-tertiary)]">공유 · 마크다운</span>
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
                    <div className="p-6 prose prose-sm dark:prose-invert max-w-none markdown-preview text-[var(--foreground)]">
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
