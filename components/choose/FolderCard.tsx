'use client';

interface Folder {
    folderId: number;
    name: string;
    description: string | null;
    createdAt: string;
    isOwner?: boolean;
}

interface FolderCardProps {
    folder: Folder;
    onClick: () => void;
}

const toKST = (ts: string) => {
    const d = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z');
    return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Seoul',
    });
};

export default function FolderCard({ folder, onClick }: FolderCardProps) {
    const initial = folder.name.charAt(0).toUpperCase();

    return (
        <button
            onClick={onClick}
            className="group text-left bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-5 hover:border-[var(--accent-primary)]/40 hover:shadow-sm transition-all"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-md bg-[var(--highlight-bg)] border border-[var(--border-color)] flex items-center justify-center text-[var(--foreground)] font-semibold text-base">
                    {initial}
                </div>
                {folder.isOwner && (
                    <span className="text-[10px] font-medium text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-1.5 py-0.5 rounded">
                        OWNER
                    </span>
                )}
            </div>

            <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                {folder.name}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 min-h-[2rem]">
                {folder.description || '설명이 없습니다'}
            </p>

            <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
                <span>{toKST(folder.createdAt)}</span>
                <span className="flex items-center gap-1 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    입장
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </span>
            </div>
        </button>
    );
}
