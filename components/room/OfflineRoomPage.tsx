'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOfflineRoom, Participant } from '@/hooks/useOfflineRoom';
import { roomApi, meetingApi } from '@/lib/api';
import { useMeeting } from '@/components/providers/MeetingProvider';
import ChatInterface from '@/components/main/ChatInterface';
import MeetingSummary from '@/components/main/MeetingSummary';
import SharedMemo from './SharedMemo';
import OfflineCenterPanel from './OfflineCenterPanel';
import { useResizablePanel } from '@/hooks/useResizablePanel';

// ── ParticipantItem ──────────────────────────────────────────────

function ParticipantItem({
    participant,
    isMe,
    isHost,
    isController,
    canControl,
    onAssignController,
    onToggleMic,
}: {
    participant: Participant;
    isMe: boolean;
    isHost: boolean;
    isController: boolean;
    canControl: boolean;
    onAssignController: () => void;
    onToggleMic: (muted: boolean) => void;
}) {
    const initials = participant.name.slice(0, 2).toUpperCase();

    return (
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            isMe ? 'bg-indigo-50 dark:bg-indigo-950/20' : 'hover:bg-[var(--highlight-bg)]'
        }`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                isMe ? 'bg-indigo-600 text-white' : 'bg-[var(--highlight-bg)] text-[var(--foreground)]'
            }`}>
                {initials}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-[var(--foreground)] truncate">
                        {participant.name}
                        {isMe && <span className="opacity-40"> (나)</span>}
                    </span>
                    {isHost && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                            호스트
                        </span>
                    )}
                    {isController && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                            조작자
                        </span>
                    )}
                </div>
                <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${
                    participant.isMuted ? 'text-red-500' : 'text-emerald-500'
                }`}>
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        {participant.isMuted && (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                        )}
                    </svg>
                    {participant.isMuted ? '음소거' : '마이크 켜짐'}
                </div>
            </div>

            {canControl && !isMe && (
                <div className="flex-shrink-0 flex flex-col gap-1">
                    <button
                        onClick={() => onToggleMic(!participant.isMuted)}
                        className="px-2 py-0.5 text-[10px] rounded bg-[var(--highlight-bg)] hover:bg-[var(--border-color)] text-[var(--foreground)] transition-colors"
                    >
                        {participant.isMuted ? '해제' : '음소거'}
                    </button>
                    {!isController && (
                        <button
                            onClick={onAssignController}
                            className="px-2 py-0.5 text-[10px] rounded bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors"
                        >
                            조작자
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ── 유틸 ─────────────────────────────────────────────────────────

const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ── OfflineRoomPage ──────────────────────────────────────────────

interface OfflineRoomPageProps {
    roomId: number;
    roomName: string;
    hostId: number;
    initialControllerId: number | null;
}

export default function OfflineRoomPage({ roomId, roomName, hostId, initialControllerId }: OfflineRoomPageProps) {
    const router = useRouter();
    const [controllerId, setControllerId] = useState<number | null>(initialControllerId);
    const [isLeavingRoom, setIsLeavingRoom] = useState(false);
    const [rightTab, setRightTab] = useState<'chat' | 'memo' | 'summary'>('chat');
    const [meetingId, setMeetingId] = useState<number | null>(null);
    const [chatId, setChatId] = useState<number | null>(null);
    const [isStartingMeeting, setIsStartingMeeting] = useState(false);
    const [isEndingMeeting, setIsEndingMeeting] = useState(false);
    const summaryKey = `room_summary_${roomId}`;
    const [summaryText, setSummaryText] = useState<string | null>(() =>
        typeof window !== 'undefined' ? localStorage.getItem(summaryKey) : null
    );
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [elapsedSecs, setElapsedSecs] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const chatRef = useRef<any>(null);

    // 드래그 가능한 우측 패널 (최소 240px, 최대 560px, 기본 320px)
    const { width: rightPanelWidth, handleMouseDown: handleDragStart } = useResizablePanel({
        initialWidth: 320,
        minWidth: 240,
        maxWidth: 560,
    });

    const { startGlobalMeeting, endGlobalMeeting, volume, isRecording, activeMeetingId } = useMeeting();
    const isThisRecording = isRecording && activeMeetingId === meetingId;
    const isActive = !!meetingId;

    useEffect(() => {
        if (isThisRecording) {
            setElapsedSecs(0);
            timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isThisRecording]);

    const handleLeave = useCallback(async () => {
        if (isLeavingRoom) return;
        setIsLeavingRoom(true);
        try { await roomApi.leave(roomId); } catch { /* ignore */ }
        router.push('/choose');
    }, [roomId, router, isLeavingRoom]);

    const {
        participants, isMicOn, isConnected, error,
        myUserId, toggleMic, toggleMicForUser, leaveRoom,
    } = useOfflineRoom({ roomId, onLeave: handleLeave });

    const myUserIdNum = Number(myUserId);
    const isHost = myUserIdNum === hostId;
    const isControllerUser = myUserIdNum === controllerId;
    const canControl = isHost || isControllerUser;

    const handleAssignController = useCallback(async (userId: string) => {
        try {
            await roomApi.assignController(roomId, Number(userId));
            setControllerId(Number(userId));
        } catch (err) {
            console.error('[OfflineRoom] assignController failed:', err);
        }
    }, [roomId]);

    const handleToggleMicForUser = useCallback(async (userId: string, muted: boolean) => {
        try {
            await roomApi.setMicState(roomId, Number(userId), muted);
        } catch (err) {
            console.error('[OfflineRoom] setMicState failed:', err);
        }
        toggleMicForUser(userId, muted);
    }, [roomId, toggleMicForUser]);

    const handleLeaveClick = () => {
        leaveRoom();
        handleLeave();
    };

    const handleStartMeeting = async () => {
        if (isStartingMeeting) return;
        setIsStartingMeeting(true);
        try {
            const resp = await meetingApi.start(roomName || '오프라인 회의');
            if (resp.success) {
                setMeetingId(resp.meetingId);
                setChatId(resp.chatId);
                await startGlobalMeeting(resp.meetingId, resp.chatId);
            }
        } catch (e) {
            console.error('[OfflineRoom] start meeting failed:', e);
        } finally {
            setIsStartingMeeting(false);
        }
    };

    const handleEndMeeting = async () => {
        if (!meetingId || !window.confirm('회의를 종료하시겠습니까?')) return;
        setIsEndingMeeting(true);
        setIsSummaryLoading(true);
        setRightTab('summary');
        try {
            const resp = await meetingApi.end(meetingId);
            if (resp.success) {
                endGlobalMeeting();
                setMeetingId(null);
                setChatId(null);
                const summary = resp.summary || null;
                setSummaryText(summary);
                if (summary) localStorage.setItem(summaryKey, summary);
                else localStorage.removeItem(summaryKey);
            }
        } catch (e) {
            console.error('[OfflineRoom] end meeting failed:', e);
            setSummaryText(null);
        } finally {
            setIsEndingMeeting(false);
            setIsSummaryLoading(false);
        }
    };

    const allParticipants: Participant[] = [
        { userId: myUserId, name: '나', isMuted: !isMicOn },
        ...Array.from(participants.values()),
    ];

    const barMultipliers = [0.4, 0.6, 0.9, 1.2, 1.5, 1.2, 0.9, 0.6, 0.4];

    return (
        <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">

            {/* ── Header ─────────────────────────────────────────── */}
            <header className="flex-shrink-0 h-12 flex items-center justify-between px-4 border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                    <span className="text-sm font-semibold text-[var(--foreground)] truncate max-w-xs">
                        {roomName || '오프라인 회의'}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        오프라인
                    </span>
                    {isActive && (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            진행 중
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--foreground)] opacity-40">{allParticipants.length}명 참여</span>
                    <button
                        onClick={handleLeaveClick}
                        className="px-3 py-1.5 text-xs text-[var(--foreground)] opacity-50 hover:opacity-100 hover:bg-[var(--highlight-bg)] rounded-md transition-all"
                    >
                        나가기
                    </button>
                </div>
            </header>

            {/* ── Body ───────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left: 참가자 목록 */}
                <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden border-r border-[var(--border-color)] bg-[var(--card-bg)]">
                    <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border-color)]">
                        <span className="text-[10px] font-semibold text-[var(--foreground)] opacity-35 uppercase tracking-wider">
                            참가자 {allParticipants.length}명
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                        {allParticipants.map(p => (
                            <ParticipantItem
                                key={p.userId}
                                participant={p}
                                isMe={p.userId === myUserId}
                                isHost={Number(p.userId) === hostId}
                                isController={Number(p.userId) === controllerId}
                                canControl={canControl}
                                onAssignController={() => handleAssignController(p.userId)}
                                onToggleMic={(muted) => handleToggleMicForUser(p.userId, muted)}
                            />
                        ))}
                    </div>
                </div>

                {/* Center: AI 주제 패널 */}
                <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--border-color)]">
                    <div className="flex-shrink-0 h-12 flex items-center px-6 gap-3 border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                        <h1 className="text-sm font-semibold text-[var(--foreground)] truncate">
                            {roomName || '오프라인 회의'}
                        </h1>
                        <span className="text-xs text-[var(--foreground)] opacity-30">Room #{roomId}</span>
                    </div>

                    {error ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-red-500 text-sm mb-3">{error}</p>
                                <button
                                    onClick={handleLeaveClick}
                                    className="px-4 py-2 bg-[var(--highlight-bg)] hover:bg-[var(--border-color)] text-[var(--foreground)] rounded-lg text-sm transition-colors"
                                >
                                    나가기
                                </button>
                            </div>
                        </div>
                    ) : (
                        <OfflineCenterPanel
                            meetingId={meetingId}
                            roomName={roomName}
                            isActive={isActive}
                        />
                    )}
                </div>

                {/* 드래그 핸들 */}
                <div
                    onMouseDown={handleDragStart}
                    className="flex-shrink-0 w-1.5 cursor-col-resize bg-[var(--border-color)] hover:bg-indigo-400 dark:hover:bg-indigo-500 transition-colors group relative select-none"
                    title="드래그해서 패널 크기 조정"
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="w-0.5 h-3 rounded-full bg-indigo-200" />
                        ))}
                    </div>
                </div>

                {/* Right: AI채팅 / 노트 / 요약 (너비 가변) */}
                <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: rightPanelWidth }}>
                    <div className="flex-shrink-0 flex border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                        {(['chat', 'memo', 'summary'] as const).map((tab) => {
                            const labels = { chat: 'AI 채팅', memo: '노트', summary: 'AI 요약' };
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setRightTab(tab)}
                                    className={`flex-1 py-2.5 text-xs font-semibold transition-all relative ${
                                        rightTab === tab
                                            ? 'text-indigo-600 dark:text-indigo-400'
                                            : 'text-[var(--foreground)] opacity-35 hover:opacity-60'
                                    }`}
                                >
                                    {labels[tab]}
                                    {tab === 'summary' && isSummaryLoading && (
                                        <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                    )}
                                    {rightTab === tab && (
                                        <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-indigo-500 rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        {rightTab === 'chat' && (
                            <ChatInterface
                                ref={chatRef}
                                chatId={chatId}
                                isMeetingActive={isActive}
                            />
                        )}
                        {rightTab === 'memo' && (
                            <SharedMemo roomId={roomId} />
                        )}
                        {rightTab === 'summary' && (
                            <MeetingSummary
                                summary={summaryText}
                                isLoading={isSummaryLoading}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Control bar ────────────────────────────────────── */}
            <div className="flex-shrink-0 h-16 bg-[var(--card-bg)] border-t border-[var(--border-color)] flex items-center px-6 gap-6">
                {/* 마이크 + 음파형 + 상태 */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                        onClick={toggleMic}
                        title={isMicOn ? '마이크 끄기' : '마이크 켜기'}
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            isMicOn ? 'bg-red-50 dark:bg-red-950/20' : 'bg-[var(--highlight-bg)]'
                        }`}
                    >
                        <svg
                            className={`w-4 h-4 ${isMicOn ? 'text-red-500' : 'text-[var(--foreground)] opacity-30'}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            {!isMicOn && (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                            )}
                        </svg>
                    </button>

                    <div className="flex items-center gap-0.5 h-6">
                        {barMultipliers.map((mult, i) => {
                            const activeHeight = Math.max(3, Math.min(22, (volume * mult) / 5));
                            const h = isThisRecording && volume > 5 ? activeHeight : 3;
                            const color = volume > 80
                                ? '#ef4444'
                                : isThisRecording && volume > 5
                                    ? '#6366f1'
                                    : 'var(--border-color)';
                            return (
                                <div
                                    key={i}
                                    className="w-1 rounded-full transition-all duration-75"
                                    style={{ height: `${h}px`, backgroundColor: color }}
                                />
                            );
                        })}
                    </div>

                    <span className={`text-xs font-medium ${
                        isThisRecording ? 'text-red-500' : isActive ? 'text-emerald-500' : 'text-[var(--foreground)] opacity-30'
                    }`}>
                        {isThisRecording ? '녹음 중' : isActive ? '회의 중' : '대기'}
                    </span>
                </div>

                {/* 타이머 */}
                <div className="flex-shrink-0 min-w-[80px] text-center">
                    {isThisRecording ? (
                        <span className="text-xl font-mono font-bold text-[var(--foreground)] tabular-nums">
                            {formatTime(elapsedSecs)}
                        </span>
                    ) : isActive ? (
                        <span className="text-sm text-[var(--foreground)] opacity-30 font-medium">
                            #{meetingId}
                        </span>
                    ) : null}
                </div>

                {/* 회의 시작 / 종료 (단 하나의 버튼) */}
                <div className="flex-1 flex justify-end">
                    {!isActive ? (
                        <button
                            onClick={handleStartMeeting}
                            disabled={isStartingMeeting}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-indigo-500/20"
                        >
                            {isStartingMeeting ? '시작 중...' : '회의 시작'}
                        </button>
                    ) : (
                        <button
                            onClick={handleEndMeeting}
                            disabled={isEndingMeeting}
                            className="px-5 py-2 text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {isEndingMeeting ? '종료 중...' : '회의 종료'}
                        </button>
                    )}
                </div>
            </div>

        </div>
    );
}
