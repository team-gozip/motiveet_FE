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
    const [search, setSearch] = useState('');

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

    const filtered = search.trim()
        ? meetings.filter(m => (m.title || '').toLowerCase().includes(search.toLowerCase()))
        : meetings;

    const grouped: Record<string, Meeting[]> = {};
    for (const m of filtered) {
        const { date } = toKST(m.startedAt);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(m);
    }

    return (
        <div className="h-full flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--border-color)]">
            {/* Header */}
            <div className="flex-shrink-0 h-12 flex items-center px-4 border-b border-[var(--border-color)]">
                <span className="text-xs font-semibold text-[var(--foreground)]">회의 기록</span>
                <span className="ml-auto text-[11px] text-[var(--text-tertiary)] tabular-nums">
                    {meetings.length}
                </span>
            </div>

            {/* Search */}
            <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border-color)]">
                <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="검색"
                        className="w-full h-8 pl-8 pr-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/40 transition-all"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading && (
                    <div className="flex justify-center py-8">
                        <div className="w-4 h-4 border-2 border-[var(--border-color)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
                    </div>
                )}

                {!isLoading && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <svg className="w-6 h-6 text-[var(--text-tertiary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <p className="text-xs text-[var(--text-tertiary)]">
                            {search ? '검색 결과가 없습니다' : '아직 회의 기록이 없습니다'}
                        </p>
                    </div>
                )}

                {Object.entries(grouped).map(([date, dayMeetings]) => (
                    <div key={date} className="py-1">
                        <div className="px-4 pt-3 pb-1">
                            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
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
                                    className={`group relative mx-2 my-0.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                                        isSelected
                                            ? 'bg-[var(--accent-primary)]/10'
                                            : 'hover:bg-[var(--highlight-bg)]'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        {isRecordingThis && (
                                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                                        )}
                                        <p className={`text-[13px] truncate ${
                                            isSelected
                                                ? 'text-[var(--accent-primary)] font-medium'
                                                : 'text-[var(--foreground)]'
                                        }`}>
                                            {meeting.title || `회의 #${meeting.meetingId}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">{time}</span>
                                        {!meeting.endedAt && (
                                            <span className="text-[10px] font-semibold text-[var(--success)]">
                                                진행 중
                                            </span>
                                        )}
                                    </div>

                                    {meeting.endedAt && (
                                        <button
                                            onClick={(e) => handleDelete(e, meeting.meetingId)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--background)] transition-all"
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
