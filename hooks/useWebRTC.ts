'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '@/lib/api';

function getIceServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const turnUrls = process.env.NEXT_PUBLIC_TURN_URLS;
    if (turnUrls) {
        servers.push({
            urls: turnUrls.split(',').map(url => url.trim()).filter(Boolean),
            username: process.env.NEXT_PUBLIC_TURN_USERNAME,
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        });
    }

    return servers;
}

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
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    // xquare 배포 도메인: FE는 motiveet-online.dsmhs.kr, BE(WS)는 motiveet-online-api.dsmhs.kr
    if (host === 'motiveet-online.dsmhs.kr') return 'wss://motiveet-online-api.dsmhs.kr';
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${host}:8000`;
}

export interface PeerState {
    userId: string;
    stream: MediaStream | null;
}

export interface RecordRequest {
    from: string;
}

interface UseWebRTCOptions {
    roomId: number;
    initialMicOn?: boolean;
    initialCameraOn?: boolean;
    onLeave?: () => void;
    onRoomEnded?: () => void;
    onRecordRequest?: (req: RecordRequest) => void;
    onRecordAccept?: (from: string) => void;
    onRecordReject?: (from: string) => void;
    onRecordStop?: (from: string) => void;
}

export function useWebRTC({ roomId, initialMicOn = true, initialCameraOn = true, onLeave, onRoomEnded, onRecordRequest, onRecordAccept, onRecordReject, onRecordStop }: UseWebRTCOptions) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
    const [isMicOn, setIsMicOn] = useState(initialMicOn);
    const [isCameraOn, setIsCameraOn] = useState(initialCameraOn);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
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

    const removePeer = useCallback((peerId: string, expectedPc?: RTCPeerConnection) => {
        const currentPc = pcsRef.current.get(peerId);
        if (expectedPc && currentPc !== expectedPc) return;

        currentPc?.close();
        pcsRef.current.delete(peerId);
        remoteStreamsRef.current.get(peerId)?.getTracks().forEach(track => track.stop());
        remoteStreamsRef.current.delete(peerId);
        pendingCandidatesRef.current.delete(peerId);
        makingOfferRef.current.delete(peerId);
        setPeers(prev => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
        });
    }, []);

    const createPC = useCallback((peerId: string): RTCPeerConnection => {
        const existingPc = pcsRef.current.get(peerId);
        if (existingPc && existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') {
            return existingPc;
        }
        if (existingPc) {
            existingPc.onconnectionstatechange = null;
            existingPc.close();
            pcsRef.current.delete(peerId);
        }

        const pc = new RTCPeerConnection({ iceServers: getIceServers() });

        const localStream = localStreamRef.current;
        const localTracks = localStream?.getTracks() ?? [];
        localTracks.forEach(t => pc.addTrack(t, localStream!));
        if (!localTracks.some(t => t.kind === 'video')) {
            pc.addTransceiver('video', { direction: 'sendrecv' });
        }

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                sendWs({ type: 'candidate', candidate: e.candidate, to: peerId, from: myId.current });
            }
        };

        pc.ontrack = (e) => {
            const stream = remoteStreamsRef.current.get(peerId) ?? new MediaStream();
            const incomingTracks = e.streams[0]?.getTracks() ?? (e.track ? [e.track] : []);
            incomingTracks.forEach(track => {
                if (!stream.getTracks().some(existing => existing.id === track.id)) {
                    stream.addTrack(track);
                }
            });
            remoteStreamsRef.current.set(peerId, stream);
            setPeers(prev => {
                const next = new Map(prev);
                next.set(peerId, { userId: peerId, stream: new MediaStream(stream.getTracks()) });
                return next;
            });
        };

        pc.onconnectionstatechange = () => {
            if (pcsRef.current.get(peerId) !== pc) return;
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                removePeer(peerId, pc);
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
            const existingPc = pcsRef.current.get(peerId);
            const shouldOffer = !existingPc || existingPc.connectionState === 'failed' || existingPc.connectionState === 'closed';
            const pc = createPC(peerId);
            if (shouldOffer && pc.signalingState === 'stable') {
                await sendOffer(peerId, pc);
            }

        } else if (type === 'participants') {
            // We just joined — server tells us who's already in the room.
            // Existing participants will receive our join event and initiate offers.
            // Creating offers from both sides causes glare and can make video one-way.
            const ids = msg.ids as string[];
            if (!Array.isArray(ids)) return;
            for (const peerId of ids) {
                if (!peerId || peerId === myId.current) continue;
                if (!pcsRef.current.has(peerId)) createPC(peerId);
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

        } else if (type === 'record-request') {
            onRecordRequest?.({ from: msg.from as string });

        } else if (type === 'record-accept') {
            onRecordAccept?.(msg.from as string);

        } else if (type === 'record-reject') {
            onRecordReject?.(msg.from as string);

        } else if (type === 'record-stop') {
            onRecordStop?.(msg.from as string);

        } else if (type === 'room-ended') {
            // 호스트가 회의를 종료함 → 모든 참가자 퇴장
            onRoomEnded?.();
        } else if (type === 'leave') {
            removePeer(msg.id as string);
        }
    }, [createPC, sendWs, sendOffer, drainCandidates, removePeer, onRoomEnded, onRecordRequest, onRecordAccept, onRecordReject, onRecordStop]);

    handleMsgRef.current = handleMessage;

    // ── initialise media + websocket ──────────────────────────────────

    useEffect(() => {
        let ws: WebSocket;
        let cancelled = false;

        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                // 로비에서 설정한 초기 mic/cam 상태 반영
                stream.getAudioTracks().forEach(t => { t.enabled = initialMicOn; });
                stream.getVideoTracks().forEach(t => { t.enabled = initialCameraOn; });
                localStreamRef.current = stream;
                cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
                // 새 MediaStream 객체로 감싸서 React가 참조 변경을 감지하도록
                setLocalStream(new MediaStream(stream.getTracks()));
            } catch {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                    stream.getAudioTracks().forEach(t => { t.enabled = initialMicOn; });
                    localStreamRef.current = stream;
                    setLocalStream(new MediaStream(stream.getTracks()));
                    setIsCameraOn(false);
                } catch {
                    setError('카메라/마이크 접근 권한이 필요합니다.');
                }
            }

            if (cancelled) return;

            const token = getAccessToken();
            const wsUrl = `${getWsBase()}/webrtc/ws/${roomId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
            ws = new WebSocket(wsUrl);
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
            remoteStreamsRef.current.forEach(stream => stream.getTracks().forEach(track => track.stop()));
            remoteStreamsRef.current.clear();
            pendingCandidatesRef.current.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    // ── controls ──────────────────────────────────────────────────────

    const toggleMic = useCallback(() => {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsMicOn(v => !v);
    }, []);

    const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
        const replacements = Array.from(pcsRef.current.values()).map(async (pc) => {
            let sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (!sender) {
                sender = pc.getTransceivers().find(t => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video')?.sender;
            }
            if (sender) await sender.replaceTrack(newTrack);
        });
        await Promise.all(replacements);
    }, []);

    const toggleCamera = useCallback(async () => {
        const currentTracks = localStreamRef.current?.getVideoTracks() || [];
        
        if (currentTracks.length === 0) {
            try {
                const vidStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newTrack = vidStream.getVideoTracks()[0];
                if (newTrack && localStreamRef.current) {
                    localStreamRef.current.addTrack(newTrack);
                    cameraTrackRef.current = newTrack;
                    await replaceVideoTrack(newTrack);
                    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                    setIsCameraOn(true);
                }
            } catch (e) {
                console.error('카메라 권한을 얻을 수 없습니다', e);
            }
            return;
        }

        currentTracks.forEach(t => { t.enabled = !t.enabled; });
        if (localStreamRef.current) {
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
        setIsCameraOn(v => !v);
    }, [replaceVideoTrack]);

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

    const sendRoomEnded = useCallback(() => {
        sendWs({ type: 'room-ended' });
    }, [sendWs]);

    const sendRecordRequest = useCallback((targetId: string) => {
        sendWs({ type: 'record-request', to: targetId, from: myId.current });
    }, [sendWs]);

    const sendRecordAccept = useCallback((targetId: string) => {
        sendWs({ type: 'record-accept', to: targetId, from: myId.current });
    }, [sendWs]);

    const sendRecordReject = useCallback((targetId: string) => {
        sendWs({ type: 'record-reject', to: targetId, from: myId.current });
    }, [sendWs]);

    const sendRecordStop = useCallback((targetId: string) => {
        sendWs({ type: 'record-stop', to: targetId, from: myId.current });
    }, [sendWs]);

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
        sendRoomEnded,
        sendRecordRequest,
        sendRecordAccept,
        sendRecordReject,
        sendRecordStop,
    };
}
