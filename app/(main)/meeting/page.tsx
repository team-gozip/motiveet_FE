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
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
                <div className="text-center p-8 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">오류 발생</h1>
                    <p className="text-zinc-400 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-2 bg-[var(--accent-primary)] hover:brightness-110 rounded-lg transition-all"
                    >
                        대시보드로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    if (!meetingId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mb-4"></div>
                    <p className="text-zinc-400">회의실로 입장 중...</p>
                </div>
            </div>
        );
    }

    return <MainPage initialMeetingId={meetingId} />;
}
