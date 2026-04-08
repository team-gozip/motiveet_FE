'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '@/lib/api';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

function getMyUserId(): string {
    const token = getAccessToken();
    let base = `guest_${Date.now()}`;
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            base = String(payload.sub ?? payload.user_id ?? payload.id ?? Date.now());
        } catch { /* ignore */ }
    }
    // 탭별 고유 suffix — 같은 계정으로 두 탭 열어도 서로 다른 ID
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${base}_${suffix}`;
}

function getWsBase(): string {
    if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    return `${proto}://${host}:8000`;
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
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    // ICE candidates that arrived before setRemoteDescription
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const myId = useRef<string>(getMyUserId());
    const handleMsgRef = useRef<((data: string) => Promise<void>) | null>(null);
    const stopScreenShareRef = useRef<() => Promise<void>>(() => Promise.resolve());
    // Track in-progress offer creation to detect collisions
    const makingOfferRef = useRef<Set<string>>(new Set());

    // ── helpers ───────────────────────────────────────────────────────

    const sendWs = useCallback((data: object) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const removePeer = useCallback((peerId: string) => {
        pcsRef.current.get(peerId)?.close();
        pcsRef.current.delete(peerId);
        pendingCandidatesRef.current.delete(peerId);
        makingOfferRef.current.delete(peerId);
        setPeers(prev => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
        });
    }, []);

    const createPC = useCallback((peerId: string): RTCPeerConnection => {
        // Close any existing PC for this peer first
        pcsRef.current.get(peerId)?.close();

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

    // Drain queued ICE candidates after remote description is set
    const drainCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
        const queue = pendingCandidatesRef.current.get(peerId) ?? [];
        pendingCandidatesRef.current.delete(peerId);
        for (const candidate of queue) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch { /* stale candidate */ }
        }
    }, []);

    // Create offer and send to a peer
    const sendOffer = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
        try {
            makingOfferRef.current.add(peerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendWs({ type: 'offer', sdp: offer.sdp, to: peerId, from: myId.current });
        } finally {
            makingOfferRef.current.delete(peerId);
        }
    }, [sendWs]);

    // ── message handler ───────────────────────────────────────────────

    const handleMessage = useCallback(async (data: string) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(data); } catch { return; }

        const { type } = msg;

        if (type === 'join') {
            // Existing participant → new joiner enters
            const peerId = msg.id as string;
            if (!peerId || peerId === myId.current) return;
            // If we already have a PC for this peer (they may have sent offer via participants),
            // skip to avoid collision. The peer with the lexicographically smaller ID is the offerer.
            if (pcsRef.current.has(peerId) && myId.current > peerId) return;
            const pc = createPC(peerId);
            await sendOffer(peerId, pc);

        } else if (type === 'participants') {
            // We just joined — server tells us who's already in the room.
            // We create offers to each existing participant.
            const ids = msg.ids as string[];
            if (!Array.isArray(ids)) return;
            for (const peerId of ids) {
                if (!peerId || peerId === myId.current) continue;
                const pc = createPC(peerId);
                await sendOffer(peerId, pc);
            }

        } else if (type === 'offer') {
            const peerId = msg.from as string;
            if (!peerId) return;

            // "Polite peer" pattern: if we're in the middle of making an offer and collision occurs,
            // the peer with the lexicographically smaller ID wins (keeps their offer).
            const collision = makingOfferRef.current.has(peerId) || pcsRef.current.get(peerId)?.signalingState !== 'stable';
            const imPolite = myId.current < peerId; // smaller ID = impolite = wins
            if (collision && imPolite) return; // ignore incoming offer, ours wins

            let pc = pcsRef.current.get(peerId);
            if (!pc) pc = createPC(peerId);

            // If collision and we're polite: rollback our offer
            if (collision) {
                await pc.setLocalDescription({ type: 'rollback' });
            }

            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp as string }));
            await drainCandidates(peerId, pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendWs({ type: 'answer', sdp: answer.sdp, to: peerId, from: myId.current });

        } else if (type === 'answer') {
            const peerId = msg.from as string;
            if (!peerId) return;
            const pc = pcsRef.current.get(peerId);
            if (pc && pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp as string }));
                await drainCandidates(peerId, pc);
            }

        } else if (type === 'candidate') {
            const peerId = msg.from as string;
            if (!peerId || !msg.candidate) return;
            const pc = pcsRef.current.get(peerId);
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
                } catch { /* stale */ }
            } else {
                // Queue until remote description is ready
                const queue = pendingCandidatesRef.current.get(peerId) ?? [];
                queue.push(msg.candidate as RTCIceCandidateInit);
                pendingCandidatesRef.current.set(peerId, queue);
            }

        } else if (type === 'leave') {
            removePeer(msg.id as string);
        }
    }, [createPC, sendWs, sendOffer, drainCandidates, removePeer]);

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
            pendingCandidatesRef.current.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    // ── controls ──────────────────────────────────────────────────────

    const toggleMic = useCallback(() => {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsMicOn(v => !v);
    }, []);

    const toggleCamera = useCallback(() => {
        localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsCameraOn(v => !v);
    }, []);

    const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
        const replacements = Array.from(pcsRef.current.values()).map(async (pc) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) await sender.replaceTrack(newTrack);
        });
        await Promise.all(replacements);
    }, []);

    const startScreenShare = useCallback(async () => {
        if (isScreenSharing) return;
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
            screenStreamRef.current = screenStream;
            const screenTrack = screenStream.getVideoTracks()[0];
            await replaceVideoTrack(screenTrack);
            if (localStreamRef.current) {
                const old = localStreamRef.current.getVideoTracks()[0];
                if (old) localStreamRef.current.removeTrack(old);
                localStreamRef.current.addTrack(screenTrack);
                setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            }
            setIsScreenSharing(true);
            screenTrack.onended = () => { stopScreenShareRef.current(); };
        } catch { /* cancelled */ }
    }, [isScreenSharing, replaceVideoTrack]);

    const stopScreenShare = useCallback(async () => {
        if (!isScreenSharing) return;
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        const cameraTrack = cameraTrackRef.current;
        await replaceVideoTrack(cameraTrack);
        if (localStreamRef.current && cameraTrack) {
            localStreamRef.current.getVideoTracks().forEach(t => localStreamRef.current!.removeTrack(t));
            localStreamRef.current.addTrack(cameraTrack);
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
        setIsScreenSharing(false);
    }, [isScreenSharing, replaceVideoTrack]);

    stopScreenShareRef.current = stopScreenShare;

    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) await stopScreenShare();
        else await startScreenShare();
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
