'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '@/lib/api';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

function getMyUserId(): string {
    const token = getAccessToken();
    if (!token) return `guest_${Date.now()}`;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return String(payload.sub ?? payload.user_id ?? payload.id ?? Date.now());
    } catch {
        return `guest_${Date.now()}`;
    }
}

function getWsBase(): string {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8000';
    return apiUrl.replace(/^https?:\/\//, (m) => (m.startsWith('https') ? 'wss://' : 'ws://'));
}

export interface PeerState {
    userId: string;
    stream: MediaStream | null;
}

interface UseWebRTCOptions {
    roomId: number;
    onLeave?: () => void;
}

export function useWebRTC({ roomId, onLeave }: UseWebRTCOptions) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    // Original camera track saved so we can restore after screen share ends
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const myId = useRef<string>(getMyUserId());
    const handleMsgRef = useRef<((data: string) => Promise<void>) | null>(null);

    // ── helpers ──────────────────────────────────────────────────────

    const sendWs = useCallback((data: object) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const removePeer = useCallback((peerId: string) => {
        pcsRef.current.get(peerId)?.close();
        pcsRef.current.delete(peerId);
        setPeers(prev => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
        });
    }, []);

    const createPC = useCallback((peerId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        localStreamRef.current?.getTracks().forEach(t => {
            pc.addTrack(t, localStreamRef.current!);
        });

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                sendWs({ type: 'candidate', candidate: e.candidate, to: peerId, from: myId.current });
            }
        };

        pc.ontrack = (e) => {
            const stream = e.streams[0] ?? new MediaStream(e.track ? [e.track] : []);
            setPeers(prev => {
                const next = new Map(prev);
                next.set(peerId, { userId: peerId, stream });
                return next;
            });
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                removePeer(peerId);
            }
        };

        pcsRef.current.set(peerId, pc);
        setPeers(prev => {
            const next = new Map(prev);
            if (!next.has(peerId)) next.set(peerId, { userId: peerId, stream: null });
            return next;
        });
        return pc;
    }, [sendWs, removePeer]);

    // ── message handler ───────────────────────────────────────────────

    const handleMessage = useCallback(async (data: string) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(data); } catch { return; }

        const { type } = msg;

        if (type === 'join') {
            const peerId = msg.id as string;
            if (!peerId || peerId === myId.current) return;
            const pc = createPC(peerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendWs({ type: 'offer', sdp: offer.sdp, to: peerId, from: myId.current });

        } else if (type === 'offer') {
            const peerId = msg.from as string;
            if (!peerId) return;
            let pc = pcsRef.current.get(peerId);
            if (!pc) pc = createPC(peerId);
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp as string }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendWs({ type: 'answer', sdp: answer.sdp, to: peerId, from: myId.current });

        } else if (type === 'answer') {
            const peerId = msg.from as string;
            if (!peerId) return;
            const pc = pcsRef.current.get(peerId);
            if (pc && pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp as string }));
            }

        } else if (type === 'candidate') {
            const peerId = msg.from as string;
            if (!peerId) return;
            const pc = pcsRef.current.get(peerId);
            if (pc && msg.candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
                } catch { /* ignore stale candidates */ }
            }

        } else if (type === 'leave') {
            removePeer(msg.id as string);
        }
    }, [createPC, sendWs, removePeer]);

    handleMsgRef.current = handleMessage;

    // ── initialise media + websocket ──────────────────────────────────

    useEffect(() => {
        let ws: WebSocket;
        let cancelled = false;

        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                localStreamRef.current = stream;
                cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
                setLocalStream(stream);
            } catch {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                    localStreamRef.current = stream;
                    setLocalStream(stream);
                    setIsCameraOn(false);
                } catch {
                    setError('카메라/마이크 접근 권한이 필요합니다.');
                }
            }

            if (cancelled) return;

            ws = new WebSocket(`${getWsBase()}/webrtc/ws/${roomId}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                ws.send(JSON.stringify({ type: 'join', id: myId.current }));
            };
            ws.onmessage = (e) => handleMsgRef.current?.(e.data);
            ws.onclose = () => setIsConnected(false);
            ws.onerror = () => setError('서버에 연결할 수 없습니다.');
        };

        init();

        return () => {
            cancelled = true;
            sendWs({ type: 'leave', id: myId.current });
            ws?.close();
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            pcsRef.current.forEach(pc => pc.close());
            pcsRef.current.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    // ── controls ───────────────────────────────────────────────────────

    const toggleMic = useCallback(() => {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsMicOn(v => !v);
    }, []);

    const toggleCamera = useCallback(() => {
        localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsCameraOn(v => !v);
    }, []);

    // Replace the video sender in every peer connection with a new track
    const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
        const replacements = Array.from(pcsRef.current.values()).map(async (pc) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                await sender.replaceTrack(newTrack);
            }
        });
        await Promise.all(replacements);
    }, []);

    const startScreenShare = useCallback(async () => {
        if (isScreenSharing) return;
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 30 },
                audio: false,
            });
            screenStreamRef.current = screenStream;
            const screenTrack = screenStream.getVideoTracks()[0];

            // Replace video track in all peer connections
            await replaceVideoTrack(screenTrack);

            // Update local preview: swap video track in localStream
            if (localStreamRef.current) {
                const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
                if (oldVideoTrack) localStreamRef.current.removeTrack(oldVideoTrack);
                localStreamRef.current.addTrack(screenTrack);
                // Force React re-render with new stream reference
                setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            }

            setIsScreenSharing(true);

            // Handle user stopping share via browser's native stop button
            screenTrack.onended = () => {
                stopScreenShare();
            };
        } catch (e) {
            // User cancelled or permission denied — not an error worth surfacing
        }
    }, [isScreenSharing, replaceVideoTrack]);

    const stopScreenShare = useCallback(async () => {
        if (!isScreenSharing) return;

        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;

        // Restore original camera track
        const cameraTrack = cameraTrackRef.current;
        await replaceVideoTrack(cameraTrack);

        if (localStreamRef.current && cameraTrack) {
            // Remove the screen track and restore camera track
            localStreamRef.current.getVideoTracks().forEach(t => localStreamRef.current!.removeTrack(t));
            localStreamRef.current.addTrack(cameraTrack);
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        setIsScreenSharing(false);
    }, [isScreenSharing, replaceVideoTrack]);

    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            await stopScreenShare();
        } else {
            await startScreenShare();
        }
    }, [isScreenSharing, startScreenShare, stopScreenShare]);

    const leaveRoom = useCallback(() => {
        sendWs({ type: 'leave', id: myId.current });
        wsRef.current?.close();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        pcsRef.current.forEach(pc => pc.close());
        onLeave?.();
    }, [sendWs, onLeave]);

    return {
        localStream,
        peers,
        isMicOn,
        isCameraOn,
        isScreenSharing,
        isConnected,
        error,
        myUserId: myId.current,
        toggleMic,
        toggleCamera,
        toggleScreenShare,
        leaveRoom,
    };
}
