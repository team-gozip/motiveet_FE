'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../common/ThemeProvider';
import Input from '../common/Input';
import Button from '../common/Button';
import { authApi, setTokens } from '@/lib/api';

export default function LoginForm() {
    const { theme } = useTheme();
    const router = useRouter();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
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
        <div className="w-full max-w-md mx-auto">
            <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl p-10 border border-[var(--border-color)]">
                <div className="flex justify-center mb-8">
                    <img
                        src={theme === 'dark' ? '/white_logo1.png' : '/dark_logo1.png'}
                        alt="Motiveet Logo"
                        className="h-20 w-auto object-contain transition-transform duration-300 hover:scale-105"
                    />
                </div>
                <h2 className="text-2xl font-bold text-center mb-2 text-[var(--foreground)] tracking-tight">
                    다시 오신 것을 환영해요
                </h2>
                <p className="text-sm text-[var(--text-secondary)] text-center mb-8">
                    계정에 로그인하여 회의를 시작하세요
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <Input
                        label="아이디"
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="아이디를 입력하세요"
                        autoComplete="username"
                    />

                    <Input
                        label="비밀번호"
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="비밀번호를 입력하세요"
                        autoComplete="current-password"
                    />

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <p className="text-sm text-[var(--danger)] text-center font-medium">{error}</p>
                        </div>
                    )}

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full mt-4"
                        disabled={isLoading}
                    >
                        {isLoading ? '로그인 중...' : '로그인'}
                    </Button>

                    <p className="text-center text-sm text-[var(--text-secondary)]">
                        계정이 없으신가요?{' '}
                        <a href="/signup" className="text-[var(--accent-primary)] hover:underline font-semibold transition-colors">
                            회원가입
                        </a>
                    </p>
                </form>
            </div>
        </div>
    );
}
