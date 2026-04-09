'use client';

import Link from 'next/link';
import { useTheme } from '../common/ThemeProvider';

export default function AuthHeader() {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="sticky top-0 z-50 bg-[var(--header-bg)]/80 backdrop-blur-xl border-b border-[var(--border-color)] transition-all duration-300">
            <div className="px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2 group">
                    <img
                        src={theme === 'dark' ? '/dark_logo2.png' : '/white_logo2.png'}
                        alt="Motiveet"
                        className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
                    />
                </Link>

                <nav className="flex items-center space-x-3">
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-xl hover:bg-[var(--highlight-bg)] transition-all text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                        title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>
                    <Link
                        href="/login"
                        className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors px-3 py-2"
                    >
                        로그인
                    </Link>
                    <Link
                        href="/signup"
                        className="px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                    >
                        시작하기
                    </Link>
                </nav>
            </div>
        </header>
    );
}
