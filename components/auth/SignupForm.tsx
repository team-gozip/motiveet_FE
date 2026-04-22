'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../common/ThemeProvider';
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
                const loginResponse = await authApi.signin({
                    username: formData.username,
                    password: formData.password,
                });

                if (loginResponse.success) {
                    setTokens(loginResponse.accessToken, loginResponse.refreshToken);
                    router.push('/choose');
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '회원가입에 실패했습니다.';

            if (errorMessage === 'USER_EXISTS') {
                setErrors({
                    submit: '이미 가입된 아이디입니다. 로그인 페이지로 이동합니다...',
                });
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

    const fields: { name: 'username' | 'password' | 'confirmPassword'; label: string; type: string; placeholder: string; autoComplete: string }[] = [
        { name: 'username', label: '아이디', type: 'text', placeholder: '사용할 아이디', autoComplete: 'username' },
        { name: 'password', label: '비밀번호', type: 'password', placeholder: '8자 이상, 특수문자 1개 이상', autoComplete: 'new-password' },
        { name: 'confirmPassword', label: '비밀번호 확인', type: 'password', placeholder: '비밀번호 다시 입력', autoComplete: 'new-password' },
    ];

    return (
        <div className="w-full max-w-[360px]">
            <div className="flex flex-col items-center mb-10">
                <img
                    src={theme === 'dark' ? '/white_logo1.png' : '/dark_logo1.png'}
                    alt="Motiveet"
                    className="h-12 w-auto object-contain mb-6 opacity-90"
                />
                <h1 className="text-[22px] font-semibold text-[var(--foreground)] tracking-tight">
                    회원가입
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1.5">
                    계정을 만들고 AI 회의 어시스턴트를 시작하세요
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {fields.map(f => (
                    <div key={f.name} className="space-y-1.5">
                        <label htmlFor={f.name} className="block text-xs font-medium text-[var(--text-secondary)]">
                            {f.label}
                        </label>
                        <input
                            id={f.name}
                            type={f.type}
                            name={f.name}
                            value={formData[f.name]}
                            onChange={handleChange}
                            placeholder={f.placeholder}
                            autoComplete={f.autoComplete}
                            className={`w-full h-10 px-3 bg-[var(--card-bg)] border rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all ${
                                errors[f.name] ? 'border-[var(--danger)]' : 'border-[var(--border-color)]'
                            }`}
                        />
                        {errors[f.name] && (
                            <p className="text-xs text-[var(--danger)] pl-0.5">{errors[f.name]}</p>
                        )}
                    </div>
                ))}

                {errors.submit && (
                    <p className="text-xs text-[var(--danger)] pl-0.5">{errors.submit}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                >
                    {isLoading ? '처리 중...' : '가입하기'}
                </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[var(--border-color)] text-center">
                <p className="text-sm text-[var(--text-secondary)]">
                    이미 계정이 있으신가요?{' '}
                    <a href="/login" className="text-[var(--accent-primary)] hover:underline font-medium">
                        로그인
                    </a>
                </p>
            </div>
        </div>
    );
}
