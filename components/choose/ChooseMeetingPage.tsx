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

interface Folder {
    folderId: number;
    name: string;
    description: string | null;
    createdAt: string;
}

// ── 코드로 참여 모달 ─────────────────────────────────────────────────

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-base font-bold text-[var(--foreground)]">초대 코드로 참여</h2>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">9자리 초대 코드를 입력하세요</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--highlight-bg)] text-[var(--text-tertiary)] hover:text-[var(--foreground)] transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={code}
                            onChange={handleCodeChange}
                            placeholder="예: ABC123XYZ"
                            className={`w-full bg-[var(--highlight-bg)] border rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-[var(--foreground)] focus:outline-none focus:ring-2 transition-all ${
                                error
                                    ? 'border-[var(--danger)] focus:ring-red-500/30'
                                    : 'border-[var(--border-color)] focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]'
                            }`}
                            maxLength={9}
                            autoComplete="off"
                        />
                        {error && <p className="text-xs text-[var(--danger)] mt-1.5 text-center">{error}</p>}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-all"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || code.length !== 9}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
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

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            {/* Header */}
            <header className="h-14 bg-[var(--header-bg)] border-b border-[var(--border-color)] flex items-center justify-between px-6 sticky top-0 z-10 backdrop-blur-xl">
                <Link href="/">
                    <img
                        src={theme === 'dark' ? '/dark_logo2.png' : '/white_logo2.png'}
                        alt="Motiveet"
                        className="h-7 w-auto object-contain"
                    />
                </Link>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] rounded-lg transition-all"
                    >
                        개인 회의
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg hover:bg-[var(--highlight-bg)] transition-all text-[var(--text-secondary)] hover:text-[var(--foreground)]"
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
                        className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all"
                    >
                        로그아웃
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-8 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--foreground)]">그룹 선택</h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">참여할 그룹을 선택하거나 새 그룹을 만들어 회의를 시작하세요</p>
                    </div>
                    <button
                        onClick={() => setShowJoinCode(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--accent-primary)]/30 hover:bg-[var(--highlight-bg)] text-[var(--foreground)] rounded-xl text-sm font-semibold transition-all"
                    >
                        <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        코드로 참여
                    </button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="animate-pulse">
                                <div className="w-full aspect-video bg-[var(--highlight-bg)] rounded-xl mb-3" />
                                <div className="h-3 bg-[var(--highlight-bg)] rounded-full w-2/3" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-6">
                        {folders.map(folder => (
                            <FolderCard
                                key={folder.folderId}
                                folder={folder}
                                onClick={() => handleFolderSelect(folder)}
                            />
                        ))}

                        {/* Create new folder */}
                        <div
                            onClick={() => setShowCreateModal(true)}
                            className="cursor-pointer group select-none"
                        >
                            <div className="w-full aspect-video rounded-xl border-2 border-dashed border-[var(--border-color)] group-hover:border-[var(--accent-primary)]/50 group-hover:bg-[var(--accent-primary)]/5 transition-all flex flex-col items-center justify-center gap-2 mb-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--highlight-bg)] group-hover:bg-[var(--accent-primary)]/10 flex items-center justify-center transition-all">
                                    <span className="text-xl font-light text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors leading-none">+</span>
                                </div>
                            </div>
                            <p className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors px-0.5">
                                새 그룹 만들기
                            </p>
                        </div>
                    </div>
                )}

                {!isLoading && folders.length === 0 && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--highlight-bg)] flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                            아직 속한 그룹이 없습니다
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                            위의 + 버튼을 눌러 첫 그룹을 만들어 보세요
                        </p>
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
        </div>
    );
}
