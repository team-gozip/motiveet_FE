'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOfflineRoom } from '@/hooks/useOfflineRoom';
import { roomApi, meetingApi } from '@/lib/api';
import { useMeeting } from '@/components/providers/MeetingProvider';
import ChatInterface from '@/components/main/ChatInterface';
import MeetingSummary from '@/components/main/MeetingSummary';
import SharedMemo from './SharedMemo';
import OfflineCenterPanel from './OfflineCenterPanel';

const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

interface OfflineRoomPageProps {
    roomId: number;
    roomName: string;
    hostId: number;
    initialControllerId: number | null;
    initialMeetingId: number | null;
    initialChatId: number | null;
    initialSummary: string | null;
}

export default function OfflineRoomPage({
    roomId,
    roomName,
    hostId,
    initialMeetingId,
    initialChatId,
    initialSummary,
}: OfflineRoomPageProps) {
    const router = useRouter();
    const [isLeavingRoom, setIsLeavingRoom] = useState(false);

    // ── 항상 사용 가능한 AI 채팅용 전용 chatId ────────────────────
    const [dedicatedChatId, setDedicatedChatId] = useState<number | null>(null);

    // ── Host 상태 ────────────────────────────────────────────────
    const [meetingId, setMeetingId] = useState<number | null>(initialMeetingId);
    const [chatId, setChatId] = useState<number | null>(initialChatId);
    const [isStartingMeeting, setIsStartingMeeting] = useState(false);
    const [isEndingMeeting, setIsEndingMeeting] = useState(false);
    const [hostSummary, setHostSummary] = useState<string | null>(initialSummary);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    // 회의 종료 후 탭 뷰 (메모 | AI요약)
    const [postMeetingView, setPostMeetingView] = useState<'memo' | 'summary'>(
        initialSummary && !initialMeetingId ? 'summary' : 'memo'
    );

    // ── 비생성자 상태 ────────────────────────────────────────────
    const [nonHostActiveMeetingId, setNonHostActiveMeetingId] = useState<number | null>(initialMeetingId);
    const [nonHostSummary, setNonHostSummary] = useState<string | null>(initialSummary);
    const [isFetchingNonHostSummary, setIsFetchingNonHostSummary] = useState(false);

    // ── 타이머 ───────────────────────────────────────────────────
    const [elapsedSecs, setElapsedSecs] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const chatRef = useRef<null>(null);

    const { startGlobalMeeting, endGlobalMeeting, volume, isRecording, activeMeetingId } = useMeeting();
    const isThisRecording = isRecording && activeMeetingId === meetingId;
    const isActive = !!meetingId;

    // 회의 중: meeting chatId 사용, 그 외: dedicatedChatId 폴백
    const effectiveChatId = chatId ?? dedicatedChatId;

    const handleLeave = useCallback(async () => {
        if (isLeavingRoom) return;
        setIsLeavingRoom(true);
        try { await roomApi.leave(roomId); } catch { /* ignore */ }
        router.push('/choose');
    }, [roomId, router, isLeavingRoom]);

    const {
        isMicOn, isConnected, error,
        myUserId, toggleMic, leaveRoom,
    } = useOfflineRoom({ roomId, onLeave: handleLeave });

    const myUserIdNum = Number(myUserId);
    const isHost = myUserIdNum === hostId;

    const handleLeaveClick = () => {
        leaveRoom();
        handleLeave();
    };

    // ── 마운트: 참가 + 전용 chatId 로드 + 기존 회의 복원 (host) ─
    useEffect(() => {
        roomApi.join(roomId).catch(() => {});
        // 전용 AI 채팅 chatId 로드 (항상 존재)
        meetingApi.getMe().then(m => setDedicatedChatId(m.chatId)).catch(() => {});
        if (isHost && initialMeetingId && initialChatId) {
            startGlobalMeeting(initialMeetingId, initialChatId).catch(() => {});
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 타이머 ───────────────────────────────────────────────────
    useEffect(() => {
        if (isThisRecording) {
            setElapsedSecs(0);
            timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isThisRecording]);

    // ── 회의 종료 후 자동으로 AI 요약 탭으로 전환 ────────────────
    useEffect(() => {
        if ((hostSummary || isSummaryLoading) && !isActive) {
            setPostMeetingView('summary');
        }
    }, [hostSummary, isSummaryLoading, isActive]);

    // ── 비생성자: 5초 폴링으로 회의 종료 + 요약 감지 ─────────────
    useEffect(() => {
        if (isHost || nonHostSummary) return;

        const poll = setInterval(async () => {
            try {
                const room = await roomApi.getById(roomId);
                setNonHostActiveMeetingId(room.activeMeetingId ?? null);
                if (room.summary) {
                    setNonHostSummary(room.summary);
                    setIsFetchingNonHostSummary(false);
                } else if (!room.activeMeetingId) {
                    setIsFetchingNonHostSummary(true);
                }
            } catch { /* ignore */ }
        }, 5000);

        return () => clearInterval(poll);
    }, [isHost, nonHostSummary, roomId]);

    // ── Host: 회의 시작 ───────────────────────────────────────────
    const handleStartMeeting = async () => {
        if (isStartingMeeting) return;
        setIsStartingMeeting(true);
        try {
            const resp = await meetingApi.start(roomName || '오프라인 회의');
            if (resp.success) {
                setMeetingId(resp.meetingId);
                setChatId(resp.chatId);
                setHostSummary(null);
                await Promise.all([
                    startGlobalMeeting(resp.meetingId, resp.chatId),
                    roomApi.setActiveMeeting(roomId, resp.meetingId, resp.chatId),
                ]);
            }
        } catch (e) {
            console.error('[OfflineRoom] start meeting failed:', e);
        } finally {
            setIsStartingMeeting(false);
        }
    };

    // ── Host: 회의 종료 ───────────────────────────────────────────
    const handleEndMeeting = async () => {
        if (!meetingId || !window.confirm('회의를 종료하시겠습니까?')) return;
        setIsEndingMeeting(true);
        setIsSummaryLoading(true);
        try {
            const [resp] = await Promise.all([
                meetingApi.end(meetingId),
                roomApi.setActiveMeeting(roomId, null, null),
            ]);
            if (resp.success) {
                endGlobalMeeting();
                const summary = resp.summary || null;
                setHostSummary(summary);
                setMeetingId(null);
                setChatId(null); // effectiveChatId가 dedicatedChatId로 폴백
                // 요약을 방에 저장 → 비생성자도 폴링으로 확인 가능
                if (summary) {
                    await roomApi.setActiveMeeting(roomId, null, null, summary);
                }
            }
        } catch (e) {
            console.error('[OfflineRoom] end meeting failed:', e);
            setHostSummary(null);
        } finally {
            setIsEndingMeeting(false);
            setIsSummaryLoading(false);
        }
    };

    const barMultipliers = [0.4, 0.6, 0.9, 1.2, 1.5, 1.2, 0.9, 0.6, 0.4];

    // ═══════════════════════════════════════════════════════════════
    // 공통 헤더
    // ═══════════════════════════════════════════════════════════════
    const Header = ({ isMeetingActive, role }: { isMeetingActive: boolean; role: string }) => (
        <header className="flex-shrink-0 h-12 flex items-center justify-between px-6 border-b border-[var(--border-color)] bg-[var(--card-bg)]">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                <span className="text-sm font-semibold text-[var(--foreground)] truncate">
                    {roomName || '오프라인 회의'}
                </span>
                {isMeetingActive && (
                    <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        진행 중
                    </span>
                )}
            </div>
            <span className="text-[10px] text-[var(--foreground)] text-[var(--text-tertiary)] font-medium">{role}</span>
        </header>
    );

    // ═══════════════════════════════════════════════════════════════
    // 비생성자 뷰
    // ═══════════════════════════════════════════════════════════════
    if (!isHost) {
        const isMeetingActive = !!nonHostActiveMeetingId;

        return (
            <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
                <Header isMeetingActive={isMeetingActive} role="참가자" />

                <div className="flex-1 overflow-hidden">
                    {isMeetingActive ? (
                        /* 회의 진행 중: 차단 화면 */
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center space-y-6 max-w-sm">
                                <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-[var(--highlight-bg)]">
                                    <svg className="w-10 h-10 text-[var(--foreground)] text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-base font-bold text-[var(--foreground)]">회의가 진행 중입니다</p>
                                    <p className="text-sm text-[var(--foreground)] text-[var(--text-secondary)] leading-relaxed">
                                        오프라인 회의는 생성자만 참여할 수 있습니다.<br />
                                        회의가 종료되면 AI 요약을 확인할 수 있습니다.
                                    </p>
                                </div>
                                <div className="flex items-center justify-center gap-2 text-xs text-[var(--foreground)] text-[var(--text-tertiary)]">
                                    <div className="flex gap-1">
                                        {[1, 2, 3].map(i => (
                                            <div
                                                key={i}
                                                className="w-1.5 h-1.5 rounded-full bg-[var(--foreground)] text-[var(--text-secondary)] animate-bounce"
                                                style={{ animationDelay: `${i * 0.2}s` }}
                                            />
                                        ))}
                                    </div>
                                    <span>종료 대기 중</span>
                                </div>
                            </div>
                        </div>
                    ) : isFetchingNonHostSummary ? (
                        /* 요약 생성 중 */
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center space-y-4">
                                <div className="mx-auto w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                                <p className="text-sm text-[var(--foreground)] text-[var(--text-secondary)]">AI 회의 요약을 불러오는 중...</p>
                            </div>
                        </div>
                    ) : nonHostSummary ? (
                        /* 요약 표시 */
                        <MeetingSummary summary={nonHostSummary} isLoading={false} />
                    ) : (
                        /* 회의 없음 */
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center space-y-4 max-w-sm">
                                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-[var(--highlight-bg)]">
                                    <svg className="w-8 h-8 text-[var(--foreground)] text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[var(--foreground)]">아직 요약이 없습니다</p>
                                    <p className="text-xs text-[var(--foreground)] text-[var(--text-secondary)] mt-1 leading-relaxed">
                                        생성자가 회의를 시작하고 종료하면<br />AI 요약이 여기에 표시됩니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 하단 바 */}
                <div className="flex-shrink-0 h-14 bg-[var(--background)] border-t border-[var(--border-color)] flex items-center justify-end px-6">
                    <button
                        onClick={handleLeaveClick}
                        className="text-sm font-semibold text-[var(--foreground)] text-[var(--text-secondary)] hover:opacity-100 transition-opacity"
                    >
                        나가기
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // 생성자(Host) 뷰
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] overflow-hidden">

            <Header isMeetingActive={isActive} role="생성자" />

            {/* ── Body ─────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* 왼쪽: AI 채팅 (항상 표시, 항상 사용 가능) */}
                <div className="flex-shrink-0 w-72 flex flex-col overflow-hidden border-r border-[var(--border-color)] bg-[var(--card-bg)]">
                    <div className="flex-shrink-0 px-4 py-2.5 border-b border-[var(--border-color)]">
                        <span className="text-[10px] font-bold text-[var(--foreground)] text-[var(--text-secondary)] uppercase tracking-wider">
                            AI 채팅
                        </span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <ChatInterface
                            ref={chatRef}
                            chatId={effectiveChatId}
                            isMeetingActive={isActive}
                        />
                    </div>
                </div>

                {/* 오른쪽: 상태에 따라 다른 레이아웃 */}
                <div className="flex-1 flex flex-col overflow-hidden">

                    {isActive ? (
                        /* ── 회의 중: 추출된 주제 상단 + 메모 하단 ── */
                        <>
                            {/* 추출된 주제 strip */}
                            <div className="flex-shrink-0 border-b border-[var(--border-color)]">
                                <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                                    <span className="text-[10px] font-bold text-[var(--foreground)] text-[var(--text-secondary)] uppercase tracking-wider">
                                        추출된 주제
                                    </span>
                                </div>
                                <OfflineCenterPanel
                                    meetingId={meetingId}
                                    roomName={roomName}
                                    isActive={isActive}
                                />
                            </div>

                            {/* 메모장 (회의 중에는 고정) */}
                            <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                                <span className="text-[10px] font-bold text-[var(--foreground)] text-[var(--text-secondary)] uppercase tracking-wider">
                                    메모장
                                </span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <SharedMemo roomId={roomId} />
                            </div>
                        </>
                    ) : (
                        /* ── 회의 전/후: 메모 | AI 요약 탭 ── */
                        <>
                            {/* 탭 헤더 */}
                            <div className="flex-shrink-0 flex items-center border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                                <button
                                    onClick={() => setPostMeetingView('memo')}
                                    className={`px-5 py-3 text-[11px] font-bold border-r border-[var(--border-color)] transition-all ${
                                        postMeetingView === 'memo'
                                            ? 'text-[var(--foreground)] bg-[var(--card-bg)]'
                                            : 'text-[var(--foreground)] text-[var(--text-tertiary)] hover:opacity-60'
                                    }`}
                                >
                                    메모장
                                </button>
                                <button
                                    onClick={() => {
                                        if (hostSummary || isSummaryLoading) setPostMeetingView('summary');
                                    }}
                                    className={`px-5 py-3 text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                                        postMeetingView === 'summary'
                                            ? 'text-[var(--foreground)] bg-[var(--card-bg)]'
                                            : hostSummary || isSummaryLoading
                                                ? 'text-[var(--foreground)] text-[var(--text-tertiary)] hover:opacity-60'
                                                : 'text-[var(--foreground)] text-[var(--text-tertiary)] cursor-not-allowed'
                                    }`}
                                >
                                    AI 회의 요약
                                    {isSummaryLoading && (
                                        <span className="inline-block w-2.5 h-2.5 rounded-full border border-indigo-500/50 border-t-indigo-500 animate-spin" />
                                    )}
                                </button>
                            </div>

                            {/* 탭 내용 */}
                            <div className="flex-1 overflow-hidden">
                                {postMeetingView === 'memo' ? (
                                    <SharedMemo roomId={roomId} />
                                ) : (
                                    <MeetingSummary
                                        summary={hostSummary}
                                        isLoading={isSummaryLoading}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Control bar ────────────────────────────────────── */}
            <div className="flex-shrink-0 h-14 bg-[var(--background)] border-t border-[var(--border-color)] flex items-center px-5 gap-3">

                {/* 마이크 버튼 */}
                <button
                    onClick={toggleMic}
                    title={isMicOn ? '마이크 끄기' : '마이크 켜기'}
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        isMicOn ? 'bg-red-50 dark:bg-red-950/20' : 'bg-[var(--highlight-bg)]'
                    }`}
                >
                    <svg
                        className={`w-3.5 h-3.5 ${isMicOn ? 'text-red-500' : 'text-[var(--foreground)] text-[var(--text-tertiary)]'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        {!isMicOn && (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                        )}
                    </svg>
                </button>

                {/* 음파형 */}
                <div className="flex items-center gap-0.5 h-5">
                    {barMultipliers.map((mult, i) => {
                        const activeHeight = Math.max(2, Math.min(18, (volume * mult) / 5));
                        const h = isThisRecording && volume > 5 ? activeHeight : 2;
                        const color = volume > 80
                            ? '#ef4444'
                            : isThisRecording && volume > 5
                                ? '#6366f1'
                                : 'var(--border-color)';
                        return (
                            <div
                                key={i}
                                className="w-0.5 rounded-full transition-all duration-75"
                                style={{ height: `${h}px`, backgroundColor: color }}
                            />
                        );
                    })}
                </div>

                {/* runtime */}
                <span className={`text-xs font-mono tabular-nums ${
                    isThisRecording ? 'text-red-500' : 'text-[var(--foreground)] opacity-25'
                }`}>
                    {isThisRecording ? formatTime(elapsedSecs) : isActive ? '회의 중' : 'standby'}
                </span>

                <div className="flex-1" />

                {/* 회의 시작 / 종료 (host only) */}
                {!isActive ? (
                    <button
                        onClick={handleStartMeeting}
                        disabled={isStartingMeeting}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:text-[var(--text-secondary)] shadow-sm shadow-indigo-500/20"
                    >
                        {isStartingMeeting ? '시작 중...' : '회의 시작'}
                    </button>
                ) : (
                    <button
                        onClick={handleEndMeeting}
                        disabled={isEndingMeeting}
                        className="px-4 py-1.5 text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-xs font-semibold transition-colors disabled:text-[var(--text-secondary)]"
                    >
                        {isEndingMeeting ? '종료 중...' : '회의 종료'}
                    </button>
                )}

                <div className="w-px h-5 bg-[var(--border-color)]" />

                {/* 나가기 */}
                <button
                    onClick={handleLeaveClick}
                    className="text-sm font-semibold text-[var(--foreground)] text-[var(--text-secondary)] hover:opacity-100 transition-opacity"
                >
                    나가기
                </button>
            </div>

        </div>
    );
}
