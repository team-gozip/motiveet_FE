'use client';

interface Room {
    roomId: number;
    name: string;
    type: 'ONLINE' | 'OFFLINE';
    status: 'WAITING' | 'ACTIVE' | 'ENDED';
    createdAt: string;
}

interface MeetingRowProps {
    room: Room;
    onClick: () => void;
}

const toKST = (ts: string) => {
    const d = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z');
    return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Seoul',
    }).replace(/\. /g, '.').replace(/\.$/, '');
};

const statusLabel: Record<Room['status'], { text: string; color: string }> = {
    WAITING: { text: '대기 중', color: 'text-amber-500' },
    ACTIVE:  { text: '진행 중', color: 'text-emerald-500' },
    ENDED:   { text: '종료됨',  color: 'text-[var(--foreground)] opacity-30' },
};

export default function MeetingRow({ room, onClick }: MeetingRowProps) {
    const { text: statusText, color: statusColor } = statusLabel[room.status];

    return (
        <div
            onClick={onClick}
            className="flex items-center px-4 py-3.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-indigo-400/40 hover:bg-[var(--highlight-bg)] cursor-pointer transition-all group"
        >
            {/* Type icon */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                room.type === 'ONLINE'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30'
                    : 'bg-emerald-100 dark:bg-emerald-900/30'
            }`}>
                {room.type === 'ONLINE' ? (
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                    {room.name}
                </p>
                <p className="text-xs text-[var(--foreground)] opacity-35 mt-0.5">
                    {toKST(room.createdAt)}
                </p>
            </div>

            {/* Status + arrow */}
            <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
                <svg className="w-4 h-4 text-[var(--foreground)] opacity-20 group-hover:opacity-60 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </div>
    );
}
