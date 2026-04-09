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
            // 선택한 멤버에게 초대 알림
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

    const isOnline = roomType === 'ONLINE';
    const accentColor = isOnline ? 'indigo' : 'emerald';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

                {/* ── Header ─────────────────────────────── */}
                <div className={`px-6 py-5 ${isOnline ? 'bg-gradient-to-r from-indigo-600 to-indigo-500' : 'bg-gradient-to-r from-emerald-600 to-emerald-500'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-white/60" />
                            <span className="text-xs font-medium text-white/80">
                                {isOnline ? '온라인 회의' : '오프라인 회의'}
                            </span>
                        </div>
                        <button onClick={onClose} className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => { setTitle(e.target.value); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder="회의 주제를 입력하세요"
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder-white/40 outline-none focus:bg-white/15 focus:border-white/30 transition-all"
                        autoFocus
                    />
                </div>

                {/* ── Member selection (온라인만) ─────────── */}
                {isOnline && (
                    <div className="border-b border-[var(--border-color)]">
                        <div className="px-6 pt-4 pb-2">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-[var(--foreground)]">
                                        참가자 초대
                                    </span>
                                    {selectedIds.size > 0 && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-${accentColor}-100 dark:bg-${accentColor}-900/30 text-${accentColor}-600 dark:text-${accentColor}-400`}>
                                            {selectedIds.size}명 선택
                                        </span>
                                    )}
                                </div>
                                {members.length > 0 && (
                                    <button
                                        onClick={selectAll}
                                        className="text-[10px] font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
                                    >
                                        {selectedIds.size === members.length ? '전체 해제' : '전체 선택'}
                                    </button>
                                )}
                            </div>

                            {/* Search */}
                            {members.length > 3 && (
                                <div className="relative mb-3">
                                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="이름 또는 아이디로 검색"
                                        className="w-full bg-[var(--highlight-bg)] border border-[var(--border-color)] rounded-lg pl-8 pr-3 py-2 text-xs text-[var(--foreground)] outline-none focus:ring-1 focus:ring-indigo-500/30 placeholder:text-[var(--text-tertiary)]"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Member list */}
                        <div className="max-h-[200px] overflow-y-auto px-3 pb-3">
                            {isMembersLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <span className="text-xs text-[var(--text-tertiary)]">불러오는 중...</span>
                                </div>
                            ) : members.length === 0 ? (
                                <div className="flex items-center justify-center py-6">
                                    <span className="text-xs text-[var(--text-tertiary)]">그룹에 다른 멤버가 없습니다</span>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex items-center justify-center py-4">
                                    <span className="text-xs text-[var(--text-tertiary)]">검색 결과가 없습니다</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                    {filtered.map(m => {
                                        const selected = selectedIds.has(m.userId);
                                        const displayName = m.name || m.username || '?';
                                        const initials = displayName.slice(0, 1).toUpperCase();
                                        return (
                                            <button
                                                key={m.userId}
                                                onClick={() => toggleMember(m.userId)}
                                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                                                    selected
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/50 ring-1 ring-indigo-500/20'
                                                        : 'bg-[var(--highlight-bg)] border border-transparent hover:border-[var(--border-color)]'
                                                }`}
                                            >
                                                {/* Avatar */}
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                                                    selected
                                                        ? 'bg-indigo-500 text-white'
                                                        : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)]'
                                                }`}>
                                                    {selected ? (
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : initials}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-medium truncate ${selected ? 'text-indigo-700 dark:text-indigo-300' : 'text-[var(--foreground)]'}`}>
                                                        {displayName}
                                                    </p>
                                                    {m.username && m.name && (
                                                        <p className="text-[10px] text-[var(--text-tertiary)] truncate">@{m.username}</p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Footer ─────────────────────────────── */}
                <div className="px-6 py-4 bg-[var(--card-bg)]">
                    {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-tertiary)]">
                            {isOnline && selectedIds.size > 0
                                ? `${selectedIds.size}명에게 초대 알림 발송`
                                : isOnline
                                    ? '참가자를 선택하지 않아도 생성 가능'
                                    : '오프라인 회의는 초대 없이 시작됩니다'}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading || !title.trim()}
                                className={`px-5 py-2 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${
                                    isOnline
                                        ? 'bg-indigo-600 hover:bg-indigo-700'
                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                            >
                                {isLoading ? '생성 중...' : '회의 시작'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
