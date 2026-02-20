import { getAccessToken, clearTokens } from './api';

export const isAuthenticated = (): boolean => {
    return !!getAccessToken();
};

export const logout = (): void => {
    clearTokens();
    if (typeof window !== 'undefined') {
        window.location.href = '/login';
    }
};

export const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (password.length < 8) {
        return { valid: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' };
    }

    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    if (!specialCharRegex.test(password)) {
        return { valid: false, error: '비밀번호는 최소 1개의 특수문자를 포함해야 합니다.' };
    }

    return { valid: true };
};

export const passwordsMatch = (password: string, confirmPassword: string): boolean => {
    return password === confirmPassword;
};
