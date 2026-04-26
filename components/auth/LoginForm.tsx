'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, setTokens } from '@/lib/api';

export default function LoginForm() {
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
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-10">
                로그인
            </h1>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="username" className="block text-sm text-[var(--foreground)] mb-2">
                        아이디
                    </label>
                    <input
                        id="username"
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="아이디 입력"
                        autoComplete="username"
                        className="w-full h-11 bg-transparent border-0 border-b border-[var(--border-color)] text-[15px] text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm text-[var(--foreground)] mb-2">
                        비밀번호
                    </label>
                    <input
                        id="password"
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="비밀번호 입력"
                        autoComplete="current-password"
                        className="w-full h-11 bg-transparent border-0 border-b border-[var(--border-color)] text-[15px] text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    />
                </div>

                {error && (
                    <p className="text-xs text-[var(--danger)]">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md transition-colors mt-3"
                >
                    {isLoading ? '로그인 중...' : '로그인'}
                </button>
            </form>

            <p className="mt-8 text-sm text-[var(--text-secondary)]">
                계정이 없으신가요?{' '}
                <a href="/signup" className="text-[var(--accent-primary)] hover:underline">
                    회원가입
                </a>
            </p>
        </div>
    );
}
