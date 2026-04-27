'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { roomApi, folderApi } from '@/lib/api';
import { useFolder } from '@/components/providers/FolderProvider';
import { useTheme } from '@/components/common/ThemeProvider';
import MeetingRow from './MeetingRow';
import MeetingTypeModal from './MeetingTypeModal';
import MeetingCreateModal from './MeetingCreateModal';
import NotificationBell from '@/components/common/NotificationBell';

const LOBBY_VISITED_KEY = 'motiveet:lobby-visited';

function hasVisitedLobby(roomId: number): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const raw = sessionStorage.getItem(LOBBY_VISITED_KEY);
        const arr: number[] = raw ? JSON.parse(raw) : [];
        return arr.includes(roomId);
    } catch { return false; }
}

interface Room {
    roomId: number;
    name: string;
    type: 'ONLINE' | 'OFFLINE';
    status: 'WAITING' | 'ACTIVE' | 'ENDED';
    activeMeetingId: number | null;
    createdAt: string;
}

interface FolderPageProps {
    folderId: number;
}

interface ConfirmModalProps {
    icon: 'danger' | 'warning';
    title: string;
    description: string;
    confirmText: string;
    cancelText?: string;
    confirmVariant: 'danger' | 'warning';
    loading?: boolean;
    errorMessage?: string | null;
    onConfirm: () => void;
    onClose: () => void;
}

const CALENDAR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const toKstDateKey = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const year = parts.find(p => p.type === 'year')?.value ?? '0000';
    const month = parts.find(p => p.type === 'month')?.value ?? '01';
    const day = parts.find(p => p.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
};

const roomCreatedDateKey = (ts: string) => {
    const d = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z');
    return toKstDateKey(d);
};

const formatDateKeyLabel = (dateKey: string) => {
    const [y, m, d] = dateKey.split('-');
    return `${y}.${m}.${d}`;
};

function ConfirmModal({ icon, title, description, confirmText, cancelText = '취소', confirmVariant, loading, errorMessage, onConfirm, onClose }: ConfirmModalProps) {
    const iconColor = icon === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--warning)]';
    const confirmClass = confirmVariant === 'danger'
        ? 'bg-[var(--danger)] hover:brightness-110'
        : 'bg-[var(--warning)] hover:brightness-110';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
            onClick={() => !loading && onClose()}
        >
            <div
                className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-lg w-full max-w-sm"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-5">
                    <div className={`w-10 h-10 rounded-full bg-[var(--highlight-bg)] flex items-center justify-center mb-3 ${iconColor}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {icon === 'danger' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            )}
                        </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">{title}</h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>
                    {errorMessage && (
                        <p className="text-xs text-[var(--danger)] mt-2">{errorMessage}</p>
                    )}
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[var(--highlight-bg)] border-t border-[var(--border-color)] rounded-b-xl">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="h-8 px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] disabled:opacity-50 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`h-8 px-3.5 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${confirmClass}`}
                    >
                        {loading ? '처리 중...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function FolderPage({ folderId }: FolderPageProps) {
    const router = useRouter();
    const { currentFolder, setCurrentFolder } = useFolder();
    const { theme, toggleTheme } = useTheme();

    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [codeCopied, setCodeCopied] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [activeTab, setActiveTab] = useState<'ONLINE' | 'OFFLINE' | 'ALL'>('ALL');
    const [search, setSearch] = useState('');
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [pendingRoomType, setPendingRoomType] = useState<'ONLINE' | 'OFFLINE' | null>(null);
    const [showBusyModal, setShowBusyModal] = useState(false);
    const [deleteMode, setDeleteMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showFolderDeleteConfirm, setShowFolderDeleteConfirm] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [isFolderActing, setIsFolderActing] = useState(false);
    const [folderActionError, setFolderActionError] = useState<string | null>(null);
    const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const isOwner = currentFolder?.isOwner === true;

    const loadRooms = useCallback(async () => {
        setIsLoading(true);
        try {
            const resp = await roomApi.list(folderId);
            setRooms(resp.items);
        } catch (e: unknown) {
            const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
            if (msg.includes('not found') || msg.includes('access denied') || msg.includes('권한')) {
                setAccessDenied(true);
            }
        } finally {
            setIsLoading(false);
        }
    }, [folderId]);

    useEffect(() => {
        loadRooms();
        folderApi.getInviteCode(folderId)
            .then(r => setInviteCode(r.inviteCode))
            .catch(() => {});
        if (!currentFolder || currentFolder.folderId !== folderId) {
            folderApi.list().then(resp => {
                const found = resp.items.find(f => f.folderId === folderId);
                if (found) setCurrentFolder(found);
            }).catch(() => {});
        }
    }, [loadRooms, folderId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (accessDenied) router.replace('/choose');
    }, [accessDenied, router]);

    const copyCode = () => {
        if (!inviteCode) return;
        navigator.clipboard.writeText(inviteCode).then(() => {
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        });
    };

    const handleRoomCreated = (roomId: number) => {
        const type = pendingRoomType;
        setPendingRoomType(null);
        if (type === 'ONLINE') {
            router.push(`/room/${roomId}/lobby`);
        } else {
            router.push(`/room/${roomId}`);
        }
    };

    const enterDeleteMode = () => {
        setDeleteMode(true);
        setSelectedIds(new Set());
    };
    const exitDeleteMode = () => {
        setDeleteMode(false);
        setSelectedIds(new Set());
        setShowDeleteConfirm(false);
    };
    const toggleSelected = (roomId: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(roomId)) next.delete(roomId);
            else next.add(roomId);
            return next;
        });
    };
    const confirmDelete = async () => {
        if (selectedIds.size === 0) return;
        const activeIds = new Set(rooms.filter(r => r.activeMeetingId != null).map(r => r.roomId));
        const ids = Array.from(selectedIds).filter(id => !activeIds.has(id));
        const skipped = selectedIds.size - ids.length;
        if (ids.length === 0) {
            setIsDeleting(false);
            window.alert('진행 중인 회의는 삭제할 수 없습니다. 먼저 종료해주세요.');
            exitDeleteMode();
            return;
        }
        setIsDeleting(true);
        const results = await Promise.allSettled(ids.map(id => roomApi.delete(id)));
        const failed = results.filter(r => r.status === 'rejected').length;
        const succeeded = new Set(
            ids.filter((_id, i) => results[i].status === 'fulfilled')
        );
        setRooms(prev => prev.filter(r => !succeeded.has(r.roomId)));
        setIsDeleting(false);
        if (skipped > 0 || failed > 0) {
            const parts: string[] = [];
            if (skipped > 0) parts.push(`진행 중인 회의 ${skipped}개 제외`);
            if (failed > 0) parts.push(`${failed}개 실패`);
            window.alert(parts.join(', '));
        }
        exitDeleteMode();
    };

    const handleDeleteFolder = async () => {
        const activeNames = rooms.filter(r => r.activeMeetingId != null).map(r => r.name);
        if (activeNames.length > 0) {
            setFolderActionError(
                `진행 중인 회의가 있어 삭제할 수 없습니다: ${activeNames.join(', ')}. 먼저 종료해주세요.`
            );
            return;
        }
        setIsFolderActing(true);
        setFolderActionError(null);
        try {
            await folderApi.delete(folderId);
            setCurrentFolder(null);
            router.replace('/choose');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '그룹 삭제에 실패했습니다';
            setFolderActionError(msg);
            setIsFolderActing(false);
        }
    };

    const handleLeaveFolder = async () => {
        setIsFolderActing(true);
        setFolderActionError(null);
        try {
            await folderApi.leave(folderId);
            setCurrentFolder(null);
            router.replace('/choose');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '그룹 탈퇴에 실패했습니다';
            setFolderActionError(msg);
            setIsFolderActing(false);
        }
    };

    const handleRoomClick = async (room: Room) => {
        if (room.status === 'ENDED') {
            router.push(`/room/${room.roomId}`);
            return;
        }
        if (room.type === 'OFFLINE' && room.activeMeetingId != null) {
            setShowBusyModal(true);
            return;
        }
        try {
            await roomApi.join(room.roomId);
            if (room.type === 'ONLINE' && !hasVisitedLobby(room.roomId)) {
                router.push(`/room/${room.roomId}/lobby`);
            } else {
                router.push(`/room/${room.roomId}`);
            }
        } catch (e) {
            console.error('Failed to join room:', e);
        }
    };

    const filteredBase = rooms.filter(r => {
        const matchesTab = activeTab === 'ALL' || r.type === activeTab;
        const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
        return matchesTab && matchesSearch;
    });
    const filtered = selectedDateKey
        ? filteredBase.filter(r => roomCreatedDateKey(r.createdAt) === selectedDateKey)
        : filteredBase;

    const roomCountByDate = filteredBase.reduce<Record<string, number>>((acc, room) => {
        const key = roomCreatedDateKey(room.createdAt);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {});

    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    const todayKey = toKstDateKey(new Date());
    const calendarDays = Array.from({ length: 42 }, (_, idx) => {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + idx);
        const key = toKstDateKey(day);
        return {
            key,
            date: day,
            day: day.getDate(),
            inMonth: day.getMonth() === calendarMonth.getMonth(),
            count: roomCountByDate[key] ?? 0,
            isToday: key === todayKey,
        };
    });

    const calendarTitle = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
    }).format(calendarMonth);

    const moveCalendarMonth = (delta: number) => {
        setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    const handleSelectCalendarDate = (dateKey: string, date: Date) => {
        setSelectedDateKey(dateKey);
        if (date.getMonth() !== calendarMonth.getMonth() || date.getFullYear() !== calendarMonth.getFullYear()) {
            setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        }
    };

    const resetCalendarFilter = () => {
        setSelectedDateKey(null);
        const now = new Date();
        setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    };

    const onlineCount = rooms.filter(r => r.type === 'ONLINE').length;
    const activeCount = rooms.filter(r => r.activeMeetingId != null).length;
    const endedCount = rooms.filter(r => r.status === 'ENDED').length;

    if (accessDenied) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <span className="text-sm text-[var(--text-tertiary)]">접근 권한이 없습니다. 이동 중...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            {/* Header */}
            <header className="h-14 bg-[var(--header-bg)] border-b border-[var(--border-color)] sticky top-0 z-10">
                <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link
                            href="/choose"
                            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <Link href="/choose" className="flex items-center">
                            <img
                                src={theme === 'dark' ? '/dark_logo2.png' : '/white_logo2.png'}
                                alt="Motiveet"
                                className="h-6 w-auto object-contain"
                            />
                        </Link>
                        <span className="text-[var(--text-tertiary)]">/</span>
                        <span className="text-sm font-medium text-[var(--foreground)] truncate">
                            {currentFolder?.name ?? '...'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <NotificationBell />
                        {inviteCode && (
                            <button
                                onClick={copyCode}
                                title="초대 코드 복사"
                                className="h-8 px-2.5 bg-[var(--card-bg)] hover:bg-[var(--highlight-bg)] border border-[var(--border-color)] rounded-md text-xs font-mono font-medium tracking-widest text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                {codeCopied ? '복사됨' : inviteCode}
                            </button>
                        )}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                        >
                            {theme === 'dark' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Title + actions */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight truncate">
                            {currentFolder?.name ?? '회의실'}
                        </h1>
                        {currentFolder?.description && (
                            <p className="text-sm text-[var(--text-secondary)] mt-1">{currentFolder.description}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {deleteMode ? (
                            <>
                                <span className="text-xs text-[var(--text-secondary)]">
                                    {selectedIds.size}개 선택됨
                                </span>
                                <button
                                    onClick={exitDeleteMode}
                                    disabled={isDeleting}
                                    className="h-9 px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] disabled:opacity-50 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => selectedIds.size > 0 && setShowDeleteConfirm(true)}
                                    disabled={selectedIds.size === 0 || isDeleting}
                                    className="h-9 px-3.5 bg-[var(--danger)] hover:brightness-110 disabled:opacity-40 text-white rounded-md text-sm font-medium transition-all"
                                >
                                    삭제
                                </button>
                            </>
                        ) : (
                            <>
                                {isOwner && (
                                    <button
                                        onClick={enterDeleteMode}
                                        title="회의 삭제"
                                        className="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--highlight-bg)] rounded-md transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                        </svg>
                                    </button>
                                )}
                                <button
                                    onClick={() => isOwner ? setShowFolderDeleteConfirm(true) : setShowLeaveConfirm(true)}
                                    className="h-9 px-3 bg-[var(--card-bg)] hover:bg-[var(--highlight-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--foreground)] rounded-md text-sm font-medium transition-colors"
                                >
                                    {isOwner ? '그룹 삭제' : '그룹 나가기'}
                                </button>
                                <button
                                    onClick={() => setShowTypeModal(true)}
                                    className="h-9 px-3.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    새 회의
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-4 gap-0 mb-6 border border-[var(--border-color)] rounded-lg bg-[var(--card-bg)] overflow-hidden">
                    {[
                        { label: '전체', value: rooms.length, color: 'text-[var(--foreground)]' },
                        { label: '진행 중', value: activeCount, color: 'text-[var(--success)]' },
                        { label: '온라인', value: onlineCount, color: 'text-[var(--accent-primary)]' },
                        { label: '종료됨', value: endedCount, color: 'text-[var(--text-tertiary)]' },
                    ].map((s, i) => (
                        <div key={s.label} className={`px-5 py-4 ${i > 0 ? 'border-l border-[var(--border-color)]' : ''}`}>
                            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{s.label}</p>
                            <p className={`text-xl font-semibold mt-0.5 tabular-nums ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                    <div className="min-w-0">
                        {/* Filter + search */}
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex items-center bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-0.5">
                                {(['ALL', 'ONLINE', 'OFFLINE'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`h-7 px-3 rounded text-xs font-medium transition-all ${
                                            activeTab === tab
                                                ? 'bg-[var(--highlight-bg)] text-[var(--foreground)]'
                                                : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                                        }`}
                                    >
                                        {tab === 'ALL' ? '전체' : tab === 'ONLINE' ? '온라인' : '오프라인'}
                                    </button>
                                ))}
                            </div>
                            <div className="relative flex-1">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="회의 이름으로 검색"
                                    className="w-full h-9 pl-9 pr-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]/40 transition-all"
                                />
                            </div>
                        </div>

                        {/* Room list */}
                        <div className="border border-[var(--border-color)] rounded-lg bg-[var(--card-bg)] overflow-hidden">
                            {isLoading ? (
                                <div>
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-14 border-b last:border-b-0 border-[var(--border-color)] animate-pulse">
                                            <div className="h-full flex items-center px-4">
                                                <div className="w-14 h-4 bg-[var(--highlight-bg)] rounded" />
                                                <div className="ml-4 flex-1 h-3 bg-[var(--highlight-bg)] rounded" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-12 h-12 rounded-full bg-[var(--highlight-bg)] flex items-center justify-center mb-3">
                                        <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                                        {selectedDateKey
                                            ? '선택한 날짜에 생성된 회의가 없습니다'
                                            : search
                                                ? '검색 결과가 없습니다'
                                                : '아직 회의가 없습니다'}
                                    </p>
                                    {!search && !selectedDateKey && (
                                        <p className="text-xs text-[var(--text-secondary)]">
                                            위 &ldquo;새 회의&rdquo; 버튼으로 첫 회의를 시작하세요
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    {filtered.map((room, i) => (
                                        <div key={room.roomId} className={i === filtered.length - 1 ? '[&>div]:border-b-0' : ''}>
                                            <MeetingRow
                                                room={room}
                                                onClick={() => handleRoomClick(room)}
                                                selectMode={deleteMode}
                                                checked={selectedIds.has(room.roomId)}
                                                onToggle={() => toggleSelected(room.roomId)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <aside className="border border-[var(--border-color)] rounded-lg bg-[var(--card-bg)] p-4 lg:sticky lg:top-[4.5rem]">
                        <div className="flex items-center justify-between mb-3">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">날짜 필터</p>
                                <p className="text-sm font-medium text-[var(--foreground)] mt-0.5 truncate">{calendarTitle}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => moveCalendarMonth(-1)}
                                    className="h-7 w-7 flex items-center justify-center rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                                    aria-label="이전 달"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => moveCalendarMonth(1)}
                                    className="h-7 w-7 flex items-center justify-center rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                                    aria-label="다음 달"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={resetCalendarFilter}
                                    className="h-7 px-2.5 rounded-md border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                                >
                                    전체 조회
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-1">
                            {CALENDAR_WEEKDAYS.map((d) => (
                                <div key={d} className="h-7 flex items-center justify-center text-[11px] font-medium text-[var(--text-tertiary)]">
                                    {d}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map(day => (
                                <button
                                    key={day.key}
                                    onClick={() => handleSelectCalendarDate(day.key, day.date)}
                                    className={`h-10 rounded-md border text-xs transition-colors ${
                                        selectedDateKey === day.key
                                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                            : day.inMonth
                                                ? 'border-transparent text-[var(--foreground)] hover:bg-[var(--highlight-bg)]'
                                                : 'border-transparent text-[var(--text-tertiary)] hover:bg-[var(--highlight-bg)]'
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        <span className={`${day.isToday ? 'font-semibold underline decoration-[var(--accent-primary)] decoration-2 underline-offset-2' : ''}`}>
                                            {day.day}
                                        </span>
                                        {day.count > 0 && (
                                            <span className="text-[10px] text-[var(--accent-primary)] tabular-nums">({day.count})</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="mt-2 text-xs text-[var(--text-secondary)]">
                            {selectedDateKey
                                ? `${formatDateKeyLabel(selectedDateKey)} 생성 회의만 표시 중 (${filtered.length}개)`
                                : '날짜를 선택하면 해당 날짜에 생성된 회의만 표시됩니다.'}
                        </div>
                    </aside>
                </div>
            </main>

            {showTypeModal && (
                <MeetingTypeModal
                    onClose={() => setShowTypeModal(false)}
                    onSelect={(type) => {
                        setShowTypeModal(false);
                        setPendingRoomType(type);
                    }}
                />
            )}

            {pendingRoomType && (
                <MeetingCreateModal
                    folderId={folderId}
                    roomType={pendingRoomType}
                    onClose={() => setPendingRoomType(null)}
                    onCreated={handleRoomCreated}
                />
            )}

            {showDeleteConfirm && (
                <ConfirmModal
                    icon="danger"
                    title={`선택한 ${selectedIds.size}개 회의를 삭제할까요?`}
                    description="회의실과 참가자, 메모·요약이 모두 사라지며 되돌릴 수 없습니다."
                    confirmText="삭제"
                    confirmVariant="danger"
                    loading={isDeleting}
                    onConfirm={confirmDelete}
                    onClose={() => !isDeleting && setShowDeleteConfirm(false)}
                />
            )}

            {showFolderDeleteConfirm && (
                <ConfirmModal
                    icon="danger"
                    title={`그룹 "${currentFolder?.name ?? ''}"을 삭제할까요?`}
                    description="그룹 내 모든 회의실과 메모, 멤버가 함께 삭제되며 되돌릴 수 없습니다."
                    confirmText="삭제"
                    confirmVariant="danger"
                    loading={isFolderActing}
                    errorMessage={folderActionError}
                    onConfirm={handleDeleteFolder}
                    onClose={() => !isFolderActing && setShowFolderDeleteConfirm(false)}
                />
            )}

            {showLeaveConfirm && (
                <ConfirmModal
                    icon="warning"
                    title={`그룹 "${currentFolder?.name ?? ''}"에서 나갈까요?`}
                    description="탈퇴하면 이 그룹과 회의실에 더 이상 접근할 수 없습니다."
                    confirmText="탈퇴"
                    confirmVariant="warning"
                    loading={isFolderActing}
                    errorMessage={folderActionError}
                    onConfirm={handleLeaveFolder}
                    onClose={() => !isFolderActing && setShowLeaveConfirm(false)}
                />
            )}

            {showBusyModal && (
                <ConfirmModal
                    icon="warning"
                    title="이미 사용 중인 회의입니다"
                    description="오프라인 회의가 진행 중입니다. 회의가 종료된 후 다시 시도해주세요."
                    confirmText="확인"
                    cancelText="닫기"
                    confirmVariant="warning"
                    onConfirm={() => setShowBusyModal(false)}
                    onClose={() => setShowBusyModal(false)}
                />
            )}
        </div>
    );
}
