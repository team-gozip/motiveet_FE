'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOfflineRoom } from '@/hooks/useOfflineRoom';
import { useRoomHeartbeat } from '@/hooks/useRoomHeartbeat';
import { roomApi, meetingApi, getAccessToken } from '@/lib/api';
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

    // ── 하트비트 (좀비 룸 방지) ──────────────────────────────────────
    useRoomHeartbeat(roomId);

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
    const [summaryFailed, setSummaryFailed] = useState(false);
    // fresh participant count가 0이면 방이 사실상 버려진 상태 → 모든 기능 정지
    const [isRoomAbandoned, setIsRoomAbandoned] = useState(false);
    const hadActiveMeetingRef = useRef<boolean>(!!initialMeetingId);
    const pollCountRef = useRef(0);
    // 이 세션에서 회의를 실제로 시작한 적이 있는지. 시작한 적 없으면 나갈 때 roomApi.end 호출하지 않음
    // → 방을 재사용 가능 상태(WAITING)로 유지. initialMeetingId/initialSummary가 있으면 이미 회의가 돌았던 방이므로 true.
    const hasStartedMeetingRef = useRef<boolean>(!!initialMeetingId || !!initialSummary);

    // ── 타이머 ───────────────────────────────────────────────────
    const [elapsedSecs, setElapsedSecs] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const chatRef = useRef<{ handleResearch: (topic: string) => Promise<void> } | null>(null);

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

    const handleLeaveClick = async () => {
        if (isLeavingRoom) return;
        leaveRoom();
        // 회의를 실제로 시작한 적 있는 호스트가 나갈 때만 방 종료.
        // 시작 안 한 방은 WAITING으로 남겨 재사용 가능하게.
        // (좀비 방이 되어도 BE stale sweep이 120초 후 정리)
        if (isHost && hasStartedMeetingRef.current) {
            try { await roomApi.end(roomId); } catch { /* ignore */ }
        }
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

    // ── 탭 닫힘/새로고침 시 룸 정리 (좀비 룸 방지) ────────────────
    // SPA router.push로 이탈 시엔 pagehide가 안 뜨므로 정상 handleLeave 경로로 처리됨.
    // 실제 탭 닫기/크래시/네트워크 끊김엔 keepalive fetch가 BE에 leave + end 신호 전달.
    useEffect(() => {
        const onUnload = () => {
            const token = getAccessToken();
            if (!token) return;
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            };
            fetch(`/api/rooms/${roomId}/leave`, {
                method: 'POST', headers, keepalive: true,
            }).catch(() => {});
            // 회의 시작 전 이탈은 방을 재사용 가능한 WAITING으로 유지.
            // 시작 이후에만 end 비컨 전송.
            if (isHost && hasStartedMeetingRef.current) {
                fetch(`/api/rooms/${roomId}/end`, {
                    method: 'POST', headers, keepalive: true,
                }).catch(() => {});
            }
        };
        window.addEventListener('pagehide', onUnload);
        return () => window.removeEventListener('pagehide', onUnload);
    }, [roomId, isHost]);

    // ── 비생성자: 5초 폴링으로 회의 종료 + 요약 감지 ─────────────
    // 실패 탈출구:
    //   1) room.status === 'ENDED' && !summary → 요약 생성 실패로 판정
    //   2) 회의가 돌았던 적 있고 종료 후 90초 경과해도 요약 없으면 실패 판정
    // (BE stale sweep이 120초 후 ENDED 전이시키므로 1번 조건이 대부분 먼저 걸림)
    useEffect(() => {
        if (isHost || nonHostSummary || summaryFailed) return;

        const poll = setInterval(async () => {
            try {
                const room = await roomApi.getById(roomId);
                setNonHostActiveMeetingId(room.activeMeetingId ?? null);
                setIsRoomAbandoned(room.activeParticipantCount === 0);

                if (room.summary) {
                    setNonHostSummary(room.summary);
                    setIsFetchingNonHostSummary(false);
                    return;
                }

                if (room.activeMeetingId) {
                    // 회의 진행 중
                    hadActiveMeetingRef.current = true;
                    pollCountRef.current = 0;
                    setIsFetchingNonHostSummary(false);
                    return;
                }

                // activeMeetingId=null — 회의가 없거나 종료된 상태
                pollCountRef.current += 1;

                // 실패 조건: 방이 ENDED거나, 이전에 회의가 있었고 90초(18 × 5초) 경과
                if (room.status === 'ENDED' ||
                    (hadActiveMeetingRef.current && pollCountRef.current > 18)) {
                    setIsFetchingNonHostSummary(false);
                    setSummaryFailed(true);
                    return;
                }

                // 과거에 회의가 돌았으면 요약 대기 중, 아니면 회의 시작 대기
                setIsFetchingNonHostSummary(hadActiveMeetingRef.current);
            } catch { /* ignore */ }
        }, 5000);

        return () => clearInterval(poll);
    }, [isHost, nonHostSummary, summaryFailed, roomId]);

    // ── Host: 5초 폴링으로 activeParticipantCount 추적 ──────────
    // count === 0이면 방 버려진 상태 → 녹음/마이크 자동 정지
    useEffect(() => {
        if (!isHost) return;
        const poll = setInterval(async () => {
            try {
                const room = await roomApi.getById(roomId);
                setIsRoomAbandoned(room.activeParticipantCount === 0);
            } catch { /* ignore */ }
        }, 5000);
        return () => clearInterval(poll);
    }, [isHost, roomId]);

    // ── 방 버려짐 감지 시 기능 정지 (녹음 stop, 마이크 off) ────
    useEffect(() => {
        if (!isRoomAbandoned) return;
        if (isThisRecording) {
            endGlobalMeeting();
        }
        if (isMicOn) {
            toggleMic();
        }
    // toggleMic/endGlobalMeeting은 ref-stable이라 deps에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRoomAbandoned, isThisRecording, isMicOn]);

    // ── Host: 회의 시작 ───────────────────────────────────────────
    const handleStartMeeting = async () => {
        if (isStartingMeeting) return;
        setIsStartingMeeting(true);
        try {
            // roomId 전달 → BE가 room.note를 meeting.memo 초기값으로 복사 + fallback chat/session 재사용
            const resp = await meetingApi.start(roomName || '오프라인 회의', roomId);
            if (resp.success) {
                hasStartedMeetingRef.current = true;
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
        if (!meetingId || isEndingMeeting) return;
        if (!window.confirm('회의를 종료하시겠습니까?')) return;

        const currentMeetingId = meetingId;
        setIsEndingMeeting(true);
        setIsSummaryLoading(true);

        // 현재 room.note 를 가져와 meeting end body.memo 에 담아 요약에 반영.
        // SharedMemo debounce(1s) 를 기다리진 않으므로 직전 키입력은 누락될 수 있음 — 허용 범위.
        let latestMemo: string | undefined = undefined;
        try {
            const roomLatest = await roomApi.getById(roomId);
            latestMemo = roomLatest.note ?? undefined;
        } catch { /* ignore — end with whatever BE has */ }

        // allSettled로 둘 다 독립 실행 — 하나 실패해도 다른 하나는 완료시킴
        const [endResult, clearResult] = await Promise.allSettled([
            meetingApi.end(currentMeetingId, latestMemo),
            roomApi.setActiveMeeting(roomId, null, null),
        ]);

        // FE 상태는 항상 정리 — BE 일부 실패해도 회의는 사실상 종료된 것으로 처리
        // (pagehide 비컨 + BE stale sweep이 좀비 상태를 복구)
        endGlobalMeeting();
        setMeetingId(null);
        setChatId(null); // effectiveChatId는 dedicatedChatId로 폴백

        let summary: string | null = null;
        if (endResult.status === 'fulfilled' && endResult.value.success) {
            summary = endResult.value.summary || null;
            setHostSummary(summary);
        } else {
            console.error('[OfflineRoom] meetingApi.end failed:',
                endResult.status === 'rejected' ? endResult.reason : endResult.value);
            setHostSummary(null);
        }

        if (clearResult.status === 'rejected') {
            console.error('[OfflineRoom] setActiveMeeting(null) failed:', clearResult.reason);
        }

        // 요약을 방에 저장 → 비생성자 폴링이 확인 가능
        if (summary) {
            try {
                await roomApi.setActiveMeeting(roomId, null, null, summary);
            } catch (e) {
                console.error('[OfflineRoom] save summary to room failed:', e);
            }
        }

        setIsEndingMeeting(false);
        setIsSummaryLoading(false);
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

                {isRoomAbandoned && (
                    <div className="flex-shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/40 flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                            회의 참가자가 없습니다.
                        </span>
                    </div>
                )}

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
                    ) : summaryFailed ? (
                        /* 요약 생성 실패 or 방 종료됨 — 탈출구 제공 */
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center space-y-4 max-w-sm">
                                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                                    <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[var(--foreground)]">요약을 불러올 수 없습니다</p>
                                    <p className="text-xs text-[var(--foreground)] text-[var(--text-secondary)] mt-1 leading-relaxed">
                                        회의가 종료되었으나 AI 요약이 생성되지 않았습니다.<br />
                                        생성자에게 다시 시도해달라고 요청하세요.
                                    </p>
                                </div>
                                <button
                                    onClick={handleLeaveClick}
                                    className="mt-2 px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                                >
                                    나가기
                                </button>
                            </div>
                        </div>
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

            {/* 방 버려짐 배너 — fresh 참가자 0명. 모든 기능 정지됨. */}
            {isRoomAbandoned && (
                <div className="flex-shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/40 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        회의 참가자가 없습니다 — 모든 기능이 정지되었습니다.
                    </span>
                </div>
            )}

            {/* ── Body ─────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* 왼쪽: AI 채팅 (항상 표시, 회의 진행 중에만 사용 가능) */}
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

                    {/* 상단: 회의 중이면 주제 strip + 메모장 라벨, 아니면 탭 헤더 */}
                    <div className="flex-shrink-0">
                        {isActive ? (
                            <>
                                <div className="border-b border-[var(--border-color)]">
                                    <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                                        <span className="text-[10px] font-bold text-[var(--foreground)] text-[var(--text-secondary)] uppercase tracking-wider">
                                            추출된 주제
                                        </span>
                                    </div>
                                    <OfflineCenterPanel
                                        meetingId={meetingId}
                                        roomName={roomName}
                                        isActive={isActive}
                                        onResearch={(topic) => chatRef.current?.handleResearch(topic)}
                                    />
                                </div>
                                <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                                    <span className="text-[10px] font-bold text-[var(--foreground)] text-[var(--text-secondary)] uppercase tracking-wider">
                                        메모장
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
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
                        )}
                    </div>

                    {/* 하단: SharedMemo는 항상 같은 위치에 mount 유지 (isActive 변경 시 remount 방지)
                        회의 전/후 요약 탭 선택 시에는 CSS로 숨기고 MeetingSummary를 위에 덮어 출력 */}
                    <div className="flex-1 overflow-hidden relative">
                        <div className={!isActive && postMeetingView === 'summary' ? 'hidden' : 'h-full'}>
                            <SharedMemo roomId={roomId} />
                        </div>
                        {!isActive && postMeetingView === 'summary' && (
                            <div className="absolute inset-0">
                                <MeetingSummary
                                    summary={hostSummary}
                                    isLoading={isSummaryLoading}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Control bar ────────────────────────────────────── */}
            <div className="flex-shrink-0 h-14 bg-[var(--background)] border-t border-[var(--border-color)] flex items-center px-5 gap-3">

                {/* 마이크 버튼 */}
                <button
                    onClick={toggleMic}
                    disabled={isRoomAbandoned}
                    title={isRoomAbandoned ? '참가자 없음 — 비활성' : (isMicOn ? '마이크 끄기' : '마이크 켜기')}
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
                        disabled={isStartingMeeting || isRoomAbandoned}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20"
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
