'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../common/ThemeProvider';
import Input from '../common/Input';
import Button from '../common/Button';
import { authApi, setTokens } from '@/lib/api';
import { validatePassword, passwordsMatch } from '@/lib/auth';

export default function SignupForm() {
    const { theme } = useTheme();
    const router = useRouter();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.username.trim()) {
            newErrors.username = '아이디를 입력해주세요.';
        }

        const passwordValidation = validatePassword(formData.password);
        if (!passwordValidation.valid) {
            newErrors.password = passwordValidation.error || '';
        }

        if (!passwordsMatch(formData.password, formData.confirmPassword)) {
            newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsLoading(true);
        try {
            const response = await authApi.signup({
                username: formData.username,
                password: formData.password,
            });

            if (response.success) {
                // Auto-login after successful signup
                const loginResponse = await authApi.signin({
                    username: formData.username,
                    password: formData.password,
                });

                if (loginResponse.success) {
                    setTokens(loginResponse.accessToken, loginResponse.refreshToken);
                    router.push('/meeting');
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '회원가입에 실패했습니다.';

            if (errorMessage === 'USER_EXISTS') {
                setErrors({
                    submit: '이미 가입된 아이디입니다. 로그인 페이지로 이동합니다...',
                });
                // 2초 후 로그인 페이지로 이동
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            } else {
                setErrors({
                    submit: errorMessage,
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-[var(--card-bg)] rounded-3xl shadow-2xl p-10 border border-[var(--border-color)] backdrop-blur-sm">
                <div className="flex justify-center mb-8">
                    <img
                        src={theme === 'dark' ? '/white_logo1.png' : '/dark_logo1.png'}
                        alt="Motiveet Logo"
                        className="h-20 w-auto object-contain transition-transform duration-300 hover:scale-105"
                    />
                </div>
                <h2 className="text-2xl font-bold text-center mb-8 text-[var(--foreground)] tracking-tight">
                    회원가입
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <Input
                        label="아이디"
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        error={errors.username}
                        placeholder="아이디를 입력하세요"
                        autoComplete="username"
                    />

                    <Input
                        label="비밀번호"
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        error={errors.password}
                        placeholder="8자 이상, 특수문자 1개 이상"
                        autoComplete="new-password"
                    />

                    <Input
                        label="비밀번호 확인"
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        error={errors.confirmPassword}
                        placeholder="비밀번호를 다시 입력하세요"
                        autoComplete="new-password"
                    />

                    {errors.submit && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-sm text-red-500 text-center">{errors.submit}</p>
                        </div>
                    )}

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full mt-4"
                        disabled={isLoading}
                    >
                        {isLoading ? '처리 중...' : '가입하기'}
                    </Button>

                    <p className="text-center text-sm text-[var(--foreground)] opacity-60">
                        이미 계정이 있으신가요?{' '}
                        <a href="/login" className="text-blue-500 hover:text-blue-600 hover:underline font-medium transition-colors">
                            로그인
                        </a>
                    </p>
                </form>
            </div>
        </div>
    );
}
