'use client';

import { useEffect, useState } from 'react';
import { meetingApi, subjectApi } from '@/lib/api';
import { useMeeting } from '@/components/providers/MeetingProvider';

interface Meeting {
    meetingId: number;
    title: string;
    startedAt: string;
    endedAt: string | null;
    subjectCount?: number;
}

interface Subject {
    subjectId: number;
    text: string;
    meetingId: number;
    chatId: number;
    createdAt: string;
}

interface SidebarProps {
    onMeetingSelect?: (meetingId: number) => void;
    onSubjectSelect?: (subject: Subject) => void;
}

export default function Sidebar({ onMeetingSelect, onSubjectSelect }: SidebarProps) {
    const { activeMeetingId } = useMeeting();
    const [activeTab, setActiveTab] = useState<'meetings' | 'subjects'>('meetings');
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cursor, setCursor] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        if (isLoading || !hasMore) return;

        setIsLoading(true);
        try {
            if (activeTab === 'meetings') {
                const response = await meetingApi.getHistory(cursor || undefined, 10);
                setMeetings(prev => cursor ? [...prev, ...response.meetings] : response.meetings);
                setCursor(response.nextCursor);
                setHasMore(response.nextCursor !== null);
            } else {
                const response = await subjectApi.getHistory(cursor || undefined, 10);
                setSubjects(prev => cursor ? [...prev, ...response.subjects] : response.subjects);
                setCursor(response.nextCursor);
                setHasMore(response.nextCursor !== null);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = (tab: 'meetings' | 'subjects') => {
        setActiveTab(tab);
        setCursor(null);
        setHasMore(true);
        setMeetings([]);
        setSubjects([]);
    };

    const handleDeleteMeeting = async (e: React.MouseEvent, meetingId: number) => {
        e.stopPropagation();
        const meeting = meetings.find(m => m.meetingId === meetingId);
        if (meeting && !meeting.endedAt) {
            alert('현재 진행 중인 회의는 삭제할 수 없습니다. 먼저 회의를 종료해 주세요.');
            return;
        }
        if (!confirm('이 회의를 삭제하시겠습니까?')) return;

        try {
            await meetingApi.delete(meetingId);
            setMeetings(prev => prev.filter(m => m.meetingId !== meetingId));
        } catch (error) {
            console.error('Failed to delete meeting:', error);
            alert('회의 삭제에 실패했습니다.');
        }
    };

    const handleDeleteSubject = async (e: React.MouseEvent, subjectId: number) => {
        e.stopPropagation();
        if (!confirm('이 주제를 삭제하시겠습니까?')) return;

        try {
            await subjectApi.delete(subjectId);
            setSubjects(prev => prev.filter(s => s.subjectId !== subjectId));
        } catch (error) {
            console.error('Failed to delete subject:', error);
            alert('주제 삭제에 실패했습니다.');
        }
    };

    return (
        <div className="h-full bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] flex flex-col transition-colors duration-300">
            {/* Tab Headers */}
            <div className="flex border-b border-[var(--border-color)] bg-[var(--background)]">
                <button
                    onClick={() => handleTabChange('meetings')}
                    className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'meetings'
                        ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] bg-[var(--highlight-bg)]'
                        : 'text-[var(--foreground)] opacity-40 hover:opacity-100 hover:bg-[var(--highlight-bg)]/50'
                        }`}
                >
                    회의 목록
                </button>
                <button
                    onClick={() => handleTabChange('subjects')}
                    className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'subjects'
                        ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] bg-[var(--highlight-bg)]'
                        : 'text-[var(--foreground)] opacity-40 hover:opacity-100 hover:bg-[var(--highlight-bg)]/50'
                        }`}
                >
                    주제 목록
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {activeTab === 'meetings' ? (
                    <>
                        {meetings.map((meeting) => (
                            <div
                                key={meeting.meetingId}
                                className="relative group w-full text-left p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--accent-primary)]/30 hover:bg-[var(--highlight-bg)]/30 transition-all cursor-pointer"
                                onClick={() => onMeetingSelect?.(meeting.meetingId)}
                            >
                                <h3 className="font-bold text-sm text-[var(--foreground)] truncate pr-8">
                                    {meeting.title || `회의 #${meeting.meetingId}`}
                                </h3>
                                <p className="text-[10px] text-[var(--foreground)] opacity-40 mt-1 font-medium">
                                    {new Date(meeting.startedAt).toLocaleString('ko-KR')}
                                </p>
                                {meeting.endedAt && (
                                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold bg-[var(--highlight-bg)] text-[var(--accent-primary)] opacity-70 rounded border border-[var(--border-color)] uppercase">
                                        종료됨
                                    </span>
                                )}
                                {activeMeetingId === meeting.meetingId && !meeting.endedAt && (
                                    <span className="inline-block mt-2 ml-2 px-2 py-0.5 text-[10px] font-bold bg-[var(--accent-primary)] text-white rounded border border-[var(--accent-primary)] uppercase animate-pulse shadow-[0_0_8px_var(--accent-primary)]">
                                        진행중
                                    </span>
                                )}
                                {/* 삭제 버튼 */}
                                <button
                                    onClick={(e) => handleDeleteMeeting(e, meeting.meetingId)}
                                    className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--foreground)] opacity-0 group-hover:opacity-30 hover:!opacity-100 hover:text-[var(--accent-primary)] hover:bg-[var(--highlight-bg)] transition-all"
                                    title="회의 삭제"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        {subjects.map((subject) => (
                            <div
                                key={subject.subjectId}
                                className="relative group w-full text-left p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--accent-primary)]/30 hover:bg-[var(--highlight-bg)]/30 transition-all cursor-pointer"
                                onClick={() => onSubjectSelect?.(subject)}
                            >
                                <p className="text-sm font-medium text-[var(--foreground)] opacity-90 line-clamp-2 pr-8 leading-snug">
                                    {subject.text}
                                </p>
                                <p className="text-[10px] text-[var(--foreground)] opacity-40 mt-1 font-medium">
                                    {new Date(subject.createdAt).toLocaleString('ko-KR')}
                                </p>
                                {/* 삭제 버튼 */}
                                <button
                                    onClick={(e) => handleDeleteSubject(e, subject.subjectId)}
                                    className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--foreground)] opacity-0 group-hover:opacity-30 hover:!opacity-100 hover:text-[var(--accent-primary)] hover:bg-[var(--highlight-bg)] transition-all"
                                    title="주제 삭제"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </>
                )}

                {isLoading && (
                    <div className="text-center py-6">
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[var(--highlight-bg)] border-t-[var(--accent-primary)]"></div>
                    </div>
                )}

            </div>
        </div>
    );
}
