'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWebRTC, RecordRequest } from '@/hooks/useWebRTC';
import { useRoomHeartbeat } from '@/hooks/useRoomHeartbeat';
import { roomApi, meetingApi, folderApi, getAccessToken } from '@/lib/api';
import OfflineRoomPage from './OfflineRoomPage';
import ChatInterface from '@/components/main/ChatInterface';
import SharedMemo from './SharedMemo';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function getCurrentUserId(): number | null {
    const token = getAccessToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return Number(payload.sub ?? payload.user_id ?? payload.id ?? null);
    } catch { return null; }
}

// ── VideoTile ────────────────────────────────────────────────────────-

function VideoTile({
    stream,
    label,
    isLocal = false,
    isMuted = false,
    isCameraOff = false,
    isScreenSharing = false,
    isBeingRecorded = false,
    onClick,
}: {
    stream: MediaStream | null;
    label: string;
    isLocal?: boolean;
    isMuted?: boolean;
    isCameraOff?: boolean;
    isScreenSharing?: boolean;
    isBeingRecorded?: boolean;
    onClick?: () => void;
}) {
    const videoNodeRef = useRef<HTMLVideoElement | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [hasVideo, setHasVideo] = useState(false);

    useEffect(() => {
        if (!stream) {
            setHasVideo(false);
            return;
        }

        let trackedVideo: MediaStreamTrack | null = null;
        const update = () => {
            const track = stream.getVideoTracks()[0] ?? null;
            if (trackedVideo !== track) {
                if (trackedVideo) {
                    trackedVideo.removeEventListener('mute', update);
                    trackedVideo.removeEventListener('unmute', update);
                    trackedVideo.removeEventListener('ended', update);
                }
                trackedVideo = track;
                if (trackedVideo) {
                    trackedVideo.addEventListener('mute', update);
                    trackedVideo.addEventListener('unmute', update);
                    trackedVideo.addEventListener('ended', update);
                }
            }
            setHasVideo(!!track && track.enabled && !track.muted && track.readyState === 'live');
        };

        update();
        stream.addEventListener('addtrack', update);
        stream.addEventListener('removetrack', update);
        return () => {
            stream.removeEventListener('addtrack', update);
            stream.removeEventListener('removetrack', update);
            if (trackedVideo) {
                trackedVideo.removeEventListener('mute', update);
                trackedVideo.removeEventListener('unmute', update);
                trackedVideo.removeEventListener('ended', update);
            }
        };
    }, [stream]);

    // stream이 바뀔 때마다 비디오에 연결 + play
    const attachStream = useCallback((node: HTMLVideoElement | null) => {
        videoNodeRef.current = node;
        if (!node) return;
        node.muted = isLocal;
        if (stream) {
            node.srcObject = stream;
            node.play()
                .catch(() => {});
        } else {
            node.srcObject = null;
        }
    }, [stream, isLocal]);

    // stream 트랙이 바뀌어도(enabled 토글 등) 다시 재생 시도
    useEffect(() => {
        const node = videoNodeRef.current;
        if (!node || !stream) return;
        node.srcObject = stream;
        node.play()
            .catch(() => {});

        // 트랙이 추가/제거될 때 자동 재연결
        const handleTrackChange = () => {
            if (node) {
                node.srcObject = stream;
                node.play().catch(() => {});
            }
        };
        stream.addEventListener('addtrack', handleTrackChange);
        stream.addEventListener('removetrack', handleTrackChange);
        return () => {
            stream.removeEventListener('addtrack', handleTrackChange);
            stream.removeEventListener('removetrack', handleTrackChange);
        };
    }, [stream]);

    useEffect(() => {
        if (!stream) {
            setIsSpeaking(false);
            return;
        }

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) return;

        if (isMuted) {
            setIsSpeaking(false);
            return;
        }

        let audioContext: AudioContext;
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContext = new AudioContextClass();
        } catch (e) {
            return;
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.2;

        let source: MediaStreamAudioSourceNode;
        try {
            source = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]]));
            source.connect(analyser);
        } catch (e) {
            audioContext.close();
            return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let animationFrameId: number;
        let speakingTimeout: NodeJS.Timeout | null = null;
        let currentlySpeaking = false;

        const checkVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;

            const threshold = 15;
            if (average > threshold) {
                if (!currentlySpeaking) {
                    currentlySpeaking = true;
                    setIsSpeaking(true);
                }
                if (speakingTimeout) clearTimeout(speakingTimeout);
                speakingTimeout = setTimeout(() => {
                    currentlySpeaking = false;
                    setIsSpeaking(false);
                }, 300);
            }

            animationFrameId = requestAnimationFrame(checkVolume);
        };

        checkVolume();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (speakingTimeout) clearTimeout(speakingTimeout);
            try { source.disconnect(); } catch (e) {}
            try { audioContext.close(); } catch (e) {}
        };
    }, [stream, isMuted]);

    const displayName = (label.split('@')[0] || label).slice(0, 10);
    // 화면공유 중이면 cam off 플래그를 무시하고 항상 video 노출 (공유 트랙이 살아있음)
    const cameraOff = !stream || !hasVideo || (isCameraOff && !isScreenSharing);

    return (
        <div
            className={`relative rounded-2xl overflow-hidden aspect-video flex items-center justify-center transition-all duration-300 ${
                cameraOff ? 'bg-black' : 'bg-gray-900'
            } ${
                !isLocal ? 'cursor-pointer' : ''
            } ${
                isSpeaking 
                    ? 'ring-[3px] ring-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] z-10' 
                    : isBeingRecorded 
                        ? 'ring-2 ring-red-500' 
                        : !isLocal ? 'hover:ring-2 hover:ring-[var(--accent-primary)]/50' : ''
            }`}
            onClick={!isLocal ? onClick : undefined}
        >
            {stream && (
                <video
                    ref={attachStream}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover ${cameraOff ? 'invisible' : ''} ${!isScreenSharing ? 'scale-x-[-1]' : ''}`}
                />
            )}
            {cameraOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-white/20 flex items-center justify-center px-2">
                        <span className="text-white font-semibold text-sm truncate">{displayName}</span>
                    </div>
                </div>
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                <span className="bg-black/60 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs text-white font-medium">
                    {label}
                    {isLocal && ' (나)'}
                </span>
                {isMuted && (
                    <span className="bg-red-500/80 rounded-md px-1.5 py-0.5">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2" />
                        </svg>
                    </span>
                )}
                {isBeingRecorded && (
                    <span className="bg-red-600/90 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span className="text-[10px] text-white font-medium">녹음 중</span>
                    </span>
                )}
            </div>
        </div>
    );
}

// ── ControlBtn ───────────────────────────────────────────────────────

function ControlBtn({
    onClick,
    active = true,
    danger = false,
    highlighted = false,
    title,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    danger?: boolean;
    highlighted?: boolean;
    title?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all text-xs font-medium ${
                danger
                    ? 'bg-[var(--danger)] hover:opacity-90 text-white'
                    : highlighted
                        ? 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white'
                        : active
                            ? 'bg-[var(--card-bg)] hover:bg-[var(--highlight-bg)] text-[var(--foreground)] border border-[var(--border-color)]'
                            : 'bg-[var(--danger)]/10 hover:bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/20'
            }`}
        >
            {children}
        </button>
    );
}

// ── RecordPermissionModal ────────────────────────────────────────────

function RecordPermissionModal({
    requesterName,
    onAccept,
    onReject,
}: {
    requesterName: string;
    onAccept: () => void;
    onReject: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                </div>
                <h3 className="text-center text-[var(--foreground)] font-semibold mb-2">마이크 녹음 요청</h3>
                <p className="text-center text-[var(--text-secondary)] text-sm mb-6">
                    <span className="text-[var(--accent-primary)] font-medium">{requesterName}</span>님이 당신의 마이크 녹음을 요청했습니다.<br />
                    녹음을 허용하시겠습니까?
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onReject}
                        className="flex-1 px-4 py-2.5 bg-[var(--highlight-bg)] hover:bg-[var(--border-color)] text-[var(--foreground)] rounded-xl text-sm font-medium transition-colors"
                    >
                        거절
                    </button>
                    <button
                        onClick={onAccept}
                        className="flex-1 px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        허용
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Types ────────────────────────────────────────────────────────────

interface TranscriptEntry {
    text: string;
    startTime: Date;
    endTime: Date;
}

const toTimeStr = (d: Date) =>
    d.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul',
    });

// ── OnlineRoomContent ────────────────────────────────────────────────

function OnlineRoomContent({ roomId, hostId, folderId }: { roomId: number; hostId: number; folderId: number }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialMicOn = searchParams?.get('mic') !== '0';
    const initialCameraOn = searchParams?.get('cam') !== '0';
    const isHost = getCurrentUserId() === hostId;

    // ── 참가자 이름 매핑 (userId → 표시 이름) ───────────────────────
    const [namesByUserId, setNamesByUserId] = useState<Map<number, string>>(new Map());
    useEffect(() => {
        let cancelled = false;
        folderApi.getMembers(folderId)
            .then(resp => {
                if (cancelled) return;
                const m = new Map<number, string>();
                for (const u of resp.members) {
                    m.set(u.userId, u.name || u.username || `사용자 ${u.userId}`);
                }
                setNamesByUserId(m);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [folderId]);

    const labelOf = useCallback((peerId: string): string => {
        const idPart = peerId.split('_')[0];
        const uid = Number(idPart);
        if (!Number.isFinite(uid)) return peerId;
        return namesByUserId.get(uid) || peerId;
    }, [namesByUserId]);

    // ── 기본 상태 ────────────────────────────────────────────────────
    const [isLeavingRoom, setIsLeavingRoom] = useState(false);
    const [showMeetingEndedModal, setShowMeetingEndedModal] = useState(false);

    // ── 회의(meeting) 상태 ──────────────────────────────────────────
    const [meetingId, setMeetingId] = useState<number | null>(null);
    const [isStartingMeeting, setIsStartingMeeting] = useState(false);
    const [isEndingMeeting, setIsEndingMeeting] = useState(false);
    // setState gap 사이 double-click 방어용 ref guard
    const isEndingRef = useRef(false);
    const isStartingRef = useRef(false);
    const isMeetingActive = !!meetingId;

    // ── 사이드 패널 ──────────────────────────────────────────────────
    const [sidePanel, setSidePanel] = useState<'transcript' | 'chat' | 'memo' | null>(null);
    const [chatId, setChatId] = useState<number | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const chatRef = useRef<any>(null);

    const togglePanel = (panel: 'transcript' | 'chat' | 'memo') => {
        setSidePanel(prev => prev === panel ? null : panel);
    };

    // ── 녹음 상태 ───────────────────────────────────────────────────
    const [recordingTarget, setRecordingTarget] = useState<string | null>(null);
    const [incomingRecordRequest, setIncomingRecordRequest] = useState<string | null>(null);
    const [pendingRecordRequest, setPendingRecordRequest] = useState<string | null>(null);
    // 유저별 녹취록: userId → 엔트리 배열
    const [userTranscripts, setUserTranscripts] = useState<Map<string, TranscriptEntry[]>>(new Map());
    const [selectedTranscriptUser, setSelectedTranscriptUser] = useState<string | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // ── 하트비트 (좀비 룸 방지) ──────────────────────────────────────
    useRoomHeartbeat(roomId);

    // ── 초기 로드 ───────────────────────────────────────────────────
    useEffect(() => {
        roomApi.getById(roomId).then(info => {
            // 이미 진행 중인 회의가 있으면 복원
            if (info.activeMeetingId) {
                setMeetingId(info.activeMeetingId);
                if (info.activeChatId) setChatId(info.activeChatId);
                if (info.activeSessionId) setSessionId(info.activeSessionId);
            } else {
                // 회의 전: Room의 fallback chat/session으로 세팅 (회의 시작 후에도 같은 chat/session 재사용됨)
                if (info.fallbackChatId) setChatId(prev => prev ?? info.fallbackChatId);
                if (info.fallbackSessionId) setSessionId(prev => prev ?? info.fallbackSessionId);
            }
        }).catch(() => {});
    }, [roomId]);


    // ── 회의 시작 ────────────────────────────────────────────────────
    const handleStartMeeting = async () => {
        if (isStartingRef.current) return;
        isStartingRef.current = true;
        setIsStartingMeeting(true);
        try {
            // roomId 전달 → BE가 room.fallbackChatId/SessionId를 그대로 재사용 (회의 전 대화/메모 연속)
            const resp = await meetingApi.start('온라인 회의', roomId);
            if (resp.success) {
                setMeetingId(resp.meetingId);
                setChatId(resp.chatId);
                setSessionId(resp.sessionId);
                await roomApi.setActiveMeeting(roomId, resp.meetingId, resp.chatId, null, resp.sessionId);
            }
        } catch (e) {
            console.error('[OnlineRoom] start meeting failed:', e);
        } finally {
            isStartingRef.current = false;
            setIsStartingMeeting(false);
        }
    };

    // ── 회의 종료 → 방 종료 + 전원 퇴장 ─────────────────────────────--
    // 직렬화 이유:
    //   1) meeting end가 먼저 끝나야 요약을 받을 수 있다 → setActiveMeeting에 summary 전달.
    //   2) 직렬 실행이라 한 단계 실패해도 이후 단계의 race가 없음.
    //   3) sendRoomEnded는 가장 먼저 → peer가 알림 받고 정상 퇴장할 시간 확보.
    const handleEndMeeting = async () => {
        if (!meetingId || isEndingRef.current) return;
        if (!window.confirm('회의를 종료하시겠습니까?')) return;
        const currentMeetingId = meetingId;
        isEndingRef.current = true;
        setIsEndingMeeting(true);

        // 자원 정리: 녹음 + 화면공유. 종료 후 Room.isSharing이 좀비로 남는 것 방지.
        if (recordingTarget) {
            sendRecordStop(recordingTarget);
            stopRecording();
        }
        if (isScreenSharing) {
            try { toggleScreenShare(); } catch { /* ignore */ }
        }

        // peer 알림 먼저 — WebRTC tear-down 전에 시그널이 도달할 시간 필요.
        try { sendRoomEnded(); } catch { /* ignore */ }

        // 직렬화: meeting end → summary 받음 → setActiveMeeting(summary 저장) → roomEnd.
        let summary: string | null = null;
        try {
            const endResult = await meetingApi.end(currentMeetingId);
            if (endResult?.success) summary = endResult.summary || null;
        } catch (e) {
            console.error('[OnlineRoom] meetingApi.end failed:', e);
        }
        try {
            // summary를 함께 저장 → EndedRoomView/비호스트 polling에서 즉시 표시 가능.
            await roomApi.setActiveMeeting(roomId, null, null, summary);
        } catch (e) {
            console.error('[OnlineRoom] setActiveMeeting(null) failed:', e);
        }
        try {
            await roomApi.end(roomId);
        } catch (e) {
            console.error('[OnlineRoom] end room failed:', e);
        }

        // sendRoomEnded 시그널이 propagate할 시간 확보 (WebRTC signaling은 out-of-band).
        await new Promise(r => setTimeout(r, 250));

        leaveRoom();
        router.push(`/folder/${folderId}`);
    };

    const handleLeave = useCallback(async () => {
        if (isLeavingRoom) return;
        setIsLeavingRoom(true);
        try { await roomApi.leave(roomId); } catch { /* ignore */ }
        router.push(`/folder/${folderId}`);
    }, [roomId, router, isLeavingRoom, folderId]);

    // ── 녹음 콜백 ───────────────────────────────────────────────────
    const handleRecordRequest = useCallback((req: RecordRequest) => {
        setIncomingRecordRequest(req.from);
    }, []);

    const handleRecordAccept = useCallback((from: string) => {
        // 상대방이 녹음을 수락함 → 해당 peer의 오디오 녹음 시작
        setPendingRecordRequest(null);
        setRecordingTarget(from);
    }, []);

    const handleRecordReject = useCallback((from: string) => {
        if (pendingRecordRequest === from) {
            setPendingRecordRequest(null);
        }
    }, [pendingRecordRequest]);

    const handleRecordStop = useCallback((from: string) => {
        // 상대방이 녹음 중지를 요청
        if (recordingTarget === from) {
            stopRecording();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recordingTarget]);

    const handleRoomEnded = useCallback(() => {
        // 호스트가 방을 종료함 → 참가자에게 모달 표시 후 자동 퇴장
        setShowMeetingEndedModal(true);
    }, []);

    const {
        localStream, peers, isMicOn, isCameraOn, isScreenSharing, isConnected, error, myUserId,
        toggleMic, toggleCamera, toggleScreenShare, leaveRoom, sendRoomEnded,
        sendRecordRequest, sendRecordAccept, sendRecordReject, sendRecordStop,
    } = useWebRTC({
        roomId,
        initialMicOn,
        initialCameraOn,
        onLeave: handleLeave,
        onRoomEnded: handleRoomEnded,
        onRecordRequest: handleRecordRequest,
        onRecordAccept: handleRecordAccept,
        onRecordReject: handleRecordReject,
        onRecordStop: handleRecordStop,
    });

    // ── 녹음 시작/중지 ─────────────────────────────────────────────
    const startRecording = useCallback((targetPeerId: string) => {
        const peerState = peers.get(targetPeerId);
        if (!peerState?.stream) {
            console.warn('[RoomRecording] No stream for peer:', targetPeerId);
            return;
        }

        const audioTracks = peerState.stream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.warn('[RoomRecording] No audio tracks for peer:', targetPeerId);
            return;
        }

        const audioStream = new MediaStream(audioTracks);

        const recordChunk = () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }

            const chunkStart = new Date();
            const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
            recorder.ondataavailable = (e) => {
                const chunkEnd = new Date();
                if (e.data.size > 0) {
                    const audioBlob = new Blob([e.data], { type: 'audio/webm' });
                    roomApi.uploadAudio(roomId, audioBlob)
                        .then(res => {
                            if (res.text && res.text.trim()) {
                                setUserTranscripts(prev => {
                                    const next = new Map(prev);
                                    const existing = next.get(targetPeerId) ?? [];
                                    next.set(targetPeerId, [...existing, {
                                        text: res.text,
                                        startTime: chunkStart,
                                        endTime: chunkEnd,
                                    }]);
                                    return next;
                                });
                                setSelectedTranscriptUser(prev => prev ?? targetPeerId);
                                setSidePanel(prev => prev ?? 'transcript');
                            }
                        })
                        .catch(err => console.error('[RoomRecording] Upload failed:', err));
                }
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
        };

        recordChunk();

        if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = setInterval(() => {
            recordChunk();
        }, 10000);

        console.log('[RoomRecording] Started recording peer:', targetPeerId);
    }, [peers, roomId]);

    const stopRecording = useCallback(() => {
        if (chunkIntervalRef.current) {
            clearInterval(chunkIntervalRef.current);
            chunkIntervalRef.current = null;
        }
        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            mediaRecorderRef.current = null;
        }
        setRecordingTarget(null);
    }, []);

    // recordingTarget이 설정되면 녹음 시작
    useEffect(() => {
        if (recordingTarget) {
            startRecording(recordingTarget);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recordingTarget]);

    // 실시간 텍스트 자동 스크롤
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [userTranscripts]);

    // 컴포넌트 언마운트 시 녹음 정리
    useEffect(() => {
        return () => {
            if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
            if (mediaRecorderRef.current?.state !== 'inactive') {
                mediaRecorderRef.current?.stop();
            }
        };
    }, []);

    // ── 사용자 타일 클릭 (녹음 요청) ────────────────────────────────
    const handleTileClick = (peerId: string) => {
        if (recordingTarget === peerId) {
            // 이미 녹음 중 → 중지
            sendRecordStop(peerId);
            stopRecording();
            return;
        }
        if (recordingTarget) {
            // 다른 대상 녹음 중
            return;
        }
        // 녹음 요청 전송
        setPendingRecordRequest(peerId);
        sendRecordRequest(peerId);
    };

    // ── 녹음 허용/거절 응답 ─────────────────────────────────────────
    const handleAcceptIncoming = () => {
        if (incomingRecordRequest) {
            sendRecordAccept(incomingRecordRequest);
            setIncomingRecordRequest(null);
        }
    };

    const handleRejectIncoming = () => {
        if (incomingRecordRequest) {
            sendRecordReject(incomingRecordRequest);
            setIncomingRecordRequest(null);
        }
    };

    const handleLeaveClick = () => {
        if (recordingTarget) {
            sendRecordStop(recordingTarget);
            stopRecording();
        }
        leaveRoom();
        handleLeave();
    };

    const allParticipants = [
        { userId: myUserId, stream: localStream, isLocal: true, micOn: isMicOn, cameraOn: isCameraOn, isScreenSharing },
        ...Array.from(peers.values()).map(p => ({ ...p, isLocal: false })),
    ];

    const gridCols = allParticipants.length <= 1
        ? 'grid-cols-1 max-w-2xl'
        : allParticipants.length <= 4
            ? 'grid-cols-2'
            : 'grid-cols-3';

    const recordedUsers = Array.from(userTranscripts.keys());
    const currentTranscripts = selectedTranscriptUser
        ? (userTranscripts.get(selectedTranscriptUser) ?? [])
        : [];
    const totalTranscriptCount = Array.from(userTranscripts.values()).reduce((s, a) => s + a.length, 0);

    return (
        <div className="h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col overflow-hidden">
            {/* 녹음 요청 모달 */}
            {incomingRecordRequest && (
                <RecordPermissionModal
                    requesterName={incomingRecordRequest}
                    onAccept={handleAcceptIncoming}
                    onReject={handleRejectIncoming}
                />
            )}

            {/* ── 헤더 ─────────────────────────────────────────────── */}
            <header className="flex items-center justify-between px-6 py-3 bg-[var(--header-bg)]/90 backdrop-blur border-b border-[var(--border-color)] flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                    <span className="text-sm font-semibold text-[var(--foreground)]">온라인 회의</span>
                    <span className="text-xs text-[var(--text-tertiary)]">Room #{roomId}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isMeetingActive && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-lg text-xs text-[var(--success)] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                            회의 진행 중
                        </span>
                    )}
                    {isScreenSharing && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-lg text-xs text-[var(--accent-primary)] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                            화면 공유 중
                        </span>
                    )}
                    {recordingTarget && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg text-xs text-[var(--danger)] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
                            녹음 중
                        </span>
                    )}
                    {pendingRecordRequest && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg text-xs text-[var(--warning)] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
                            녹음 요청 대기 중
                        </span>
                    )}
                    <span className="text-xs text-[var(--text-tertiary)]">{allParticipants.length}명 참여 중</span>
                </div>
            </header>

            {/* ── Body: 비디오 + 사이드 패널 ─────────────────────────── */}
            <div className="flex-1 flex overflow-hidden min-h-0">

                {/* 비디오 그리드 (패널이 열리면 자동 축소) */}
                <div className="flex-1 flex items-center justify-center p-4 min-w-0 overflow-hidden">
                    {error ? (
                        <div className="text-center">
                            <p className="text-red-400 text-sm mb-3">{error}</p>
                            <button onClick={handleLeaveClick} className="px-4 py-2 bg-[var(--card-bg)] hover:bg-[var(--highlight-bg)] border border-[var(--border-color)] text-[var(--foreground)] rounded-lg text-sm">나가기</button>
                        </div>
                    ) : (
                        <div className={`grid ${gridCols} gap-3 w-full h-full mx-auto`}>
                            {allParticipants.map(p => (
                                <VideoTile
                                    key={p.userId}
                                    stream={p.stream}
                                    label={labelOf(p.userId)}
                                    isLocal={p.isLocal}
                                    isMuted={!p.micOn}
                                    isCameraOff={!p.cameraOn}
                                    isScreenSharing={p.isScreenSharing}
                                    isBeingRecorded={recordingTarget === p.userId}
                                    onClick={() => handleTileClick(p.userId)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── 사이드 패널 ─────────────────────────────────────── */}
                {sidePanel && (
                    <aside className="flex-shrink-0 w-80 flex flex-col bg-[var(--card-bg)] border-l border-[var(--border-color)] overflow-hidden">
                        {/* 패널 헤더 */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                            <span className="text-sm font-semibold text-[var(--foreground)]">
                                {sidePanel === 'transcript' ? '녹취록' : sidePanel === 'chat' ? 'AI 채팅' : '메모'}
                            </span>
                            <button
                                onClick={() => setSidePanel(null)}
                                className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* 패널 콘텐츠 */}
                        <div className="flex-1 min-h-0 overflow-hidden">

                            {/* 녹취록 */}
                            {sidePanel === 'transcript' && (
                                <div className="h-full flex flex-col">
                                    {/* 유저 선택 */}
                                    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] overflow-x-auto">
                                        {recordedUsers.length === 0 && !recordingTarget ? (
                                            <span className="text-[10px] text-[var(--text-tertiary)]">참가자 영상을 클릭하여 녹음을 시작하세요</span>
                                        ) : (
                                            <>
                                                {recordedUsers.map(uid => (
                                                    <button
                                                        key={uid}
                                                        onClick={() => setSelectedTranscriptUser(uid)}
                                                        className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                                            selectedTranscriptUser === uid
                                                                ? 'bg-[var(--accent-primary)] text-white'
                                                                : 'bg-[var(--highlight-bg)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                                                        }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${recordingTarget === uid ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
                                                        {uid === myUserId ? '나' : labelOf(uid)}
                                                        <span className="opacity-50">({userTranscripts.get(uid)?.length ?? 0})</span>
                                                    </button>
                                                ))}
                                                {recordingTarget && !recordedUsers.includes(recordingTarget) && (
                                                    <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-[var(--danger)] bg-[var(--danger)]/10">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
                                                        {labelOf(recordingTarget)} 인식 중...
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {/* 녹취 내용 */}
                                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                        {!selectedTranscriptUser ? (
                                            <div className="flex items-center justify-center h-full">
                                                <p className="text-xs text-[var(--text-tertiary)] text-center">
                                                    {recordingTarget ? '음성을 인식하는 중...' : '위에서 참가자를 선택하세요'}
                                                </p>
                                            </div>
                                        ) : currentTranscripts.length === 0 ? (
                                            <p className="text-xs text-[var(--text-tertiary)] text-center mt-6">
                                                {recordingTarget === selectedTranscriptUser ? '음성을 인식하는 중...' : '아직 녹취 내용이 없습니다.'}
                                            </p>
                                        ) : (
                                            currentTranscripts.map((entry, i) => (
                                                <div key={i} className="space-y-1.5 pb-3 border-b border-[var(--border-color)] last:border-b-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                                                            {selectedTranscriptUser === myUserId ? '나' : labelOf(selectedTranscriptUser!)}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                                                            {toTimeStr(entry.startTime)} ~ {toTimeStr(entry.endTime)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-[var(--foreground)] leading-relaxed pl-2 border-l-2 border-[var(--accent-primary)]/30">{entry.text}</p>
                                                </div>
                                            ))
                                        )}
                                        <div ref={transcriptEndRef} />
                                    </div>
                                </div>
                            )}

                            {/* AI 채팅 */}
                            {sidePanel === 'chat' && (
                                <ChatInterface
                                    ref={chatRef}
                                    chatId={chatId}
                                    sessionId={sessionId}
                                    isMeetingActive={isMeetingActive}
                                />
                            )}

                            {/* 메모 */}
                            {sidePanel === 'memo' && (
                                <div className="h-full">
                                    <SharedMemo roomId={roomId} />
                                </div>
                            )}
                        </div>
                    </aside>
                )}
            </div>

            {/* ── 컨트롤 바 (footer) ──────────────────────────────────── */}
            <div className="flex-shrink-0 flex items-center justify-center gap-2 py-3 px-6 bg-[var(--header-bg)]/90 backdrop-blur border-t border-[var(--border-color)]">

                {/* 미디어 컨트롤 */}
                <ControlBtn onClick={toggleMic} active={isMicOn} title={isMicOn ? '마이크 끄기' : '마이크 켜기'}>
                    {isMicOn ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3l18 18" />
                        </svg>
                    )}
                    <span>{isMicOn ? '마이크' : '음소거'}</span>
                </ControlBtn>

                <ControlBtn onClick={toggleCamera} active={isCameraOn} title={isCameraOn ? '카메라 끄기' : '카메라 켜기'}>
                    {isCameraOn ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3l18 18" />
                        </svg>
                    )}
                    <span>{isCameraOn ? '카메라' : '카메라 꺼짐'}</span>
                </ControlBtn>

                <ControlBtn onClick={toggleScreenShare} active={!isScreenSharing} highlighted={isScreenSharing} title={isScreenSharing ? '화면 공유 중지' : '화면 공유'}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{isScreenSharing ? '공유 중지' : '화면 공유'}</span>
                </ControlBtn>

                {recordingTarget && (
                    <ControlBtn
                        onClick={() => { sendRecordStop(recordingTarget); stopRecording(); }}
                        danger
                        title="녹음 중지"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
                        </svg>
                        <span>녹음 중지</span>
                    </ControlBtn>
                )}

                <div className="w-px h-8 bg-[var(--border-color)] mx-1" />

                {/* 패널 토글 버튼 */}
                <ControlBtn
                    onClick={() => togglePanel('transcript')}
                    highlighted={sidePanel === 'transcript'}
                    active={true}
                    title="녹취록"
                >
                    <div className="relative">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {totalTranscriptCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                                {totalTranscriptCount}
                            </span>
                        )}
                    </div>
                    <span>녹취록</span>
                </ControlBtn>

                <ControlBtn
                    onClick={() => togglePanel('chat')}
                    highlighted={sidePanel === 'chat'}
                    active={true}
                    title="AI 채팅"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>AI 채팅</span>
                </ControlBtn>

                <ControlBtn
                    onClick={() => togglePanel('memo')}
                    highlighted={sidePanel === 'memo'}
                    active={true}
                    title="메모"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>메모</span>
                </ControlBtn>

                <div className="w-px h-8 bg-[var(--border-color)] mx-1" />

                {/* 회의 시작/종료 (host only) */}
                {isHost && !isMeetingActive && (
                    <ControlBtn onClick={handleStartMeeting} active={true} title="회의 시작">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{isStartingMeeting ? '시작 중...' : '회의 시작'}</span>
                    </ControlBtn>
                )}
                {isHost && isMeetingActive && (
                    <ControlBtn onClick={handleEndMeeting} danger title="회의 종료">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>{isEndingMeeting ? '종료 중...' : '회의 종료'}</span>
                    </ControlBtn>
                )}

                <ControlBtn onClick={handleLeaveClick} active={false} title="나가기">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>나가기</span>
                </ControlBtn>
            </div>

            {/* 회의 종료 모달 (비호스트용) */}
            {showMeetingEndedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-center text-[var(--foreground)] font-semibold mb-2">회의가 종료되었습니다</h3>
                        <p className="text-center text-[var(--text-secondary)] text-sm mb-6">
                            호스트가 회의를 종료했습니다. 잠시 후 자동으로 이동합니다.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowMeetingEndedModal(false);
                                    router.push(`/folder/${folderId}`);
                                }}
                                className="flex-1 px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                돌아가기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── RoomPage (타입 라우터) ────────────────────────────────────────────

interface RoomInfo {
    type: 'ONLINE' | 'OFFLINE';
    name: string;
    status: string;
    hostId: number;
    folderId: number;
    controllerId: number | null;
    activeMeetingId: number | null;
    activeChatId: number | null;
    summary: string | null;
    note: string | null;
    transcript: string | null;
    lastChatId: number | null;
    lastSessionId: number | null;
}

export default function RoomPage({ roomId }: { roomId: number }) {
    const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const router = useRouter();

    const loadRoom = useCallback(async () => {
        try {
            let info;
            try {
                info = await roomApi.getById(roomId);
            } catch {
                await roomApi.join(roomId);
                info = await roomApi.getById(roomId);
            }
            setRoomInfo({
                type: info.type as 'ONLINE' | 'OFFLINE',
                name: info.name,
                status: info.status,
                hostId: info.hostId,
                folderId: info.folderId,
                controllerId: info.controllerId,
                activeMeetingId: info.activeMeetingId ?? null,
                activeChatId: info.activeChatId ?? null,
                summary: info.summary ?? null,
                note: info.note ?? null,
                transcript: info.transcript ?? null,
                lastChatId: info.lastChatId ?? null,
                lastSessionId: info.lastSessionId ?? null,
            });
            setLoadError(null);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : '회의 정보를 불러오지 못했습니다.');
        }
    }, [roomId]);

    useEffect(() => {
        loadRoom();
    }, [loadRoom]);

    if (loadError) {
        return (
            <div className="h-screen bg-[var(--background)] flex items-center justify-center px-6">
                <div className="text-center">
                    <p className="text-red-400 text-sm mb-3">{loadError}</p>
                    <button onClick={() => router.push('/choose')} className="px-4 py-2 bg-[var(--card-bg)] hover:bg-[var(--highlight-bg)] border border-[var(--border-color)] text-[var(--foreground)] rounded-lg text-sm">돌아가기</button>
                </div>
            </div>
        );
    }

    if (!roomInfo) {
        return (
            <div className="h-screen bg-[var(--background)] flex items-center justify-center">
                <span className="text-[var(--text-tertiary)] text-sm">로딩 중...</span>
            </div>
        );
    }

    // ── 종료된 회의 뷰 ─────────────────────────────────────────────
    if (roomInfo.status === 'ENDED') {
        return (
            <EndedRoomView
                roomId={roomId}
                roomName={roomInfo.name}
                type={roomInfo.type}
                note={roomInfo.note}
                summary={roomInfo.summary}
                transcript={roomInfo.transcript}
                lastChatId={roomInfo.lastChatId}
                lastSessionId={roomInfo.lastSessionId}
                onBack={() => router.push(`/folder/${roomInfo.folderId}`)}
            />
        );
    }

    if (roomInfo.type === 'OFFLINE') {
        return (
            <OfflineRoomPage
                roomId={roomId}
                roomName={roomInfo.name}
                hostId={roomInfo.hostId}
                folderId={roomInfo.folderId}
                initialControllerId={roomInfo.controllerId}
                initialMeetingId={roomInfo.activeMeetingId}
                initialChatId={roomInfo.activeChatId}
                initialSummary={roomInfo.summary}
                onMeetingEnded={loadRoom}
            />
        );
    }

    return <OnlineRoomContent roomId={roomId} hostId={roomInfo.hostId} folderId={roomInfo.folderId} />;
}

// ── EndedRoomView (종료된 회의 확인 페이지) ──────────────────────────

function EndedRoomView({
    roomId,
    roomName,
    type,
    note,
    summary,
    transcript,
    lastChatId,
    lastSessionId,
    onBack,
}: {
    roomId: number;
    roomName: string;
    type: 'ONLINE' | 'OFFLINE';
    note: string | null;
    summary: string | null;
    transcript: string | null;
    lastChatId: number | null;
    lastSessionId: number | null;
    onBack: () => void;
}) {
    const isOnline = type === 'ONLINE';
    // 메모 / 회의 요약 / AI 채팅
    const [activeTab, setActiveTab] = useState<'memo' | 'summary' | 'chat'>('memo');
    const [roomSummary, setRoomSummary] = useState<string | null>(summary);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);

    // summary가 없으면 서버에서 재조회
    useEffect(() => {
        if (!roomSummary) {
            setIsSummaryLoading(true);
            roomApi.getById(roomId).then(info => {
                if (info.summary) {
                    setRoomSummary(info.summary);
                }
            }).catch(() => {}).finally(() => setIsSummaryLoading(false));
        }
    }, [roomSummary, roomId]);

    const tabs = [
        { key: 'memo' as const, label: '메모' },
        { key: 'summary' as const, label: '회의 요약' },
        { key: 'chat' as const, label: 'AI 채팅 내역' },
    ];

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
            {/* Header */}
            <header className="h-14 bg-[var(--card-bg)] border-b border-[var(--border-color)] flex items-center px-6 gap-4 flex-shrink-0">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-md text-[var(--foreground)] opacity-40 hover:opacity-100 hover:bg-[var(--highlight-bg)] transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-md border text-[10px] font-bold ${
                        isOnline
                            ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/40 text-[var(--accent-primary)]'
                            : 'bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]'
                    }`}>
                        {isOnline ? '온라인' : '오프라인'}
                    </span>
                    <span className="text-sm font-semibold">{roomName || `Room #${roomId}`}</span>
                    <span className="px-2.5 py-1 rounded-md border border-[var(--border-color)] bg-[var(--card-bg)] text-[10px] font-bold text-[var(--foreground)] shadow-sm">
                        종료됨
                    </span>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 ${
                            activeTab === tab.key
                                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                                : 'border-transparent text-[var(--foreground)] opacity-40 hover:opacity-70'
                        }`}
                    >
                        {tab.label}
                        {tab.key === 'summary' && isSummaryLoading && (
                            <span className="ml-2 inline-block w-3 h-3 rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] animate-spin" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'memo' && (
                    <div className="max-w-3xl mx-auto px-6 py-8">
                        <h2 className="text-lg font-bold mb-4">회의 메모</h2>
                        {note ? (
                            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 prose prose-sm dark:prose-invert max-w-none markdown-preview">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{note}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <p className="text-sm text-[var(--foreground)] opacity-30">작성된 메모가 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'summary' && (
                    <div className="max-w-3xl mx-auto px-6 py-8">
                        <h2 className="text-lg font-bold mb-4">회의 요약</h2>
                        {isSummaryLoading ? (
                            <div className="text-center py-16">
                                <div className="mx-auto w-8 h-8 rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] animate-spin mb-3" />
                                <p className="text-sm text-[var(--foreground)] opacity-40">요약을 불러오는 중...</p>
                            </div>
                        ) : roomSummary ? (
                            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 prose prose-sm dark:prose-invert max-w-none markdown-preview">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{roomSummary}</ReactMarkdown>
                            </div>
                        ) : isOnline && transcript ? (
                            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 prose prose-sm dark:prose-invert max-w-none markdown-preview">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{transcript}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <p className="text-sm text-[var(--foreground)] opacity-30">회의 요약이 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="max-w-3xl mx-auto px-6 py-8 h-full">
                        <h2 className="text-lg font-bold mb-4">AI 채팅 내역</h2>
                        {lastChatId ? (
                            <div className="h-[calc(100vh-220px)] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl overflow-hidden">
                                <ChatInterface
                                    chatId={lastChatId}
                                    sessionId={lastSessionId}
                                    isMeetingActive={false}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <p className="text-sm text-[var(--foreground)] opacity-30">AI 채팅 내역이 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
