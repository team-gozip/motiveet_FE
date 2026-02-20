'use client';

import { useEffect, useState } from 'react';
import { meetingApi } from '@/lib/api';
import { useMeeting } from '@/components/providers/MeetingProvider';

// SQLite func.now()는 UTC를 반환하지만 Z가 없어서 JS가 로컬로 해석함
const toKSTFull = (timestamp: string) => {
    const ts = timestamp.endsWith('Z') || timestamp.includes('+') ? timestamp : timestamp + 'Z';
    return new Date(ts).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
};

interface Meeting {
    meetingId: number;
    title: string;
    startedAt: string;
    endedAt: string | null;
}

interface SidebarProps {
    onMeetingSelect?: (meetingId: number) => void;
    refreshTrigger?: number;
}

export default function Sidebar({ onMeetingSelect, refreshTrigger }: SidebarProps) {
    const { activeMeetingId } = useMeeting();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cursor, setCursor] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        setMeetings([]);
        setCursor(null);
        setHasMore(true);
        loadFreshData();
    }, [refreshTrigger, activeMeetingId]);

    const loadFreshData = async () => {
        setIsLoading(true);
        try {
            const response = await meetingApi.getHistory(undefined, 20);
            setMeetings(response.meetings);
            setCursor(response.nextCursor);
            setHasMore(response.nextCursor !== null);
        } catch (error) {
            console.error('Failed to load meetings:', error);
        } finally {
            setIsLoading(false);
        }
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

    return (
        <div className="h-full bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] flex flex-col transition-colors duration-300">
            {/* Header */}
            <div className="flex border-b border-[var(--border-color)] bg-[var(--background)]">
                <div className="flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] bg-[var(--highlight-bg)]">
                    회의 목록
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
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
                            {toKSTFull(meeting.startedAt)}
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

                {isLoading && (
                    <div className="text-center py-6">
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[var(--highlight-bg)] border-t-[var(--accent-primary)]"></div>
                    </div>
                )}

            </div>
        </div>
    );
}
