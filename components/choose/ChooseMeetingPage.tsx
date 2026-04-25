'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { folderApi } from '@/lib/api';
import { isAuthenticated, logout } from '@/lib/auth';
import { useFolder } from '@/components/providers/FolderProvider';
import { useTheme } from '@/components/common/ThemeProvider';
import FolderCard from './FolderCard';
import CreateFolderModal from './CreateFolderModal';
import EditFolderModal from './EditFolderModal';

interface Folder {
    folderId: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
    createdAt: string;
    isOwner: boolean;
}

function JoinByCodeModal({ onClose, onJoin }: { onClose: () => void; onJoin: () => void }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = code.trim().toUpperCase();
        if (trimmed.length !== 9) {
            setError('9자리 코드를 입력해주세요');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await folderApi.joinByCode(trimmed);
            onJoin();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '유효하지 않은 초대 코드입니다');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
        setCode(val);
        setError('');
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-lg w-full max-w-md">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">초대 코드로 참여</h3>
                    <button onClick={onClose} className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="px-5 py-5 space-y-3">
                        <p className="text-xs text-[var(--text-secondary)]">
                            그룹 관리자에게 받은 9자리 초대 코드를 입력하세요.
                        </p>
                        <input
                            ref={inputRef}
                            type="text"
                            value={code}
                            onChange={handleCodeChange}
                            placeholder="ABC123XYZ"
                            className={`w-full h-12 px-3 bg-[var(--background)] border rounded-md text-center text-lg font-mono font-semibold tracking-[0.3em] text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:ring-2 transition-all ${
                                error
                                    ? 'border-[var(--danger)] focus:ring-red-500/30'
                                    : 'border-[var(--border-color)] focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50'
                            }`}
                            maxLength={9}
                            autoComplete="off"
                        />
                        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
                    </div>
                    <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[var(--highlight-bg)] border-t border-[var(--border-color)] rounded-b-xl">
                        <button type="button" onClick={onClose} className="h-8 px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors">
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || code.length !== 9}
                            className="h-8 px-3.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-md text-sm font-medium transition-colors"
                        >
                            {isLoading ? '참여 중...' : '참여하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ChooseMeetingPage() {
    const router = useRouter();
    const { setCurrentFolder } = useFolder();
    const { theme, toggleTheme } = useTheme();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinCode, setShowJoinCode] = useState(false);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push('/login');
            return;
        }
        loadFolders();
    }, [router]);

    const loadFolders = async () => {
        setIsLoading(true);
        try {
            const resp = await folderApi.list();
            setFolders(resp.items);
        } catch (e) {
            console.error('Failed to load folders:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFolderSelect = (folder: Folder) => {
        setCurrentFolder(folder);
        router.push(`/folder/${folder.folderId}`);
    };

    const handleFolderCreated = (folder: Folder) => {
        setFolders(prev => [folder, ...prev]);
        setShowCreateModal(false);
    };

    const handleFolderUpdated = (updated: Folder) => {
        setFolders(prev => prev.map(f => f.folderId === updated.folderId ? updated : f));
        setEditingFolder(null);
    };

    const handleFolderDeleted = (folderId: number) => {
        setFolders(prev => prev.filter(f => f.folderId !== folderId));
        setEditingFolder(null);
    };

    const filtered = search.trim()
        ? folders.filter(f =>
            f.name.toLowerCase().includes(search.toLowerCase()) ||
            (f.description ?? '').toLowerCase().includes(search.toLowerCase())
        )
        : folders;

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            {/* Header */}
            <header className="h-14 bg-[var(--header-bg)] border-b border-[var(--border-color)] sticky top-0 z-10">
                <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
                    <Link href="/" className="flex items-center">
                        <img
                            src={theme === 'dark' ? '/dark_logo2.png' : '/white_logo2.png'}
                            alt="Motiveet"
                            className="h-6 w-auto object-contain"
                        />
                    </Link>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="h-8 px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] rounded-md transition-colors"
                        >
                            개인 회의
                        </button>
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
                        <button
                            onClick={logout}
                            className="h-8 px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--highlight-bg)] rounded-md transition-colors"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-10">
                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">그룹</h1>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                        참여할 그룹을 선택하거나, 새 그룹을 만들어 회의를 시작하세요.
                    </p>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 mb-6">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="그룹 검색"
                            className="w-full h-9 pl-9 pr-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]/40 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowJoinCode(true)}
                        className="h-9 px-3 bg-[var(--card-bg)] hover:bg-[var(--highlight-bg)] border border-[var(--border-color)] text-[var(--foreground)] rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        코드로 참여
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="h-9 px-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        새 그룹
                    </button>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-[152px] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-[var(--border-color)] rounded-lg">
                        <div className="w-12 h-12 rounded-full bg-[var(--highlight-bg)] flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                            {search ? '검색 결과가 없습니다' : '아직 속한 그룹이 없습니다'}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                            {search ? '다른 검색어를 시도해보세요' : '"새 그룹" 버튼을 눌러 첫 그룹을 만들어 보세요'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(folder => (
                            <FolderCard
                                key={folder.folderId}
                                folder={folder}
                                onClick={() => handleFolderSelect(folder)}
                                onEdit={folder.isOwner ? () => setEditingFolder(folder) : undefined}
                            />
                        ))}
                    </div>
                )}
            </main>

            {showCreateModal && (
                <CreateFolderModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handleFolderCreated}
                />
            )}

            {showJoinCode && (
                <JoinByCodeModal
                    onClose={() => setShowJoinCode(false)}
                    onJoin={() => {
                        setShowJoinCode(false);
                        loadFolders();
                    }}
                />
            )}

            {editingFolder && (
                <EditFolderModal
                    folder={editingFolder}
                    onClose={() => setEditingFolder(null)}
                    onUpdated={handleFolderUpdated}
                    onDeleted={handleFolderDeleted}
                />
            )}
        </div>
    );
}
