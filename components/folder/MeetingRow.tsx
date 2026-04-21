'use client';

interface Room {
    roomId: number;
    name: string;
    type: 'ONLINE' | 'OFFLINE';
    status: 'WAITING' | 'ACTIVE' | 'ENDED';
    activeMeetingId: number | null;
    createdAt: string;
}

interface MeetingRowProps {
    room: Room;
    onClick: () => void;
    selectMode?: boolean;
    checked?: boolean;
    onToggle?: () => void;
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

// 배지는 "실제 회의 진행 여부"(activeMeetingId)와 "방 라이프사이클"(status)을 분리해서 판정.
// status=ACTIVE여도 activeMeetingId가 null이면 회의는 끝난 것 → "대기 중"으로 표시.
const deriveBadge = (room: Room) => {
    if (room.status === 'ENDED') {
        return { text: '종료됨', color: 'text-[var(--text-tertiary)]', bg: 'bg-[var(--highlight-bg)]' };
    }
    if (room.activeMeetingId != null) {
        return { text: '진행 중', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20' };
    }
    return { text: '대기 중', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20' };
};

export default function MeetingRow({ room, onClick, selectMode = false, checked = false, onToggle }: MeetingRowProps) {
    const { text: statusText, color: statusColor, bg: statusBg } = deriveBadge(room);

    const handleClick = selectMode ? onToggle : onClick;

    return (
        <div
            onClick={handleClick}
            className={`flex items-center px-4 py-3.5 rounded-xl border cursor-pointer transition-all group ${
                selectMode && checked
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-400 dark:border-red-900/60'
                    : 'bg-[var(--card-bg)] border-[var(--border-color)] hover:border-[var(--accent-primary)]/30 hover:shadow-sm'
            }`}
        >
            {/* Checkbox (select mode) */}
            {selectMode && (
                <div
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 mr-3 flex items-center justify-center transition-colors ${
                        checked
                            ? 'bg-red-500 border-red-500'
                            : 'bg-transparent border-[var(--border-color)] group-hover:border-red-400'
                    }`}
                >
                    {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
            )}

            {/* Type icon */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mr-3 ${
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
                <p className="text-sm font-semibold text-[var(--foreground)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
                    {room.name}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {toKST(room.createdAt)}
                </p>
            </div>

            {/* Status + arrow */}
            <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColor} ${statusBg}`}>{statusText}</span>
                {!selectMode && (
                    <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                )}
            </div>
        </div>
    );
}
