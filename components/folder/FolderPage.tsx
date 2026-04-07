'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { roomApi } from '@/lib/api';
import { useFolder } from '@/components/providers/FolderProvider';
import { useTheme } from '@/components/common/ThemeProvider';
import MeetingRow from './MeetingRow';
import MeetingTypeModal from './MeetingTypeModal';
import MeetingCreateModal from './MeetingCreateModal';

interface Room {
    roomId: number;
    name: string;
    type: 'ONLINE' | 'OFFLINE';
    status: 'WAITING' | 'ACTIVE' | 'ENDED';
    createdAt: string;
}

interface FolderPageProps {
    folderId: number;
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function CalendarWidget() {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const isToday = (d: number | null) =>
        d !== null &&
        d === today.getDate() &&
        viewMonth === today.getMonth() &&
        viewYear === today.getFullYear();

    return (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth} className="p-1 rounded hover:bg-[var(--highlight-bg)] text-[var(--foreground)] opacity-40 hover:opacity-100 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="text-xs font-semibold text-[var(--foreground)]">
                    {viewYear}년 {viewMonth + 1}월
                </span>
                <button onClick={nextMonth} className="p-1 rounded hover:bg-[var(--highlight-bg)] text-[var(--foreground)] opacity-40 hover:opacity-100 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d, i) => (
                    <div key={d} className={`text-center text-[10px] font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-[var(--foreground)] opacity-30'}`}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-center">
                        {d !== null ? (
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] cursor-pointer transition-colors
                                ${isToday(d)
                                    ? 'bg-indigo-600 text-white font-bold'
                                    : idx % 7 === 0
                                        ? 'text-red-400 hover:bg-[var(--highlight-bg)]'
                                        : idx % 7 === 6
                                            ? 'text-blue-400 hover:bg-[var(--highlight-bg)]'
                                            : 'text-[var(--foreground)] opacity-60 hover:bg-[var(--highlight-bg)]'
                                }`}
                            >
                                {d}
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function FolderPage({ folderId }: FolderPageProps) {
    const router = useRouter();
    const { currentFolder } = useFolder();
    const { theme, toggleTheme } = useTheme();

    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'ONLINE' | 'OFFLINE' | 'ALL'>('ALL');
    const [search, setSearch] = useState('');
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [pendingRoomType, setPendingRoomType] = useState<'ONLINE' | 'OFFLINE' | null>(null);

    const loadRooms = useCallback(async () => {
        setIsLoading(true);
        try {
            const resp = await roomApi.list(folderId);
            setRooms(resp.items);
        } catch (e) {
            console.error('Failed to load rooms:', e);
        } finally {
            setIsLoading(false);
        }
    }, [folderId]);

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    const handleRoomCreated = (roomId: number) => {
        setPendingRoomType(null);
        router.push(`/room/${roomId}`);
    };

    const handleRoomClick = async (room: Room) => {
        if (room.status === 'ENDED') return;
        try {
            await roomApi.join(room.roomId);
            router.push(`/room/${room.roomId}`);
        } catch (e) {
            console.error('Failed to join room:', e);
        }
    };

    const filtered = rooms.filter(r => {
        const matchesTab = activeTab === 'ALL' || r.type === activeTab;
        const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const onlineCount = rooms.filter(r => r.type === 'ONLINE').length;
    const offlineCount = rooms.filter(r => r.type === 'OFFLINE').length;
    const activeCount = rooms.filter(r => r.status === 'ACTIVE').length;

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            {/* Header */}
            <header className="h-14 bg-[var(--header-bg)] border-b border-[var(--border-color)] flex items-center justify-between px-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Link href="/choose">
                        <button className="p-1.5 rounded-md text-[var(--foreground)] opacity-40 hover:opacity-100 hover:bg-[var(--highlight-bg)] transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    </Link>
                    <Link href="/">
                        <img
                            src={theme === 'dark' ? '/dark_logo2.png' : '/white_logo2.png'}
                            alt="Motiveet"
                            className="h-7 w-auto object-contain"
                        />
                    </Link>
                    {currentFolder && (
                        <>
                            <span className="text-[var(--foreground)] opacity-20">/</span>
                            <span className="text-sm font-semibold text-[var(--foreground)]">{currentFolder.name}</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-md hover:bg-[var(--highlight-bg)] transition-colors text-[var(--foreground)] opacity-50 hover:opacity-100"
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
            </header>

            {/* Body */}
            <main className="max-w-6xl mx-auto px-8 py-8 flex gap-8">
                {/* Left — meeting list */}
                <div className="flex-1 min-w-0">
                    {/* Top bar */}
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h1 className="text-xl font-bold text-[var(--foreground)]">
                                {currentFolder?.name ?? '회의실'}
                            </h1>
                            {currentFolder?.description && (
                                <p className="text-xs text-[var(--foreground)] opacity-40 mt-0.5">{currentFolder.description}</p>
                            )}
                        </div>
                        <button
                            onClick={() => setShowTypeModal(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            새 회의
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative mb-4">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground)] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="회의록 검색"
                            className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder-[var(--foreground)] placeholder-opacity-25"
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mb-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-1 w-fit">
                        {(['ALL', 'ONLINE', 'OFFLINE'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === tab
                                        ? tab === 'ONLINE'
                                            ? 'bg-indigo-600 text-white'
                                            : tab === 'OFFLINE'
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-[var(--foreground)] text-[var(--background)]'
                                        : 'text-[var(--foreground)] opacity-40 hover:opacity-70'
                                }`}
                            >
                                {tab === 'ALL' ? '전체' : tab === 'ONLINE' ? '온라인' : '오프라인'}
                                <span className="ml-1.5 opacity-70">
                                    {tab === 'ALL' ? rooms.length : tab === 'ONLINE' ? onlineCount : offlineCount}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Room list */}
                    {isLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="animate-pulse h-16 bg-[var(--card-bg)] rounded-xl" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-[var(--foreground)] opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p className="text-sm text-[var(--foreground)] opacity-30 mb-1">
                                {search ? '검색 결과가 없습니다' : '아직 회의실이 없습니다'}
                            </p>
                            {!search && (
                                <p className="text-xs text-[var(--foreground)] opacity-20">
                                    위의 &ldquo;새 회의&rdquo; 버튼을 눌러 첫 회의를 시작하세요
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map(room => (
                                <MeetingRow
                                    key={room.roomId}
                                    room={room}
                                    onClick={() => handleRoomClick(room)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right panel */}
                <div className="w-72 flex-shrink-0 space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
                            <p className="text-xs text-[var(--foreground)] opacity-40 mb-1">전체 회의</p>
                            <p className="text-2xl font-bold text-[var(--foreground)]">{rooms.length}</p>
                        </div>
                        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
                            <p className="text-xs text-emerald-500 mb-1">진행 중</p>
                            <p className="text-2xl font-bold text-emerald-500">{activeCount}</p>
                        </div>
                    </div>

                    {/* Calendar */}
                    <CalendarWidget />

                    {/* Quick actions */}
                    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
                        <p className="text-xs font-semibold text-[var(--foreground)] opacity-40 mb-3 uppercase tracking-wider">빠른 시작</p>
                        <div className="space-y-2">
                            <button
                                onClick={() => setShowTypeModal(true)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-indigo-500/10 border border-transparent hover:border-indigo-400/30 transition-all group"
                            >
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                                    </svg>
                                </div>
                                <span className="text-sm text-[var(--foreground)] opacity-60 group-hover:opacity-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">온라인 회의 시작</span>
                            </button>
                            <button
                                onClick={() => setShowTypeModal(true)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-emerald-500/10 border border-transparent hover:border-emerald-400/30 transition-all group"
                            >
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </div>
                                <span className="text-sm text-[var(--foreground)] opacity-60 group-hover:opacity-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">오프라인 회의 시작</span>
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Type selection modal */}
            {showTypeModal && (
                <MeetingTypeModal
                    onClose={() => setShowTypeModal(false)}
                    onSelect={(type) => {
                        setShowTypeModal(false);
                        setPendingRoomType(type);
                    }}
                />
            )}

            {/* Create modal */}
            {pendingRoomType && (
                <MeetingCreateModal
                    folderId={folderId}
                    roomType={pendingRoomType}
                    onClose={() => setPendingRoomType(null)}
                    onCreated={handleRoomCreated}
                />
            )}
        </div>
    );
}
