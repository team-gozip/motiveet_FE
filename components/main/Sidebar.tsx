'use client';

import { useEffect, useState } from 'react';
import { meetingApi } from '@/lib/api';
import { useMeeting } from '@/components/providers/MeetingProvider';

const toKST = (ts: string) => {
    const d = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z');
    return {
        date: d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }),
        time: d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }),
    };
};

interface Meeting {
    meetingId: number;
    title: string;
    startedAt: string;
    endedAt: string | null;
}

interface SidebarProps {
    onMeetingSelect?: (meetingId: number) => void;
    activeMeetingId?: number | null;
    refreshTrigger?: number;
}

export default function Sidebar({ onMeetingSelect, activeMeetingId: selectedMeetingId, refreshTrigger }: SidebarProps) {
    const { activeMeetingId: recordingMeetingId } = useMeeting();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadMeetings();
    }, [refreshTrigger, recordingMeetingId]);

    const loadMeetings = async () => {
        setIsLoading(true);
        try {
            const resp = await meetingApi.getHistory(undefined, 30);
            setMeetings(resp.meetings);
        } catch { }
        finally { setIsLoading(false); }
    };

    const handleDelete = async (e: React.MouseEvent, meetingId: number) => {
        e.stopPropagation();
        const m = meetings.find(m => m.meetingId === meetingId);
        if (!m?.endedAt) return;
        if (!window.confirm('이 회의를 삭제하시겠습니까?')) return;
        try {
            await meetingApi.delete(meetingId);
            setMeetings(prev => prev.filter(m => m.meetingId !== meetingId));
        } catch { }
    };

    // Group by date
    const grouped: Record<string, Meeting[]> = {};
    for (const m of meetings) {
        const { date } = toKST(m.startedAt);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(m);
    }

    return (
        <div className="h-full flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--border-color)]">
            {/* Header */}
            <div className="flex-shrink-0 h-12 flex items-center px-4 border-b border-[var(--border-color)]">
                <span className="text-[11px] font-semibold text-[var(--foreground)] opacity-40 uppercase tracking-wider">
                    회의 기록
                </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading && (
                    <div className="flex justify-center py-8">
                        <div className="w-4 h-4 border-2 border-[var(--border-color)] border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                )}

                {!isLoading && meetings.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <svg className="w-6 h-6 text-[var(--foreground)] opacity-15 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <p className="text-xs text-[var(--foreground)] opacity-25">아직 회의 기록이 없습니다</p>
                    </div>
                )}

                {Object.entries(grouped).map(([date, dayMeetings]) => (
                    <div key={date}>
                        <div className="px-4 pt-4 pb-1">
                            <span className="text-[10px] font-semibold text-[var(--foreground)] opacity-30 uppercase tracking-wider">
                                {date}
                            </span>
                        </div>

                        {dayMeetings.map(meeting => {
                            const isRecordingThis = recordingMeetingId === meeting.meetingId;
                            const isSelected = selectedMeetingId === meeting.meetingId;
                            const { time } = toKST(meeting.startedAt);

                            return (
                                <div
                                    key={meeting.meetingId}
                                    onClick={() => onMeetingSelect?.(meeting.meetingId)}
                                    className={`group relative flex items-center px-4 py-3 cursor-pointer transition-colors border-l-2 ${
                                        isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500'
                                            : 'hover:bg-[var(--highlight-bg)] border-transparent'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0 pr-6">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            {isRecordingThis && (
                                                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            )}
                                            <p className={`text-[13px] font-medium truncate ${
                                                isSelected
                                                    ? 'text-indigo-700 dark:text-indigo-300'
                                                    : 'text-[var(--foreground)]'
                                            }`}>
                                                {meeting.title || `회의 #${meeting.meetingId}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-[var(--foreground)] opacity-35">{time}</span>
                                            {!meeting.endedAt && (
                                                <span className="text-[10px] font-semibold text-emerald-500">
                                                    진행 중
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {meeting.endedAt && (
                                        <button
                                            onClick={(e) => handleDelete(e, meeting.meetingId)}
                                            className="absolute right-3 p-1 rounded opacity-0 group-hover:opacity-30 hover:!opacity-100 hover:text-red-500 text-[var(--foreground)] transition-all"
                                            title="삭제"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
