'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/main/Sidebar';
import CurrentSubject from '@/components/main/CurrentSubject';
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

export default function MainPage({ initialMeetingId }: MainPageProps) {
    const { theme, toggleTheme } = useTheme();
    const { lastAnalysisResult } = useMeeting();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [currentMeeting, setCurrentMeeting] = useState<any>(null);
    const [currentSubject, setCurrentSubject] = useState<any>(null);
    const [suggestedSubjects, setSuggestedSubjects] = useState<string[]>([]);
    const [chatId, setChatId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'chat' | 'memo'>('chat');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [summaryText, setSummaryText] = useState<string>('');
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [currentMemo, setCurrentMemo] = useState('');
    const chatRef = useRef<any>(null);

    useEffect(() => {
        // Check authentication
        if (!isAuthenticated()) {
            router.push('/login');
            return;
        }

        if (initialMeetingId) {
            handleMeetingSelect(initialMeetingId);
        } else {
            // Dashboard mode: clear all meeting-specific states
            setCurrentMeeting(null);
            setCurrentSubject(null);
            setChatId(null);
            setSuggestedSubjects([]);
            setIsLoading(false);
        }
    }, [initialMeetingId]);

    // ── 주제 자동 갱신 폴링 ─────────────────────────────────────────
    // 회의가 활성화된 동안 10초마다 BE에서 최신 주제 목록을 가져와
    // 새로고침 없이도 AI 추출 주제 버튼이 자동으로 나타납니다.
    useEffect(() => {
        const meetingId = currentMeeting?.meetingId;
        const isActive = meetingId && !currentMeeting?.endedAt;
        if (!isActive) return;

        const pollTopics = async () => {
            try {
                const res = await subjectApi.getCurrent(meetingId);

                // 주제 목록 갱신 (중복 제거)
                if (res.suggestions && res.suggestions.length > 0) {
                    setSuggestedSubjects(prev => {
                        const combined = [...prev, ...res.suggestions];
                        return combined.filter((v, i, self) => self.indexOf(v) === i);
                    });
                }

                // 현재 주제가 바뀌었을 때만 업데이트 -> 사용자 요청으로 자동 변경 방지 (Suggestions만 업데이트)
                /* 
                const newSubject = res.subject;
                if (newSubject) {
                    setCurrentSubject((prev: any) => {
                        const prevId = prev?.subjectId;
                        const newId = newSubject.subjectId;
                        if (prevId !== newId) {
                            if (newSubject.chatId) setChatId(newSubject.chatId);
                            return newSubject;
                        }
                        return prev;
                    });
                }
                */
            } catch {
                // 폴링 오류는 무시 (회의 흐름에 영향 없음)
            }
        };

        const intervalId = setInterval(pollTopics, 10000); // 10초마다
        return () => clearInterval(intervalId);
    }, [currentMeeting?.meetingId, currentMeeting?.endedAt]);


    const loadCurrentMeeting = async () => {
        setIsLoading(true);
        try {
            const meeting = await meetingApi.getCurrent();
            if (meeting) {
                setCurrentMeeting(meeting);
                setChatId(meeting.chatId);

                // Load current subject
                const subjectResponse = await subjectApi.getCurrent(meeting.meetingId);
                if (subjectResponse.subject) {
                    setCurrentSubject(subjectResponse.subject);
                    // setChatId(subjectResponse.subject.chatId); // Disable auto-switch
                    setSuggestedSubjects(subjectResponse.suggestions || []);
                }
            }
        } catch (error) {
            console.error('Failed to load current meeting:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMeetingStart = (meetingId: number, newChatId: number) => {
        // Navigate to the meeting page
        router.push(`/meeting/${meetingId}`);
    };

    const handleMeetingEnd = (summary?: string) => {
        if (summary) {
            setSummaryText(summary);
            setShowSummaryModal(true);
        } else {
            // No summary, just go back
            router.push('/dashboard');
        }
    };

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

            const subjectResponse = await subjectApi.getCurrent(meetingId);
            // Always update state to clear old data if no subject found
            setCurrentSubject(subjectResponse.subject || null);
            if (subjectResponse.subject) {
                // setChatId(subjectResponse.subject.chatId); // Disable auto-switch
            }
            setSuggestedSubjects(subjectResponse.suggestions || []);
        } catch (error) {
            console.error('Failed to load meeting:', error);
            setCurrentMeeting(null);
            setCurrentSubject(null);
            setChatId(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubjectUpdate = (response: any) => {
        console.log('[MainPage] Subject response update:', response);
        if (response.subject) {
            const updatedSubject = { ...response.subject };
            if (response.summary) {
                updatedSubject.summary = response.summary;
            }
            // Update current subject
            setCurrentSubject(updatedSubject);

            // If the subject has its own chatId, update it
            if (updatedSubject.chatId) {
                // setChatId(updatedSubject.chatId); // Disable auto-switch
            }
        }

        // Handle suggestions/topics
        if (response.suggestions || response.newTopics) {
            const incomingTopics = response.suggestions || response.newTopics || [];
            console.log('[MainPage] Processing topics:', incomingTopics);

            setSuggestedSubjects(prev => {
                // Merge old and new, filter duplicates
                const combined = [...prev, ...incomingTopics];
                const unique = combined.filter((val, idx, self) => self.indexOf(val) === idx);
                return unique;
            });
        }
    };

    // React to real-time audio analysis results
    useEffect(() => {
        if (lastAnalysisResult && currentMeeting?.meetingId && !currentMeeting?.endedAt) {
            handleSubjectUpdate(lastAnalysisResult);
        }
    }, [lastAnalysisResult]);

    const handleResearchRequest = (topic: string) => {
        if (chatRef.current) {
            setActiveTab('chat');
            chatRef.current.handleResearch(topic);
        }
    };

    const handleLogout = () => {
        logout();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mb-4"></div>
                    <p className="text-zinc-400">로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
            {/* Header */}
            <header className="h-16 bg-[var(--header-bg)]/80 backdrop-blur-md border-b border-[var(--border-color)] shadow-sm transition-all duration-300 z-30 sticky top-0">
                <div className="h-full px-6 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Link href="/" className="flex items-center space-x-2 group">
                            <img
                                src={theme === 'dark' ? '/white_logo2.png' : '/dark_logo2.png'}
                                alt="Motiveet"
                                className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
                            />
                        </Link>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Theme Toggle Button */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-[var(--card-bg)] transition-all duration-300 border border-[var(--border-color)] group shadow-sm bg-[var(--background)]"
                            aria-label="Toggle Theme"
                        >
                            {theme === 'dark' ? (
                                <svg className="w-5 h-5 text-yellow-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                            )}
                        </button>

                        <button
                            onClick={handleLogout}
                            className="px-4 py-1.5 text-sm font-medium bg-[var(--card-bg)] hover:brightness-90 text-[var(--foreground)] rounded-md transition-all border border-[var(--border-color)] shadow-sm"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Sidebar Toggle Button */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-6 h-12 bg-[var(--card-bg)] border border-l-0 border-[var(--border-color)] rounded-r-md flex items-center justify-center hover:brightness-90 transition-all shadow-lg text-[var(--foreground)]"
                >
                    <svg
                        className={`w-4 h-4 text-inherit transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {/* Sidebar */}
                <div className={`flex-shrink-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-80' : 'w-0'} overflow-hidden border-r border-[var(--border-color)]`}>
                    <Sidebar
                        onMeetingSelect={handleMeetingSelect}
                        onSubjectSelect={(subject) => {
                            console.log('Subject selected:', subject);
                            setCurrentSubject(subject);
                            if (subject.chatId) {
                                setChatId(subject.chatId);
                            }
                        }}
                    />
                </div>

                {/* Main Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]">
                    <div className="flex-1 overflow-y-auto p-6 pb-32 space-y-6">
                        {/* Current Subject Area */}
                        <div className="space-y-6">
                            <CurrentSubject
                                subject={currentSubject}
                                meetingId={currentMeeting?.meetingId || null}
                                isActive={!!currentMeeting && !currentMeeting.endedAt}
                                suggestions={suggestedSubjects}
                                summary={currentSubject?.summary}
                                files={currentSubject?.files || []}
                                onSubjectChange={(newSub) => {
                                    setCurrentSubject(newSub);
                                    // If suggestions are returned during creation, update them too
                                    if (newSub.suggestions) setSuggestedSubjects(newSub.suggestions);
                                }}
                                onResearch={handleResearchRequest}
                            />
                        </div>

                        {/* Interactive Area: Chat or Memo */}
                        <div className="bg-[var(--card-bg)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--border-color)] transition-colors duration-300 flex flex-col h-[600px]">
                            {/* Tab Switcher */}
                            <div className="flex border-b border-[var(--border-color)] bg-[var(--background)] p-1.5 space-x-1">
                                <button
                                    onClick={() => setActiveTab('chat')}
                                    className={`flex-1 flex items-center justify-center py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'chat'
                                        ? 'bg-[var(--accent-primary)] text-white shadow-lg'
                                        : 'text-[var(--foreground)] opacity-40 hover:opacity-100'
                                        }`}
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                    </svg>
                                    AI 채팅
                                </button>
                                <button
                                    onClick={() => setActiveTab('memo')}
                                    className={`flex-1 flex items-center justify-center py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'memo'
                                        ? 'bg-[var(--accent-primary)] text-white shadow-lg'
                                        : 'text-[var(--foreground)] opacity-40 hover:opacity-100'
                                        }`}
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    회의 메모
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden relative">
                                {activeTab === 'chat' ? (
                                    <ChatInterface
                                        ref={chatRef}
                                        chatId={chatId}
                                        isMeetingActive={!!currentMeeting && !currentMeeting.endedAt}
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
                </div>
            </div>

            {/* Floating Footer: Meeting Controls (2/5 size centered) */}
            <div className="fixed bottom-8 left-0 right-0 z-40 flex justify-center pointer-events-none">
                <div className="w-[40%] min-w-[400px] pointer-events-auto">
                    <MeetingControls
                        isActive={!!currentMeeting && !currentMeeting.endedAt}
                        meetingId={currentMeeting?.meetingId || null}
                        onMeetingStart={handleMeetingStart}
                        onMeetingEnd={handleMeetingEnd}
                        onSubjectUpdate={handleSubjectUpdate}
                        memo={currentMemo}
                    />
                </div>
            </div>

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
