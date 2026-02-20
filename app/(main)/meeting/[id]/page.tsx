'use client';

import { use } from 'react';
import MainPage from '@/components/main/MainPage';

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <MainPage initialMeetingId={parseInt(id)} />;
}
