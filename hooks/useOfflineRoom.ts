'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '@/lib/api';

function getMyUserInfo(): { id: string; name: string } {
    const token = getAccessToken();
    if (!token) return { id: `guest_${Date.now()}`, name: '게스트' };
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const id = String(payload.sub ?? payload.user_id ?? payload.id ?? Date.now());
        const name = (payload.name ?? payload.username ?? `사용자 ${id}`) as string;
        return { id, name };
    } catch {
        return { id: `guest_${Date.now()}`, name: '게스트' };
    }
}

function getWsBase(): string {
    const apiUrl = process.env.API_URL || 'https://localhost:8000';
    return apiUrl.replace(/^https?:\/\//, (m) => (m.startsWith('https') ? 'wss://' : 'ws://'));
}

export interface Participant {
    userId: string;
    name: string;
    isMuted: boolean;
}

interface UseOfflineRoomOptions {
    roomId: number;
    onLeave?: () => void;
}

export function useOfflineRoom({ roomId, onLeave }: UseOfflineRoomOptions) {
    const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
    const [isMicOn, setIsMicOn] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const myInfo = useRef(getMyUserInfo());
    const handleMsgRef = useRef<((data: string) => void) | null>(null);

    const sendWs = useCallback((data: object) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const handleMessage = useCallback((data: string) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(data); } catch { return; }

        const { type } = msg;

        if (type === 'join') {
            const userId = msg.id as string;
            if (!userId || userId === myInfo.current.id) return;
            const name = (msg.name as string) ?? `사용자 ${userId}`;
            setParticipants(prev => {
                const next = new Map(prev);
                next.set(userId, { userId, name, isMuted: false });
                return next;
            });

        } else if (type === 'participants') {
            // 기존 참가자 목록 (이름 없이 id만)
            const ids = (msg.ids as string[]) ?? [];
            setParticipants(prev => {
                const next = new Map(prev);
                ids.forEach(id => {
                    if (id !== myInfo.current.id && !next.has(id)) {
                        next.set(id, { userId: id, name: `사용자 ${id}`, isMuted: false });
                    }
                });
                return next;
            });

        } else if (type === 'leave') {
            const userId = msg.id as string;
            setParticipants(prev => {
                const next = new Map(prev);
                next.delete(userId);
                return next;
            });

        } else if (type === 'mic_toggle') {
            const userId = msg.userId as string;
            const muted = msg.muted as boolean;
            // 내 마이크가 제어된 경우
            if (userId === myInfo.current.id) {
                setIsMicOn(!muted);
                streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
            }
            setParticipants(prev => {
                const next = new Map(prev);
                const p = next.get(userId);
                if (p) next.set(userId, { ...p, isMuted: muted });
                return next;
            });
        }
    }, []);

    handleMsgRef.current = handleMessage;

    useEffect(() => {
        let cancelled = false;
        let ws: WebSocket;

        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
            } catch {
                setError('마이크 접근 권한이 필요합니다.');
            }

            if (cancelled) return;

            ws = new WebSocket(`${getWsBase()}/webrtc/ws/${roomId}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                ws.send(JSON.stringify({
                    type: 'join',
                    id: myInfo.current.id,
                    name: myInfo.current.name,
                }));
            };
            ws.onmessage = (e) => handleMsgRef.current?.(e.data);
            ws.onclose = () => setIsConnected(false);
            ws.onerror = () => setError('서버에 연결할 수 없습니다.');
        };

        init();

        return () => {
            cancelled = true;
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'leave', id: myInfo.current.id }));
            }
            ws?.close();
            streamRef.current?.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current?.stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    const toggleMic = useCallback(() => {
        streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsMicOn(v => !v);
    }, []);

    const startRecording = useCallback(() => {
        if (!streamRef.current || isRecording) return;
        audioChunksRef.current = [];
        const mr = new MediaRecorder(streamRef.current);
        mr.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mr.start(1000);
        mediaRecorderRef.current = mr;
        setIsRecording(true);
    }, [isRecording]);

    const stopRecording = useCallback((): Blob | null => {
        const mr = mediaRecorderRef.current;
        if (!mr || !isRecording) return null;
        mr.stop();
        setIsRecording(false);
        return new Blob(audioChunksRef.current, { type: 'audio/webm' });
    }, [isRecording]);

    // 컨트롤러/호스트가 다른 참가자 마이크 제어
    const toggleMicForUser = useCallback((userId: string, muted: boolean) => {
        sendWs({ type: 'mic_toggle', userId, muted });
        setParticipants(prev => {
            const next = new Map(prev);
            const p = next.get(userId);
            if (p) next.set(userId, { ...p, isMuted: muted });
            return next;
        });
    }, [sendWs]);

    const leaveRoom = useCallback(() => {
        sendWs({ type: 'leave', id: myInfo.current.id });
        wsRef.current?.close();
        streamRef.current?.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current?.stop();
        onLeave?.();
    }, [sendWs, onLeave]);

    return {
        participants,
        isMicOn,
        isRecording,
        isConnected,
        error,
        myUserId: myInfo.current.id,
        myName: myInfo.current.name,
        toggleMic,
        startRecording,
        stopRecording,
        toggleMicForUser,
        leaveRoom,
    };
}
