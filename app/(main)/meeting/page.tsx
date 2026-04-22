'use client';

import { useState, useEffect } from 'react';
import MainPage from '@/components/main/MainPage';
import { meetingApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

export default function DedicatedMeetingPage() {
    const [meetingId, setMeetingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push('/login');
            return;
        }

        const fetchMeeting = async () => {
            try {
                const meeting = await meetingApi.getMe();
                setMeetingId(meeting.meetingId);
            } catch (err: any) {
                console.error('Failed to fetch dedicated meeting:', err);
                setError(err.message || '회의 정보를 가져오는 데 실패했습니다.');
            }
        };

        fetchMeeting();
    }, [router]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
                <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-[var(--danger)]/10 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-5 h-5 text-[var(--danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                    </div>
                    <h1 className="text-sm font-semibold text-[var(--foreground)] mb-1">오류 발생</h1>
                    <p className="text-xs text-[var(--text-secondary)] mb-5 leading-relaxed">{error}</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="h-9 px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium transition-colors"
                    >
                        대시보드로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    if (!meetingId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[var(--border-color)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
                    <p className="text-xs text-[var(--text-tertiary)]">회의실로 입장 중...</p>
                </div>
            </div>
        );
    }

    return <MainPage initialMeetingId={meetingId} />;
}
