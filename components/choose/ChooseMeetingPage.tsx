'use client';

import { useState, useEffect } from 'react';
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

export default function ChooseMeetingPage() {
    const router = useRouter();
    const { setCurrentFolder } = useFolder();
    const { theme, toggleTheme } = useTheme();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

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
            <header className="h-14 bg-[var(--header-bg)] border-b border-[var(--border-color)] flex items-center justify-between px-6 sticky top-0 z-10">
                <Link href="/">
                    <img
                        src={theme === 'dark' ? '/dark_logo2.png' : '/white_logo2.png'}
                        alt="Motiveet"
                        className="h-7 w-auto object-contain"
                    />
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-3 py-1.5 text-xs font-medium text-[var(--foreground)] opacity-50 hover:opacity-100 hover:bg-[var(--highlight-bg)] rounded-md transition-all"
                    >
                        개인 회의
                    </button>
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
                    <button
                        onClick={logout}
                        className="px-3 py-1.5 text-xs text-[var(--foreground)] opacity-50 hover:opacity-100 hover:bg-[var(--highlight-bg)] rounded-md transition-all"
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
                        <p className="text-sm text-[var(--foreground)] opacity-40 mt-1">참여할 그룹을 선택하거나 새 그룹을 만들어 회의를 시작하세요</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="animate-pulse">
                                <div className="w-full aspect-video bg-[var(--card-bg)] rounded-xl mb-3" />
                                <div className="h-3 bg-[var(--card-bg)] rounded-full w-2/3" />
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
                            <div className="w-full aspect-video rounded-xl border-2 border-dashed border-[var(--border-color)] group-hover:border-indigo-400/60 group-hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center gap-2 mb-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--highlight-bg)] group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 flex items-center justify-center transition-colors">
                                    <span className="text-xl font-light text-[var(--foreground)] opacity-30 group-hover:opacity-70 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-none">+</span>
                                </div>
                            </div>
                            <p className="text-sm font-medium text-[var(--foreground)] opacity-40 group-hover:opacity-70 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors px-0.5">
                                새 그룹 만들기
                            </p>
                        </div>
                    </div>
                )}

                {!isLoading && folders.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-sm text-[var(--foreground)] opacity-30 mb-1">
                            아직 속한 그룹이 없습니다
                        </p>
                        <p className="text-xs text-[var(--foreground)] opacity-20">
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
        </div>
    );
}
