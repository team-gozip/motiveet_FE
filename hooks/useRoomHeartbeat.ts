import { useEffect } from 'react';
import { roomApi } from '@/lib/api';

const HEARTBEAT_INTERVAL_MS = 30_000;

export function useRoomHeartbeat(roomId: number | null | undefined) {
    useEffect(() => {
        if (!roomId) return;

        let cancelled = false;
        const ping = () => {
            if (cancelled) return;
            roomApi.heartbeat(roomId).catch(() => {});
        };

        ping();
        const timer = setInterval(ping, HEARTBEAT_INTERVAL_MS);

        const onVisibility = () => {
            if (document.visibilityState === 'visible') ping();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            cancelled = true;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [roomId]);
}
