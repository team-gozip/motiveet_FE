'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, setTokens } from '@/lib/api';
import { validatePassword, passwordsMatch } from '@/lib/auth';

export default function SignupForm() {
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
        { name: 'username', label: '아이디', type: 'text', placeholder: '아이디 입력', autoComplete: 'username' },
        { name: 'password', label: '비밀번호', type: 'password', placeholder: '비밀번호 입력', autoComplete: 'new-password' },
        { name: 'confirmPassword', label: '비밀번호 확인', type: 'password', placeholder: '비밀번호 다시 입력', autoComplete: 'new-password' },
    ];

    return (
        <div className="w-full max-w-[360px]">
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-10">
                회원가입
            </h1>

            <form onSubmit={handleSubmit} className="space-y-5">
                {fields.map(f => (
                    <div key={f.name}>
                        <label htmlFor={f.name} className="block text-sm text-[var(--foreground)] mb-2">
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
                            className={`w-full h-11 bg-transparent border-0 border-b text-[15px] text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none transition-colors ${
                                errors[f.name]
                                    ? 'border-[var(--danger)] focus:border-[var(--danger)]'
                                    : 'border-[var(--border-color)] focus:border-[var(--accent-primary)]'
                            }`}
                        />
                        {errors[f.name] && (
                            <p className="text-xs text-[var(--danger)] mt-2">{errors[f.name]}</p>
                        )}
                    </div>
                ))}

                {errors.submit && (
                    <p className="text-xs text-[var(--danger)]">{errors.submit}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md transition-colors mt-3"
                >
                    {isLoading ? '처리 중...' : '가입하기'}
                </button>
            </form>

            <p className="mt-8 text-sm text-[var(--text-secondary)]">
                이미 계정이 있으신가요?{' '}
                <a href="/login" className="text-[var(--accent-primary)] hover:underline">
                    로그인
                </a>
            </p>
        </div>
    );
}
