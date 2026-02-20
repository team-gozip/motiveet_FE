'use client';

import Link from 'next/link';
import { useTheme } from '../common/ThemeProvider';

export default function AuthHeader() {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="sticky top-0 z-50 bg-[var(--header-bg)]/80 backdrop-blur-md border-b border-[var(--border-color)] shadow-sm transition-all duration-300">
            <div className="px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2 group">
                    <img
                        src={theme === 'dark' ? '/white_logo2.png' : '/dark_logo2.png'}
                        alt="Motiveet"
                        className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
                    />
                </Link>

                <nav className="flex items-center space-x-4">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full hover:bg-[var(--highlight-bg)] transition-colors text-[var(--foreground)]"
                        title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5 text-yellow-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>
                    <Link
                        href="/login"
                        className="text-sm font-bold text-[var(--foreground)] opacity-60 hover:opacity-100 transition-opacity"
                    >
                        로그인
                    </Link>
                    <Link
                        href="/signup"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-full transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95"
                    >
                        시작하기
                    </Link>
                </nav>
            </div>
        </header>
    );
}
