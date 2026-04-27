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

    useEffect(() => {
        setTranscriptSegments([]);
        setSuggestedSubjects([]);
    }, [currentMeeting?.meetingId]);

    useEffect(() => {
        if (!lastAnalysisResult || !currentMeeting?.meetingId || currentMeeting?.endedAt) return;

        const topics: string[] = lastAnalysisResult.suggestions || lastAnalysisResult.newTopics || [];
        if (topics.length > 0) {
            setSuggestedSubjects(prev => {
                const combined = [...prev, ...topics];
                return combined.filter((v, i, s) => s.indexOf(v) === i);
            });
        }

        if (lastAnalysisResult.transcript) {
            setTranscriptSegments(prev => [...prev, {
                id: ++_segId,
                text: lastAnalysisResult.transcript,
                time: new Date(),
            }]);
        }
    }, [lastAnalysisResult]);

    useEffect(() => {
        const meetingId = currentMeeting?.meetingId;
        if (!meetingId) return;

        const pollMeetingStatus = async () => {
            try {
                const meeting = await meetingApi.getById(meetingId);
                setCurrentMeeting(meeting);
            } catch { }
        };

        const id = setInterval(pollMeetingStatus, 5000);
        return () => clearInterval(id);
    }, [currentMeeting?.meetingId]);

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

    const handleMeetingStart = (meetingId: number, _newChatId: number) => {
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
                <div className="w-6 h-6 border-2 border-[var(--border-color)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
            {/* Header */}
            <header className="flex-shrink-0 h-12 flex items-center justify-between px-4 border-b border-[var(--border-color)] bg-[var(--header-bg)]">
                <Link href="/choose" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <img
                        src={theme === 'dark' ? '/dark_logo2.png' : '/white_logo2.png'}
                        alt="Motiveet"
                        className="h-6 w-auto object-contain"
                    />
                </Link>

                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleTheme}
                        className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
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
                        className="h-8 px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] rounded-md transition-colors"
                    >
                        로그아웃
                    </button>
                </div>
            </header>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Sidebar */}
                <aside className="w-60 flex-shrink-0 overflow-hidden">
                    <Sidebar
                        onMeetingSelect={handleMeetingSelect}
                        activeMeetingId={currentMeeting?.meetingId}
                        refreshTrigger={sidebarRefreshKey}
                    />
                </aside>

                {/* Center: Transcript */}
                <main className="flex-1 flex flex-col overflow-hidden border-x border-[var(--border-color)] bg-[var(--card-bg)]">
                    {/* Meeting info bar */}
                    <div className="flex-shrink-0 h-12 flex items-center px-6 gap-3 border-b border-[var(--border-color)]">
                        {currentMeeting ? (
                            <>
                                <h1 className="text-sm font-semibold text-[var(--foreground)] truncate">
                                    {currentMeeting.title}
                                </h1>
                                {isActive ? (
                                    <span className="flex-shrink-0 inline-flex items-center gap-1.5 h-5 px-2 text-[10px] font-semibold rounded text-[var(--success)] bg-[var(--success)]/10">
                                        <span className="w-1 h-1 rounded-full bg-[var(--success)] animate-pulse" />
                                        진행 중
                                    </span>
                                ) : (
                                    <span className="flex-shrink-0 inline-flex items-center h-5 px-2 text-[10px] font-semibold rounded text-[var(--text-tertiary)] border border-[var(--border-color)]">
                                        종료됨
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-xs text-[var(--text-tertiary)]">
                                회의를 선택하거나 새로 시작하세요
                            </span>
                        )}
                    </div>

                    <TranscriptView
                        segments={transcriptSegments}
                        isRecording={isThisRecording}
                        currentMeeting={currentMeeting}
                    />
                </main>

                {/* Right: Topics + Chat/Memo */}
                <aside className="w-80 flex-shrink-0 flex flex-col overflow-hidden bg-[var(--card-bg)]">
                    {/* AI Topics */}
                    <div className="flex-shrink-0 border-b border-[var(--border-color)] px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                                AI 추출 주제
                            </span>
                            {suggestedSubjects.length > 0 && (
                                <span className="text-[10px] font-semibold text-[var(--accent-primary)] tabular-nums">
                                    {suggestedSubjects.length}
                                </span>
                            )}
                            {isActive && (
                                <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                                    <span className="w-1 h-1 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                                    실시간
                                </span>
                            )}
                        </div>

                        {suggestedSubjects.length === 0 ? (
                            <p className="text-xs text-[var(--text-tertiary)] py-0.5">
                                {isActive ? '대화를 분석하는 중...' : '추출된 주제가 없습니다'}
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                {suggestedSubjects.map((topic, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleResearchRequest(topic)}
                                        title={`"${topic}" 검색`}
                                        disabled={!isActive}
                                        className="h-6 px-2 text-[11px] bg-[var(--highlight-bg)] hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--foreground)] rounded border border-[var(--border-color)] hover:border-[var(--accent-primary)]/30 transition-colors"
                                    >
                                        {topic}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex-shrink-0 flex border-b border-[var(--border-color)]">
                        {[
                            { id: 'chat', label: 'AI 채팅' },
                            { id: 'memo', label: '메모' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setRightTab(tab.id as 'chat' | 'memo')}
                                className={`flex-1 h-10 text-xs font-medium transition-colors relative ${
                                    rightTab === tab.id
                                        ? 'text-[var(--foreground)]'
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                }`}
                            >
                                {tab.label}
                                {rightTab === tab.id && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)]" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-hidden">
                        {rightTab === 'chat' ? (
                            <ChatInterface
                                ref={chatRef}
                                chatId={chatId}
                                sessionId={currentMeeting?.sessionId ?? null}
                                isMeetingActive={isActive}
                            />
                        ) : (
                            <Memo
                                meetingId={currentMeeting?.meetingId || null}
                                onContentChange={setCurrentMemo}
                            />
                        )}
                    </div>
                </aside>
            </div>

            {/* Bottom controls */}
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
