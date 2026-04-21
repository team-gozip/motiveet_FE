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

const SENSITIVE_ENDPOINTS = new Set(['/auth/signin', '/auth/signup']);

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

    const method = (options.method || 'GET').toUpperCase();
    const url = `${API_BASE_URL}${endpoint}`;

    // ── 요청 로그 ──────────────────────────────────────────────
    console.log(`[API] → ${method} ${endpoint}`);
    if (options.body && !SENSITIVE_ENDPOINTS.has(endpoint) && !(options.body instanceof FormData)) {
        try { console.log('      body:', JSON.parse(options.body as string)); } catch { /* skip */ }
    }

    let response = await fetch(url, { ...options, headers });

    // ── 401 → 토큰 갱신 후 재시도 ─────────────────────────────
    if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
            try {
                const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                });
                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    setTokens(refreshData.accessToken, refreshData.refreshToken);
                    headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
                    response = await fetch(url, { ...options, headers });
                } else {
                    // refresh token도 만료 → 로그아웃
                    clearTokens();
                    if (typeof window !== 'undefined') window.location.href = '/login';
                    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
                }
            } catch (e) {
                clearTokens();
                if (typeof window !== 'undefined') window.location.href = '/login';
                throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
            }
        } else {
            clearTokens();
            if (typeof window !== 'undefined') window.location.href = '/login';
            throw new Error('로그인이 필요합니다.');
        }
    }

    // ── 응답 로그 ──────────────────────────────────────────────
    const ok = response.ok;
    console.log(`[API] ${ok ? '✓' : '✗'} ${method} ${endpoint} → ${response.status}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('      error:', errorData);
        // FastAPI는 'detail' 필드에 에러 메시지를 담는 경우가 많으므로 이를 우선적으로 확인
        const errorMessage = errorData?.error?.message || errorData?.message || errorData?.detail || `요청 실패 (${response.status})`;
        throw new Error(errorMessage);
    }

    return response.json();
}

// ── Auth API ────────────────────────────────────────────────────

export const authApi = {
    signup: async (data: { username: string; password: string }) => {
        return apiCall<{ success: boolean }>('/auth/signup', {
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
            sessionId: number | null;
            title: string;
            startedAt: string;
            endedAt: string | null;
            summary: string | null;
            memo: string | null;
        }>('/meetings/current');
    },

    getMe: async () => {
        return apiCall<{
            meetingId: number;
            chatId: number;
            sessionId: number | null;
            title: string;
            startedAt: string;
            endedAt: string | null;
            summary: string | null;
            memo: string | null;
        }>('/meetings/me');
    },

    getById: async (meetingId: number) => {
        return apiCall<{
            meetingId: number;
            chatId: number;
            sessionId: number | null;
            title: string;
            startedAt: string;
            endedAt: string | null;
            summary: string | null;
            memo: string | null;
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

    start: async (title?: string, roomId?: number) => {
        return apiCall<{
            success: boolean;
            meetingId: number;
            chatId: number;
            sessionId: number | null;
            title: string;
            memo: string | null;
            startedAt: string;
        }>('/meetings/start', {
            method: 'POST',
            body: JSON.stringify({ title, roomId: roomId ?? null }),
        });
    },

    end: async (meetingId: number, memo?: string) => {
        return apiCall<{ success: boolean; endedAt: string; summary?: string }>(`/meetings/${meetingId}/end`, {
            method: 'POST',
            body: JSON.stringify({ memo: memo || null }),
        });
    },

    updateMemo: async (meetingId: number, memo: string | null) => {
        return apiCall<{
            meetingId: number;
            memo: string | null;
        }>(`/meetings/${meetingId}/memo`, {
            method: 'PUT',
            body: JSON.stringify({ memo }),
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
                meetingId: number;
                chatId: number | null;
                text: string;
                createdAt: string;
            } | null;
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

    getHistory: async (cursor?: number, limit: number = 10, meetingId?: number) => {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', String(cursor));
        params.append('limit', String(limit));
        if (meetingId) params.append('meeting_id', String(meetingId));
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
    sendMessage: async (chatId: number, text?: string, image?: string, sessionId?: number | null) => {
        return apiCall<{
            messageId: number;
            chatId: number;
            sessionId: number | null;
            role: 'user' | 'assistant';
            text?: string;
            image?: string;
            timestamp: string;
        }>('/chats/messages', {
            method: 'POST',
            body: JSON.stringify({ chatId, sessionId: sessionId ?? null, role: 'user', text, image }),
        });
    },

    getAnswer: async (messageId: number) => {
        return apiCall<{
            messageId: number;
            chatId: number;
            sessionId: number | null;
            role: 'assistant';
            text: string;
            image?: string;
            timestamp: string;
        }>(`/chats/messages/${messageId}/answer`, {
            method: 'POST',
        });
    },

    getHistory: async (chatId: number, cursor?: number, limit: number = 50, sessionId?: number | null) => {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', String(cursor));
        params.append('limit', String(limit));
        if (sessionId != null) params.append('sessionId', String(sessionId));
        return apiCall<{
            messages: Array<{
                messageId: number;
                chatId: number;
                sessionId: number | null;
                role: 'user' | 'assistant';
                text?: string;
                image?: string;
                timestamp: string;
            }>;
        }>(`/chats/${chatId}/messages?${params}`);
    },

    requestResearch: async (chatId: number, topic: string, sessionId?: number | null) => {
        return apiCall<{
            messageId: number;
            chatId: number;
            sessionId: number | null;
            role: 'user' | 'assistant';
            text?: string;
            image?: string;
            timestamp: string;
        }>('/chats/messages', {
            method: 'POST',
            body: JSON.stringify({ chatId, sessionId: sessionId ?? null, role: 'user', text: `${topic} 찾아줘` }),
        });
    },
};

// ── Folder API ──────────────────────────────────────────────────

export const folderApi = {
    list: async (cursor?: number, limit = 20) => {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', String(cursor));
        params.append('limit', String(limit));
        return apiCall<{
            items: Array<{ folderId: number; name: string; description: string | null; createdAt: string }>;
            nextCursor: number | null;
        }>(`/folders?${params}`);
    },

    create: async (name: string, description?: string) => {
        return apiCall<{ folderId: number; name: string; description: string | null; createdAt: string }>('/folders', {
            method: 'POST',
            body: JSON.stringify({ name, description: description || null }),
        });
    },

    joinByCode: async (code: string) => {
        return apiCall<{ folderId: number; name: string; alreadyMember: boolean }>('/folders/join-by-code', {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
    },

    getInviteCode: async (folderId: number) => {
        return apiCall<{ inviteCode: string }>(`/folders/${folderId}/invite-code`);
    },

    getMembers: async (folderId: number) => {
        return apiCall<{
            members: Array<{ userId: number; username: string | null; name: string | null }>;
        }>(`/folders/${folderId}/members`);
    },
};

// ── Room API ────────────────────────────────────────────────────

export const roomApi = {
    list: async (folderId: number, cursor?: number, limit = 20) => {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', String(cursor));
        params.append('limit', String(limit));
        return apiCall<{
            items: Array<{
                roomId: number;
                name: string;
                type: 'ONLINE' | 'OFFLINE';
                status: 'WAITING' | 'ACTIVE' | 'ENDED';
                activeMeetingId: number | null;
                createdAt: string;
            }>;
            nextCursor: number | null;
        }>(`/folders/${folderId}/rooms?${params}`);
    },

    create: async (folderId: number, name: string, type: 'ONLINE' | 'OFFLINE') => {
        return apiCall<{
            roomId: number;
            folderId: number;
            name: string;
            type: 'ONLINE' | 'OFFLINE';
            status: string;
            createdAt: string;
        }>('/rooms', {
            method: 'POST',
            body: JSON.stringify({ folderId, name, type }),
        });
    },

    getById: async (roomId: number) => {
        return apiCall<{
            roomId: number;
            folderId: number;
            name: string;
            type: 'ONLINE' | 'OFFLINE';
            status: string;
            hostId: number;
            controllerId: number | null;
            note: string | null;
            summary: string | null;
            transcript: string | null;
            activeMeetingId: number | null;
            activeChatId: number | null;
            activeSessionId: number | null;
            fallbackSessionId: number | null;
            fallbackChatId: number | null;
            lastChatId: number | null;
            lastSessionId: number | null;
            activeParticipantCount: number;
            createdAt: string;
        }>(`/rooms/${roomId}`);
    },

    setActiveMeeting: async (
        roomId: number,
        meetingId: number | null,
        chatId: number | null,
        summary?: string | null,
        sessionId?: number | null,
    ) => {
        return apiCall<{ success: boolean }>(`/rooms/${roomId}/active-meeting`, {
            method: 'POST',
            body: JSON.stringify({ meetingId, chatId, sessionId: sessionId ?? null, summary: summary ?? null }),
        });
    },

    join: async (roomId: number) => {
        return apiCall<{ roomId: number; role: string }>(`/rooms/${roomId}/join`, {
            method: 'POST',
        });
    },

    leave: async (roomId: number) => {
        return apiCall<{ message: string }>(`/rooms/${roomId}/leave`, {
            method: 'POST',
        });
    },

    heartbeat: async (roomId: number) => {
        return apiCall<{ ok: boolean }>(`/rooms/${roomId}/heartbeat`, {
            method: 'POST',
        });
    },

    end: async (roomId: number) => {
        return apiCall<{ success: boolean }>(`/rooms/${roomId}/end`, {
            method: 'POST',
        });
    },

    delete: async (roomId: number) => {
        return apiCall<{ success: boolean }>(`/rooms/${roomId}`, {
            method: 'DELETE',
        });
    },

    assignController: async (roomId: number, userId: number) => {
        return apiCall<{ controllerId: number }>(`/rooms/${roomId}/controller`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        });
    },

    setMicState: async (roomId: number, userId: number, muted: boolean) => {
        return apiCall<{ userId: number; muted: boolean }>(`/rooms/${roomId}/mic`, {
            method: 'POST',
            body: JSON.stringify({ userId, muted }),
        });
    },

    updateNotes: async (roomId: number, content: string) => {
        return apiCall<{ roomId: number; content: string; updatedAt: string }>(`/rooms/${roomId}/notes`, {
            method: 'PUT',
            body: JSON.stringify({ content }),
        });
    },

    uploadAudio: async (roomId: number, audioBlob: Blob) => {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        return apiCall<{ success: boolean; text: string }>(`/rooms/${roomId}/audio`, {
            method: 'POST',
            body: formData,
        });
    },

    invite: async (roomId: number, userIds: number[]) => {
        return apiCall<{ success: boolean; invitedCount: number }>(`/rooms/${roomId}/invite`, {
            method: 'POST',
            body: JSON.stringify({ userIds }),
        });
    },

};

// ── Notification API ───────────────────────────────────────────

export const notificationApi = {
    list: async () => {
        return apiCall<{
            items: Array<{
                id: number;
                type: string;
                title: string;
                body: string | null;
                roomId: number | null;
                isRead: boolean;
                createdAt: string;
            }>;
        }>('/notifications');
    },

    markRead: async (id: number) => {
        return apiCall<{ success: boolean }>(`/notifications/${id}/read`, {
            method: 'POST',
        });
    },

    markAllRead: async () => {
        return apiCall<{ success: boolean }>('/notifications/read-all', {
            method: 'POST',
        });
    },

    unreadCount: async () => {
        return apiCall<{ count: number }>('/notifications/unread-count');
    },
};
