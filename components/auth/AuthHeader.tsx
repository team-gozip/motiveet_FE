'use client';

import Link from 'next/link';
import { useTheme } from '../common/ThemeProvider';

export default function AuthHeader() {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="h-14 border-b border-[var(--border-color)] bg-[var(--header-bg)]">
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
                        onClick={toggleTheme}
                        className="p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                        aria-label="테마 전환"
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
                    <Link
                        href="/login"
                        className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                    >
                        로그인
                    </Link>
                    <Link
                        href="/signup"
                        className="ml-1 px-3.5 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-md transition-colors"
                    >
                        시작하기
                    </Link>
                </div>
            </div>
        </header>
    );
}
