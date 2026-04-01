'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import { roomApi } from '@/lib/api';
import OfflineRoomPage from './OfflineRoomPage';

// ── VideoTile ────────────────────────────────────────────────────────

function VideoTile({
    stream,
    label,
    isLocal = false,
    isMuted = false,
}: {
    stream: MediaStream | null;
    label: string;
    isLocal?: boolean;
    isMuted?: boolean;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const initials = label.slice(0, 2).toUpperCase();

    return (
        <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video flex items-center justify-center">
            {stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-xl font-bold text-gray-300">{initials}</span>
                    </div>
                    <span className="text-xs text-gray-500">카메라 꺼짐</span>
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
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : highlighted
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : active
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
            }`}
        >
            {children}
        </button>
    );
}

// ── OnlineRoomContent ────────────────────────────────────────────────

function OnlineRoomContent({ roomId }: { roomId: number }) {
    const router = useRouter();
    const [notes, setNotes] = useState('');
    const [notesSaved, setNotesSaved] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [isLeavingRoom, setIsLeavingRoom] = useState(false);
    const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleLeave = useCallback(async () => {
        if (isLeavingRoom) return;
        setIsLeavingRoom(true);
        try { await roomApi.leave(roomId); } catch { /* ignore */ }
        router.push('/choose');
    }, [roomId, router, isLeavingRoom]);

    const { localStream, peers, isMicOn, isCameraOn, isScreenSharing, isConnected, error, myUserId, toggleMic, toggleCamera, toggleScreenShare, leaveRoom } = useWebRTC({
        roomId,
        onLeave: handleLeave,
    });

    const handleNotesChange = (text: string) => {
        setNotes(text);
        setNotesSaved(false);
        clearTimeout(notesSaveTimer.current);
        notesSaveTimer.current = setTimeout(async () => {
            try {
                await roomApi.updateNotes(roomId, text);
                setNotesSaved(true);
            } catch { /* ignore */ }
        }, 1500);
    };

    const handleLeaveClick = () => {
        leaveRoom();
        handleLeave();
    };

    const allParticipants = [
        { userId: myUserId, stream: localStream, isLocal: true },
        ...Array.from(peers.values()).map(p => ({ ...p, isLocal: false })),
    ];

    const gridCols = allParticipants.length <= 1
        ? 'grid-cols-1 max-w-2xl'
        : allParticipants.length <= 4
            ? 'grid-cols-2'
            : 'grid-cols-3';

    return (
        <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
            <header className="flex items-center justify-between px-6 py-3 bg-gray-900/80 backdrop-blur border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                    <span className="text-sm font-semibold text-white">온라인 회의</span>
                    <span className="text-xs text-gray-500">Room #{roomId}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isScreenSharing && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600/20 border border-indigo-500/40 rounded-lg text-xs text-indigo-300 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            화면 공유 중
                        </span>
                    )}
                    <span className="text-xs text-gray-500">{allParticipants.length}명 참여 중</span>
                    <button
                        onClick={() => setShowNotes(v => !v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            showNotes ? 'bg-indigo-600 text-white' : 'bg-white/10 hover:bg-white/15 text-gray-300'
                        }`}
                    >
                        메모
                    </button>
                </div>
            </header>

            <div className="flex flex-1 min-h-0">
                <div className="flex-1 flex items-center justify-center p-6 min-h-0">
                    {error ? (
                        <div className="text-center">
                            <p className="text-red-400 text-sm mb-3">{error}</p>
                            <button onClick={handleLeaveClick} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm">
                                나가기
                            </button>
                        </div>
                    ) : (
                        <div className={`grid ${gridCols} gap-4 w-full h-full mx-auto`}>
                            {allParticipants.map(p => (
                                <VideoTile
                                    key={p.userId}
                                    stream={p.stream}
                                    label={p.userId}
                                    isLocal={p.isLocal}
                                    isMuted={p.isLocal && !isMicOn}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {showNotes && (
                    <aside className="w-72 bg-gray-900/60 border-l border-white/5 flex flex-col p-4 flex-shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-white">회의 메모</span>
                            {notesSaved && <span className="text-xs text-emerald-400">저장됨</span>}
                        </div>
                        <textarea
                            value={notes}
                            onChange={(e) => handleNotesChange(e.target.value)}
                            placeholder="회의 내용을 여기에 적어두세요..."
                            className="flex-1 bg-gray-800/60 border border-white/10 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                        />
                        <p className="text-xs text-gray-600 mt-2">1.5초 후 자동 저장</p>
                    </aside>
                )}
            </div>

            <div className="flex-shrink-0 flex items-center justify-center gap-3 py-4 px-6 bg-gray-900/80 backdrop-blur border-t border-white/5">
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

                <div className="w-px h-8 bg-white/10 mx-1" />

                <ControlBtn onClick={handleLeaveClick} danger title="회의 나가기">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>나가기</span>
                </ControlBtn>
            </div>
        </div>
    );
}

// ── RoomPage (타입 라우터) ────────────────────────────────────────────

interface RoomInfo {
    type: 'ONLINE' | 'OFFLINE';
    name: string;
    hostId: number;
    controllerId: number | null;
}

export default function RoomPage({ roomId }: { roomId: number }) {
    const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);

    useEffect(() => {
        roomApi.getById(roomId)
            .then(info => {
                setRoomInfo({
                    type: info.type as 'ONLINE' | 'OFFLINE',
                    name: info.name,
                    hostId: info.hostId,
                    controllerId: info.controllerId,
                });
            })
            .catch(() => {
                // 로드 실패 시 온라인으로 폴백
                setRoomInfo({ type: 'ONLINE', name: '', hostId: 0, controllerId: null });
            });
    }, [roomId]);

    if (!roomInfo) {
        return (
            <div className="h-screen bg-gray-950 flex items-center justify-center">
                <span className="text-gray-500 text-sm">로딩 중...</span>
            </div>
        );
    }

    if (roomInfo.type === 'OFFLINE') {
        return (
            <OfflineRoomPage
                roomId={roomId}
                roomName={roomInfo.name}
                hostId={roomInfo.hostId}
                initialControllerId={roomInfo.controllerId}
            />
        );
    }

    return <OnlineRoomContent roomId={roomId} />;
}
