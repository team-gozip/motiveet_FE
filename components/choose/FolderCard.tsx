'use client';

interface Folder {
    folderId: number;
    name: string;
    description: string | null;
    imageUrl?: string | null;
    createdAt: string;
    isOwner?: boolean;
}

interface FolderCardProps {
    folder: Folder;
    onClick: () => void;
    onEdit?: () => void;
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

export default function FolderCard({ folder, onClick, onEdit }: FolderCardProps) {
    const initial = folder.name.charAt(0).toUpperCase();

    return (
        <div className="group relative bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-primary)]/40 hover:shadow-sm transition-all">
            {/* Clickable area */}
            <button
                onClick={onClick}
                className="w-full text-left p-5"
            >
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-[var(--highlight-bg)] border border-[var(--border-color)] flex items-center justify-center text-[var(--foreground)] font-semibold text-base flex-shrink-0">
                        {folder.imageUrl ? (
                            <img src={folder.imageUrl} alt={folder.name} className="w-full h-full object-cover" />
                        ) : (
                            initial
                        )}
                    </div>
                    {folder.isOwner && (
                        <span className="mt-1 text-[10px] font-medium text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-1.5 py-0.5 rounded self-start">
                            OWNER
                        </span>
                    )}
                    {/* spacer to prevent title area from overlapping three-dot button */}
                    {folder.isOwner && onEdit && <span className="ml-auto w-7 flex-shrink-0" />}
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

            {/* Three-dot menu button — owner only */}
            {folder.isOwner && onEdit && (
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="absolute top-3.5 right-3.5 z-10 w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] opacity-0 group-hover:opacity-100 transition-all"
                    title="그룹 수정"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                    </svg>
                </button>
            )}
        </div>
    );
}
