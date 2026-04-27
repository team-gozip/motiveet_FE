import { use } from 'react';
import RoomLobby from '@/components/room/RoomLobby';

interface PageProps {
    params: Promise<{ roomId: string }>;
}

export default function Page({ params }: PageProps) {
    const { roomId } = use(params);
    return <RoomLobby roomId={Number(roomId)} />;
}
