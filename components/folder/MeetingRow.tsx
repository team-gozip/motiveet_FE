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

const deriveBadge = (room: Room) => {
    if (room.status === 'ENDED') {
        return { text: '종료', color: 'text-[var(--text-tertiary)]', dot: 'bg-[var(--text-tertiary)]' };
    }
    if (room.activeMeetingId != null) {
        return { text: '진행 중', color: 'text-[var(--success)]', dot: 'bg-[var(--success)] animate-pulse' };
    }
    return { text: '대기', color: 'text-[var(--warning)]', dot: 'bg-[var(--warning)]' };
};

export default function MeetingRow({ room, onClick, selectMode = false, checked = false, onToggle }: MeetingRowProps) {
    const { text: statusText, color: statusColor, dot: statusDot } = deriveBadge(room);

    const isActive = room.activeMeetingId != null;
    const isDisabledForSelect = selectMode && isActive;

    const handleClick = selectMode
        ? (isDisabledForSelect ? undefined : onToggle)
        : onClick;

    return (
        <div
            onClick={handleClick}
            title={isDisabledForSelect ? '진행 중인 회의는 삭제할 수 없습니다' : undefined}
            className={`flex items-center gap-4 px-4 h-14 border-b border-[var(--border-color)] transition-colors group ${
                isDisabledForSelect
                    ? 'opacity-40 cursor-not-allowed'
                    : selectMode && checked
                        ? 'bg-red-50 dark:bg-red-950/20 cursor-pointer'
                        : 'hover:bg-[var(--highlight-bg)] cursor-pointer'
            }`}
        >
            {selectMode && (
                <div
                    className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isDisabledForSelect
                            ? 'bg-transparent border-[var(--border-color)]'
                            : checked
                                ? 'bg-[var(--danger)] border-[var(--danger)]'
                                : 'bg-transparent border-[var(--border-color)] group-hover:border-[var(--danger)]'
                    }`}
                >
                    {checked && !isDisabledForSelect && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
            )}

            {/* Type tag */}
            <span className={`flex-shrink-0 inline-flex items-center h-5 px-1.5 text-[10px] font-semibold rounded border uppercase tracking-wider ${
                room.type === 'ONLINE'
                    ? 'text-[var(--accent-primary)] border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'
                    : 'text-[var(--success)] border-[var(--success)]/30 bg-[var(--success)]/5'
            }`}>
                {room.type === 'ONLINE' ? '온라인' : '오프라인'}
            </span>

            {/* Name */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
                    {room.name}
                </p>
            </div>

            {/* Status */}
            <div className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium ${statusColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                {statusText}
            </div>

            {/* Date */}
            <span className="flex-shrink-0 text-xs text-[var(--text-tertiary)] tabular-nums w-20 text-right">
                {toKST(room.createdAt)}
            </span>

            {!selectMode && (
                <svg className="flex-shrink-0 w-4 h-4 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            )}
        </div>
    );
}
