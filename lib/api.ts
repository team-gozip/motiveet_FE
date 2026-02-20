const API_BASE_URL = '/api';

// ── Token Management ────────────────────────────────────────────

export const getAccessToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
};

export const getRefreshToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
};

export const setTokens = (accessToken: string, refreshToken: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
};

export const clearTokens = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
};

// ── Core Fetch Wrapper ──────────────────────────────────────────

async function apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getAccessToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // FormData인 경우 Content-Type 헤더 제거 (브라우저가 자동 설정)
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // FastAPI는 'detail' 필드에 에러 메시지를 담는 경우가 많으므로 이를 우선적으로 확인
        const errorMessage = errorData?.error?.message || errorData?.message || errorData?.detail || `요청 실패 (${response.status})`;
        throw new Error(errorMessage);
    }

    return response.json();
}

// ── Auth API ────────────────────────────────────────────────────

export const authApi = {
    signup: async (data: { username: string; password: string }) => {
        return apiCall<{ success: boolean; userId: number }>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    signin: async (data: { username: string; password: string }) => {
        return apiCall<{ success: boolean; accessToken: string; refreshToken: string }>('/auth/signin', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    logout: async () => {
        const result = await apiCall<{ success: boolean }>('/auth/logout', {
            method: 'POST',
        });
        clearTokens();
        return result;
    },
};

// ── Meeting API ─────────────────────────────────────────────────

export const meetingApi = {
    getCurrent: async () => {
        return apiCall<{
            meetingId: number;
            chatId: number;
            title: string;
            startedAt: string;
            endedAt: string | null;
            summary: string | null;
        }>('/meetings/current');
    },

    getMe: async () => {
        return apiCall<{
            meetingId: number;
            chatId: number;
            title: string;
            startedAt: string;
            endedAt: string | null;
            summary: string | null;
        }>('/meetings/me');
    },

    getById: async (meetingId: number) => {
        return apiCall<{
            meetingId: number;
            chatId: number;
            title: string;
            startedAt: string;
            endedAt: string | null;
            summary: string | null;
        }>(`/meetings/${meetingId}`);
    },

    getHistory: async (cursor?: number, limit: number = 10) => {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', String(cursor));
        params.append('limit', String(limit));
        return apiCall<{
            meetings: Array<{
                meetingId: number;
                title: string;
                startedAt: string;
                endedAt: string | null;
            }>;
            nextCursor: number | null;
        }>(`/meetings?${params}`);
    },

    start: async (title?: string) => {
        return apiCall<{
            success: boolean;
            meetingId: number;
            chatId: number;
            title: string;
            startedAt: string;
        }>('/meetings/start', {
            method: 'POST',
            body: JSON.stringify({ title }),
        });
    },

    end: async (meetingId: number, memo?: string) => {
        return apiCall<{ success: boolean; summary?: string }>(`/meetings/${meetingId}/end`, {
            method: 'POST',
            body: JSON.stringify({ memo: memo || null }),
        });
    },

    delete: async (meetingId: number) => {
        return apiCall<{ success: boolean }>(`/meetings/${meetingId}`, {
            method: 'DELETE',
        });
    },

    uploadAudio: async (meetingId: number, audioBlob: Blob) => {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        return apiCall<{
            success: boolean;
            subject: {
                subjectId: number;
                chatId: number;
                text: string;
                files: string[];
            };
            suggestions?: string[];
            summary?: string;
            transcript?: string;
            timestamp?: string;
            newTopics?: string[];
        }>(`/meetings/${meetingId}/audio`, {
            method: 'POST',
            body: formData,
        });
    },
};

// ── Subject API ─────────────────────────────────────────────────

export const subjectApi = {
    getCurrent: async (meetingId: number) => {
        return apiCall<{
            subject: {
                subjectId: number;
                meetingId: number;
                chatId: number;
                text: string;
                createdAt: string;
            } | null;
            suggestions: string[];
            summary?: string;
        }>(`/meetings/${meetingId}/subject`);
    },

    update: async (subjectId: number, text: string) => {
        return apiCall<{
            subjectId: number;
            meetingId: number;
            text: string;
            createdAt: string;
        }>(`/subjects/${subjectId}`, {
            method: 'PUT',
            body: JSON.stringify({ text }),
        });
    },

    create: async (meetingId: number, text: string) => {
        return apiCall<{
            subjectId: number;
            meetingId: number;
            chatId: number;
            text: string;
            createdAt: string;
        }>('/subjects', {
            method: 'POST',
            body: JSON.stringify({ meetingId, text }),
        });
    },

    select: async (meetingId: number, text: string) => {
        return apiCall<{
            subjectId: number;
            meetingId: number;
            chatId: number;
            text: string;
            createdAt: string;
        }>('/subjects/select', {
            method: 'POST',
            body: JSON.stringify({ meetingId, text }),
        });
    },

    getHistory: async (cursor?: number, limit: number = 10) => {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', String(cursor));
        params.append('limit', String(limit));
        return apiCall<{
            subjects: Array<{
                subjectId: number;
                text: string;
                meetingId: number;
                chatId: number;
                createdAt: string;
            }>;
            nextCursor: number | null;
        }>(`/subjects?${params}`);
    },

    delete: async (subjectId: number) => {
        return apiCall<{ success: boolean }>(`/subjects/${subjectId}`, {
            method: 'DELETE',
        });
    },
};

// ── Chat API ────────────────────────────────────────────────────

export const chatApi = {
    sendMessage: async (chatId: number, text?: string, image?: string) => {
        return apiCall<{
            messageId: number;
            chatId: number;
            role: 'user' | 'assistant';
            text?: string;
            image?: string;
            timestamp: string;
        }>('/chats/messages', {
            method: 'POST',
            body: JSON.stringify({ chatId, role: 'user', text, image }),
        });
    },

    getAnswer: async (messageId: number) => {
        return apiCall<{
            messageId: number;
            chatId: number;
            role: 'assistant';
            text: string;
            image?: string;
            timestamp: string;
        }>(`/chats/messages/${messageId}/answer`, {
            method: 'POST',
        });
    },

    getHistory: async (chatId: number, cursor?: number, limit: number = 50) => {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', String(cursor));
        params.append('limit', String(limit));
        return apiCall<{
            messages: Array<{
                messageId: number;
                chatId: number;
                role: 'user' | 'assistant';
                text?: string;
                image?: string;
                timestamp: string;
            }>;
        }>(`/chats/${chatId}/messages?${params}`);
    },

    requestResearch: async (chatId: number, topic: string) => {
        return apiCall<{
            messageId: number;
            chatId: number;
            role: 'user' | 'assistant';
            text?: string;
            image?: string;
            timestamp: string;
        }>('/chats/messages', {
            method: 'POST',
            body: JSON.stringify({ chatId, role: 'user', text: `${topic} 찾아줘` }),
        });
    },
};
