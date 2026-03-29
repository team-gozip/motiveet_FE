'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/main/Sidebar';
import TranscriptView, { TranscriptSegment } from '@/components/main/TranscriptView';
import ChatInterface from '@/components/main/ChatInterface';
import MeetingControls from '@/components/main/MeetingControls';
import Memo from '@/components/main/Memo';
import SummaryModal from '@/components/main/SummaryModal';
import { isAuthenticated, logout } from '@/lib/auth';
import { meetingApi, subjectApi } from '@/lib/api';
import { useTheme } from '@/components/common/ThemeProvider';
import { useMeeting } from '@/components/providers/MeetingProvider';

interface MainPageProps {
    initialMeetingId?: number;
}

let _segId = 0;

export default function MainPage({ initialMeetingId }: MainPageProps) {
    const { theme, toggleTheme } = useTheme();
    const { lastAnalysisResult, isRecording, activeMeetingId: recordingMeetingId } = useMeeting();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [currentMeeting, setCurrentMeeting] = useState<any>(null);
    const [suggestedSubjects, setSuggestedSubjects] = useState<string[]>([]);
    const [chatId, setChatId] = useState<number | null>(null);
    const [rightTab, setRightTab] = useState<'chat' | 'memo'>('chat');
    const [summaryText, setSummaryText] = useState('');
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [currentMemo, setCurrentMemo] = useState('');
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
    const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
    const chatRef = useRef<any>(null);

    const isActive = !!currentMeeting && !currentMeeting.endedAt;
    const isThisRecording = isRecording && recordingMeetingId === currentMeeting?.meetingId;

    // Auth check
    useEffect(() => {
        if (!isAuthenticated()) {
            router.push('/login');
            return;
        }
        if (initialMeetingId) {
            handleMeetingSelect(initialMeetingId);
        } else {
            setCurrentMeeting(null);
            setChatId(null);
            setSuggestedSubjects([]);
            setIsLoading(false);
        }
    }, [initialMeetingId]);

    // Reset transcript when meeting changes
    useEffect(() => {
        setTranscriptSegments([]);
        setSuggestedSubjects([]);
    }, [currentMeeting?.meetingId]);

    // Process real-time audio analysis results
    useEffect(() => {
        if (!lastAnalysisResult || !currentMeeting?.meetingId || currentMeeting?.endedAt) return;

        // Update topics
        const topics: string[] = lastAnalysisResult.suggestions || lastAnalysisResult.newTopics || [];
        if (topics.length > 0) {
            setSuggestedSubjects(prev => {
                const combined = [...prev, ...topics];
                return combined.filter((v, i, s) => s.indexOf(v) === i);
            });
        }

        // Append transcript segment if returned
        if (lastAnalysisResult.transcript) {
            setTranscriptSegments(prev => [...prev, {
                id: ++_segId,
                text: lastAnalysisResult.transcript,
                time: new Date(),
            }]);
        }
    }, [lastAnalysisResult]);

    // Polling for topics (10s)
    useEffect(() => {
        const meetingId = currentMeeting?.meetingId;
        if (!meetingId || currentMeeting?.endedAt) return;

        const poll = async () => {
            try {
                const res = await subjectApi.getCurrent(meetingId);
                if (res.suggestions?.length > 0) {
                    setSuggestedSubjects(prev => {
                        const combined = [...prev, ...res.suggestions];
                        return combined.filter((v, i, s) => s.indexOf(v) === i);
                    });
                }
            } catch { }
        };

        const id = setInterval(poll, 10000);
        return () => clearInterval(id);
    }, [currentMeeting?.meetingId, currentMeeting?.endedAt]);

    const handleMeetingSelect = async (meetingId: number) => {
        if (initialMeetingId !== meetingId) {
            router.push(`/meeting/${meetingId}`);
            return;
        }
        setIsLoading(true);
        try {
            const meeting = await meetingApi.getById(meetingId);
            setCurrentMeeting(meeting);
            setChatId(meeting.chatId);
            const subResp = await subjectApi.getCurrent(meetingId);
            setSuggestedSubjects(subResp.suggestions || []);
        } catch {
            setCurrentMeeting(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMeetingStart = (meetingId: number, newChatId: number) => {
        setSidebarRefreshKey(k => k + 1);
        router.push(`/meeting/${meetingId}`);
    };

    const handleMeetingEnd = (summary?: string) => {
        setSidebarRefreshKey(k => k + 1);
        if (summary) {
            setSummaryText(summary);
            setShowSummaryModal(true);
        } else {
            router.push('/dashboard');
        }
    };

    const handleResearchRequest = (topic: string) => {
        if (chatRef.current) {
            setRightTab('chat');
            chatRef.current.handleResearch(topic);
        }
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-[var(--background)]">
                <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
            {/* ── Header ── 48px ───────────────────────────────────────── */}
            <header className="flex-shrink-0 h-12 flex items-center justify-between px-4 border-b border-[var(--border-color)] bg-[var(--header-bg)]">
                <Link href="/" className="flex items-center">
                    <img
                        src={theme === 'dark' ? '/dark_logo2.png' : '/white_logo2.png'}
                        alt="Motiveet"
                        className="h-7 w-auto object-contain"
                    />
                </Link>
                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-md hover:bg-[var(--highlight-bg)] transition-colors text-[var(--foreground)] opacity-50 hover:opacity-100"
                        aria-label="테마 전환"
                    >
                        {theme === 'dark' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={logout}
                        className="px-3 py-1.5 text-xs text-[var(--foreground)] opacity-50 hover:opacity-100 hover:bg-[var(--highlight-bg)] rounded-md transition-all"
                    >
                        로그아웃
                    </button>
                </div>
            </header>

            {/* ── Body: 3 columns ──────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left: Sidebar 240px */}
                <div className="w-60 flex-shrink-0 overflow-hidden">
                    <Sidebar
                        onMeetingSelect={handleMeetingSelect}
                        activeMeetingId={currentMeeting?.meetingId}
                        refreshTrigger={sidebarRefreshKey}
                    />
                </div>

                {/* Center: Transcript */}
                <div className="flex-1 flex flex-col overflow-hidden border-x border-[var(--border-color)]">
                    {/* Meeting info bar */}
                    <div className="flex-shrink-0 h-12 flex items-center px-6 gap-3 border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                        {currentMeeting ? (
                            <>
                                <h1 className="text-sm font-semibold text-[var(--foreground)] truncate">
                                    {currentMeeting.title}
                                </h1>
                                {isActive ? (
                                    <span className="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-semibold border border-emerald-100 dark:border-emerald-900/30">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        진행 중
                                    </span>
                                ) : (
                                    <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium text-[var(--foreground)] opacity-30 border border-[var(--border-color)] rounded-full">
                                        종료됨
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-xs text-[var(--foreground)] opacity-30">
                                회의를 선택하거나 새로 시작하세요
                            </span>
                        )}
                    </div>

                    {/* Transcript */}
                    <TranscriptView
                        segments={transcriptSegments}
                        isRecording={isThisRecording}
                        currentMeeting={currentMeeting}
                    />
                </div>

                {/* Right: Topics + Chat/Memo 320px */}
                <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
                    {/* AI Topics section */}
                    <div className="flex-shrink-0 border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                        <div className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-[10px] font-semibold text-[var(--foreground)] opacity-35 uppercase tracking-wider">
                                    AI 추출 주제
                                </span>
                                {suggestedSubjects.length > 0 && (
                                    <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full min-w-[18px] text-center">
                                        {suggestedSubjects.length}
                                    </span>
                                )}
                                {isActive && (
                                    <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--foreground)] opacity-25">
                                        <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                                        실시간
                                    </span>
                                )}
                            </div>

                            {suggestedSubjects.length === 0 ? (
                                <p className="text-xs text-[var(--foreground)] opacity-25 py-1">
                                    {isActive ? '대화를 분석하는 중...' : '추출된 주제가 없습니다'}
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                    {suggestedSubjects.map((topic, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleResearchRequest(topic)}
                                            title={`"${topic}" 검색`}
                                            className="px-2.5 py-1 text-[11px] bg-[var(--highlight-bg)] hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-[var(--foreground)] hover:text-indigo-600 dark:hover:text-indigo-300 rounded-full border border-[var(--border-color)] hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all active:scale-95"
                                        >
                                            {topic}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tab bar */}
                    <div className="flex-shrink-0 flex border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                        <button
                            onClick={() => setRightTab('chat')}
                            className={`flex-1 py-2.5 text-xs font-semibold transition-all relative ${
                                rightTab === 'chat'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-[var(--foreground)] opacity-35 hover:opacity-60'
                            }`}
                        >
                            AI 채팅
                            {rightTab === 'chat' && (
                                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-indigo-500 rounded-full" />
                            )}
                        </button>
                        <button
                            onClick={() => setRightTab('memo')}
                            className={`flex-1 py-2.5 text-xs font-semibold transition-all relative ${
                                rightTab === 'memo'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-[var(--foreground)] opacity-35 hover:opacity-60'
                            }`}
                        >
                            메모
                            {rightTab === 'memo' && (
                                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-indigo-500 rounded-full" />
                            )}
                        </button>
                    </div>

                    {/* Chat or Memo */}
                    <div className="flex-1 overflow-hidden">
                        {rightTab === 'chat' ? (
                            <ChatInterface
                                ref={chatRef}
                                chatId={chatId}
                                isMeetingActive={isActive}
                            />
                        ) : (
                            <Memo
                                meetingId={currentMeeting?.meetingId || null}
                                onContentChange={setCurrentMemo}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Bottom: Recording controls ── 64px ───────────────────── */}
            <MeetingControls
                isActive={isActive}
                meetingId={currentMeeting?.meetingId || null}
                onMeetingStart={handleMeetingStart}
                onMeetingEnd={handleMeetingEnd}
                memo={currentMemo}
            />

            <SummaryModal
                isOpen={showSummaryModal}
                onClose={() => {
                    setShowSummaryModal(false);
                    router.push('/dashboard');
                }}
                summary={summaryText}
            />
        </div>
    );
}
