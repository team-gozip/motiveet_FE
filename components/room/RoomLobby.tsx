'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { roomApi, authApi, getAccessToken } from '@/lib/api';

const LOBBY_VISITED_KEY = 'motiveet:lobby-visited';

function markLobbyVisited(roomId: number) {
    if (typeof window === 'undefined') return;
    try {
        const raw = sessionStorage.getItem(LOBBY_VISITED_KEY);
        const arr: number[] = raw ? JSON.parse(raw) : [];
        if (!arr.includes(roomId)) {
            arr.push(roomId);
            sessionStorage.setItem(LOBBY_VISITED_KEY, JSON.stringify(arr));
        }
    } catch { /* ignore */ }
}

interface RoomLobbyProps {
    roomId: number;
}

export default function RoomLobby({ roomId }: RoomLobbyProps) {
    const router = useRouter();

    const [name, setName] = useState('');
    const [originalName, setOriginalName] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [folderId, setFolderId] = useState<number | null>(null);
    const [displayName, setDisplayName] = useState<string>('');
    const [originalDisplayName, setOriginalDisplayName] = useState<string>('');
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [micLevel, setMicLevel] = useState(0);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const videoNodeRef = useRef<HTMLVideoElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const rafRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // 룸 정보 + 사용자 정보 가져오기
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            roomApi.getById(roomId),
            authApi.me().catch(() => null),
        ])
            .then(([info, me]) => {
                if (cancelled) return;
                setName(info.name);
                setOriginalName(info.name);
                setFolderId(info.folderId);
                // 호스트만 이름 변경 가능
                const token = getAccessToken();
                let myId = 0;
                if (token) {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        myId = Number(payload?.sub ?? payload?.user_id ?? payload?.id ?? 0);
                    } catch { /* ignore */ }
                }
                setIsHost(myId === info.hostId);
                const initialDisplay = me?.name || me?.username || '나';
                setDisplayName(initialDisplay);
                setOriginalDisplayName(initialDisplay);
                setIsLoading(false);
            })
            .catch(() => {
                setError('회의 정보를 불러오지 못했습니다.');
                setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [roomId]);

    // 미디어 스트림 가져오기
    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            try {
                const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (cancelled) {
                    s.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = s;
                setStream(s);
            } catch {
                try {
                    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                    if (cancelled) {
                        s.getTracks().forEach(t => t.stop());
                        return;
                    }
                    streamRef.current = s;
                    setStream(s);
                    setIsCameraOn(false);
                } catch {
                    setPermissionError('카메라/마이크 권한이 필요합니다.');
                }
            }
        };
        init();
        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            sourceRef.current?.disconnect();
            audioContextRef.current?.close();
        };
    }, []);

    // 비디오 엘리먼트에 stream 연결 — 콜백 ref로 마운트 직후 attach 보장
    const attachVideo = useCallback((node: HTMLVideoElement | null) => {
        videoNodeRef.current = node;
        if (!node) return;
        node.muted = true;
        if (stream) {
            node.srcObject = stream;
            node.play().catch(() => {});
        }
    }, [stream]);

    useEffect(() => {
        const node = videoNodeRef.current;
        if (node && stream) {
            if (node.srcObject !== stream) node.srcObject = stream;
            node.play().catch(() => {});
        }
    }, [stream, isCameraOn]);

    // 오디오 분석기 설정 (마이크 레벨)
    useEffect(() => {
        if (!stream) return;
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const v = (dataArray[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            // 마이크 끈 상태에서는 레벨 0
            const enabled = stream.getAudioTracks()[0]?.enabled ?? false;
            setMicLevel(enabled ? Math.min(1, rms * 4) : 0);
            rafRef.current = requestAnimationFrame(tick);
        };
        tick();

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            source.disconnect();
            ctx.close();
            audioContextRef.current = null;
            analyserRef.current = null;
            sourceRef.current = null;
        };
    }, [stream]);

    // 트랙 enabled 동기화
    useEffect(() => {
        stream?.getAudioTracks().forEach(t => { t.enabled = isMicOn; });
    }, [isMicOn, stream]);
    useEffect(() => {
        stream?.getVideoTracks().forEach(t => { t.enabled = isCameraOn; });
    }, [isCameraOn, stream]);

    const handleJoin = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('회의 이름을 입력해주세요.');
            return;
        }
        const trimmedDisplay = displayName.trim();
        if (!trimmedDisplay) {
            setError('회의에서 표기될 이름을 입력해주세요.');
            return;
        }
        setIsJoining(true);
        setError('');
        try {
            if (isHost && trimmed !== originalName) {
                await roomApi.update(roomId, { name: trimmed });
            }
            if (trimmedDisplay !== originalDisplayName) {
                await authApi.updateMe({ name: trimmedDisplay });
            }
            // 미디어 스트림 정리 (RoomPage에서 새로 시작)
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            // 다음 진입부터 로비 스킵
            markLobbyVisited(roomId);
            const params = new URLSearchParams();
            params.set('mic', isMicOn ? '1' : '0');
            params.set('cam', isCameraOn ? '1' : '0');
            router.push(`/room/${roomId}?${params.toString()}`);
        } catch {
            setError('이름을 저장하지 못했습니다. 다시 시도해주세요.');
            setIsJoining(false);
        }
    };

    const handleCancel = () => {
        if (folderId != null) {
            router.push(`/folder/${folderId}`);
        } else {
            router.back();
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[var(--border-color)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
                    <p className="text-xs text-[var(--text-tertiary)]">불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-6xl">
                <h1 className="text-3xl font-bold mb-2">회의 입장 준비</h1>
                <p className="text-base text-[var(--text-secondary)] mb-10">
                    카메라와 마이크를 확인하고 회의에 입장하세요.
                </p>

                <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8">
                    {/* Camera preview */}
                    <div>
                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-[var(--border-color)] shadow-sm">
                            {/* video는 항상 마운트해서 stream attach 안정화 */}
                            <video
                                ref={attachVideo}
                                autoPlay
                                playsInline
                                muted
                                className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
                                    stream && isCameraOn ? 'opacity-100' : 'opacity-0'
                                }`}
                            />

                            {/* 카메라 꺼짐 / 권한 없음 오버레이 */}
                            {(!stream || !isCameraOn) && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
                                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm">{permissionError ?? '카메라가 꺼져 있습니다'}</p>
                                </div>
                            )}

                            {/* 표시 이름 뱃지 */}
                            {displayName && (
                                <div className="absolute bottom-5 left-5 px-3 py-1.5 rounded-md bg-black/55 text-white text-sm backdrop-blur-sm">
                                    {displayName}
                                </div>
                            )}

                            {/* Floating controls */}
                            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsMicOn(v => !v)}
                                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                                        isMicOn
                                            ? 'bg-white/15 hover:bg-white/25 text-white'
                                            : 'bg-[var(--danger)] hover:opacity-90 text-white'
                                    }`}
                                    title={isMicOn ? '마이크 끄기' : '마이크 켜기'}
                                >
                                    {isMicOn ? (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M19 5L5 19" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCameraOn(v => !v)}
                                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                                        isCameraOn
                                            ? 'bg-white/15 hover:bg-white/25 text-white'
                                            : 'bg-[var(--danger)] hover:opacity-90 text-white'
                                    }`}
                                    title={isCameraOn ? '카메라 끄기' : '카메라 켜기'}
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Mic level meter */}
                        <div className="mt-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-[var(--text-secondary)]">마이크 입력</span>
                                <span className="text-xs text-[var(--text-tertiary)]">
                                    {isMicOn ? '소리가 잘 들어오는지 확인하세요' : '꺼짐'}
                                </span>
                            </div>
                            <div className="h-3 w-full bg-[var(--highlight-bg)] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[var(--accent-primary)] transition-all duration-75"
                                    style={{ width: `${Math.round(micLevel * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Side: name + actions */}
                    <div className="flex flex-col">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">
                                회의 이름
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setError(''); }}
                                disabled={!isHost}
                                placeholder="회의 이름"
                                className="w-full h-12 px-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-base text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                            />
                            {!isHost && (
                                <p className="text-xs text-[var(--text-tertiary)]">
                                    호스트만 이름을 변경할 수 있습니다.
                                </p>
                            )}
                        </div>

                        <div className="mt-6 space-y-2">
                            <label htmlFor="display-name" className="text-sm font-medium text-[var(--text-secondary)]">
                                회의에서 표기될 이름
                            </label>
                            <div className="flex items-stretch gap-3">
                                <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] flex items-center justify-center text-base font-semibold flex-shrink-0">
                                    {(displayName || '?').charAt(0).toUpperCase()}
                                </div>
                                <input
                                    id="display-name"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => { setDisplayName(e.target.value); setError(''); }}
                                    placeholder="이름 입력"
                                    maxLength={30}
                                    className="flex-1 h-12 px-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-base text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all"
                                />
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-base text-[var(--foreground)]">마이크</span>
                                <button
                                    type="button"
                                    onClick={() => setIsMicOn(v => !v)}
                                    className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                                        isMicOn
                                            ? 'border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--highlight-bg)]'
                                            : 'border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10'
                                    }`}
                                >
                                    {isMicOn ? '켜짐' : '꺼짐'}
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-base text-[var(--foreground)]">카메라</span>
                                <button
                                    type="button"
                                    onClick={() => setIsCameraOn(v => !v)}
                                    className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                                        isCameraOn
                                            ? 'border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--highlight-bg)]'
                                            : 'border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10'
                                    }`}
                                >
                                    {isCameraOn ? '켜짐' : '꺼짐'}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p className="mt-5 text-sm text-[var(--danger)]">{error}</p>
                        )}

                        <div className="mt-auto pt-10 flex items-center gap-3">
                            <button
                                onClick={handleCancel}
                                disabled={isJoining}
                                className="h-12 px-5 text-base text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleJoin}
                                disabled={isJoining || !name.trim()}
                                className="flex-1 h-12 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-lg text-base font-semibold transition-colors"
                            >
                                {isJoining ? '입장 중...' : '회의 입장'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
