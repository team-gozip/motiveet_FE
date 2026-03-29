import { use } from 'react';
import RoomPage from '@/components/room/RoomPage';

interface PageProps {
    params: Promise<{ roomId: string }>;
}

export default function Page({ params }: PageProps) {
    const { roomId } = use(params);
    return <RoomPage roomId={Number(roomId)} />;
}
