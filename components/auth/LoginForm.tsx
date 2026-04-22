'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../common/ThemeProvider';
import { authApi, setTokens } from '@/lib/api';

export default function LoginForm() {
    const { theme } = useTheme();
    const router = useRouter();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!formData.username.trim() || !formData.password.trim()) {
            setError('아이디와 비밀번호를 입력해주세요.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await authApi.signin({
                username: formData.username,
                password: formData.password,
            });

            if (response.success) {
                setTokens(response.accessToken, response.refreshToken);
                router.push('/choose');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '로그인에 실패했습니다.';
            if (errorMessage === 'INVALID_CREDENTIALS') {
                setError('비밀번호 혹은 아이디가 다릅니다.');
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[360px]">
            <div className="flex flex-col items-center mb-10">
                <img
                    src={theme === 'dark' ? '/white_logo1.png' : '/dark_logo1.png'}
                    alt="Motiveet"
                    className="h-12 w-auto object-contain mb-6 opacity-90"
                />
                <h1 className="text-[22px] font-semibold text-[var(--foreground)] tracking-tight">
                    로그인
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1.5">
                    계정에 로그인하여 회의를 시작하세요
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label htmlFor="username" className="block text-xs font-medium text-[var(--text-secondary)]">
                        아이디
                    </label>
                    <input
                        id="username"
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="아이디"
                        autoComplete="username"
                        className="w-full h-10 px-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all"
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-xs font-medium text-[var(--text-secondary)]">
                        비밀번호
                    </label>
                    <input
                        id="password"
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="비밀번호"
                        autoComplete="current-password"
                        className="w-full h-10 px-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all"
                    />
                </div>

                {error && (
                    <p className="text-xs text-[var(--danger)] pl-0.5">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                >
                    {isLoading ? '로그인 중...' : '로그인'}
                </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[var(--border-color)] text-center">
                <p className="text-sm text-[var(--text-secondary)]">
                    계정이 없으신가요?{' '}
                    <a href="/signup" className="text-[var(--accent-primary)] hover:underline font-medium">
                        회원가입
                    </a>
                </p>
            </div>
        </div>
    );
}
