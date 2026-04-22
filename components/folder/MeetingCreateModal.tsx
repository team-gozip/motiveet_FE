'use client';

import { useState, useEffect, useMemo } from 'react';
import { roomApi, folderApi, getAccessToken } from '@/lib/api';

interface MeetingCreateModalProps {
    folderId: number;
    roomType: 'ONLINE' | 'OFFLINE';
    onClose: () => void;
    onCreated: (roomId: number) => void;
}

interface Member {
    userId: number;
    username: string | null;
    name: string | null;
}

function getCurrentUserId(): number | null {
    const token = getAccessToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return Number(payload.sub ?? payload.user_id ?? payload.id ?? null);
    } catch { return null; }
}

export default function MeetingCreateModal({ folderId, roomType, onClose, onCreated }: MeetingCreateModalProps) {
    const [title, setTitle] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMembersLoading, setIsMembersLoading] = useState(true);
    const [error, setError] = useState('');

    const myUserId = getCurrentUserId();
    const isOnline = roomType === 'ONLINE';

    useEffect(() => {
        folderApi.getMembers(folderId)
            .then(resp => {
                setMembers(resp.members.filter(m => m.userId !== myUserId));
            })
            .catch(() => {})
            .finally(() => setIsMembersLoading(false));
    }, [folderId, myUserId]);

    const filtered = useMemo(() => {
        if (!search.trim()) return members;
        const q = search.toLowerCase();
        return members.filter(m =>
            (m.username?.toLowerCase().includes(q)) ||
            (m.name?.toLowerCase().includes(q))
        );
    }, [members, search]);

    const toggleMember = (userId: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === members.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(members.map(m => m.userId)));
        }
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            setError('회의 주제를 입력해주세요.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const room = await roomApi.create(folderId, title.trim(), roomType);
            await roomApi.join(room.roomId);
            if (selectedIds.size > 0) {
                await roomApi.invite(room.roomId, Array.from(selectedIds));
            }
            onCreated(room.roomId);
        } catch {
            setError('회의 생성에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-lg w-full max-w-md flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[var(--accent-primary)]' : 'bg-[var(--success)]'}`} />
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                            {isOnline ? '온라인' : '오프라인'} 회의 만들기
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-5 py-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[var(--text-secondary)]">
                                회의 주제
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => { setTitle(e.target.value); setError(''); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                placeholder="예: 2분기 기획 리뷰"
                                className="w-full h-10 px-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all"
                                autoFocus
                            />
                        </div>

                        {isOnline && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                                        참가자 초대
                                        {selectedIds.size > 0 && (
                                            <span className="ml-1.5 text-[var(--accent-primary)]">· {selectedIds.size}명 선택됨</span>
                                        )}
                                    </label>
                                    {members.length > 0 && (
                                        <button
                                            onClick={selectAll}
                                            className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
                                        >
                                            {selectedIds.size === members.length ? '전체 해제' : '전체 선택'}
                                        </button>
                                    )}
                                </div>

                                {members.length > 3 && (
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="이름 또는 아이디로 검색"
                                        className="w-full h-9 px-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]/40 transition-all"
                                    />
                                )}

                                <div className="border border-[var(--border-color)] rounded-md max-h-[180px] overflow-y-auto">
                                    {isMembersLoading ? (
                                        <div className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
                                            불러오는 중...
                                        </div>
                                    ) : members.length === 0 ? (
                                        <div className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
                                            그룹에 다른 멤버가 없습니다
                                        </div>
                                    ) : filtered.length === 0 ? (
                                        <div className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
                                            검색 결과가 없습니다
                                        </div>
                                    ) : (
                                        filtered.map(m => {
                                            const selected = selectedIds.has(m.userId);
                                            const displayName = m.name || m.username || '?';
                                            const initials = displayName.slice(0, 1).toUpperCase();
                                            return (
                                                <button
                                                    key={m.userId}
                                                    onClick={() => toggleMember(m.userId)}
                                                    className={`w-full flex items-center gap-3 px-3 py-2 border-b last:border-b-0 border-[var(--border-color)] text-left transition-colors ${
                                                        selected
                                                            ? 'bg-[var(--accent-primary)]/5'
                                                            : 'hover:bg-[var(--highlight-bg)]'
                                                    }`}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                                        selected
                                                            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                                                            : 'border-[var(--border-color)]'
                                                    }`}>
                                                        {selected && (
                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="w-7 h-7 rounded-full bg-[var(--highlight-bg)] border border-[var(--border-color)] flex items-center justify-center text-xs font-semibold text-[var(--foreground)] flex-shrink-0">
                                                        {initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-[var(--foreground)] truncate">{displayName}</p>
                                                        {m.username && m.name && (
                                                            <p className="text-[11px] text-[var(--text-tertiary)] truncate">@{m.username}</p>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 bg-[var(--highlight-bg)] border-t border-[var(--border-color)] rounded-b-xl">
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                        {isOnline && selectedIds.size > 0
                            ? `${selectedIds.size}명에게 초대 알림 발송`
                            : isOnline
                                ? '참가자 없이 시작 가능'
                                : '오프라인 회의는 초대 없이 시작'}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="h-8 px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors">
                            취소
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || !title.trim()}
                            className="h-8 px-3.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-md text-sm font-medium transition-colors"
                        >
                            {isLoading ? '생성 중...' : '회의 시작'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
