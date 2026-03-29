'use client';

interface Folder {
    folderId: number;
    name: string;
    description: string | null;
    createdAt: string;
}

interface FolderCardProps {
    folder: Folder;
    onClick: () => void;
}

// 폴더 이름에서 배경 색상 결정 (일관성 있는 컬러)
const getColor = (name: string) => {
    const colors = [
        'from-indigo-500 to-indigo-600',
        'from-violet-500 to-violet-600',
        'from-blue-500 to-blue-600',
        'from-emerald-500 to-emerald-600',
        'from-amber-500 to-amber-600',
        'from-rose-500 to-rose-600',
        'from-cyan-500 to-cyan-600',
        'from-fuchsia-500 to-fuchsia-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

export default function FolderCard({ folder, onClick }: FolderCardProps) {
    const initial = folder.name.charAt(0).toUpperCase();
    const colorClass = getColor(folder.name);

    return (
        <div onClick={onClick} className="cursor-pointer group select-none">
            {/* Thumbnail */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-3 border border-[var(--border-color)] shadow-sm group-hover:shadow-md transition-all group-hover:scale-[1.02]">
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-80`} />
                {/* Initial letter */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl font-black text-white/80 select-none">
                        {initial}
                    </span>
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 text-xs font-bold text-white bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        입장하기
                    </span>
                </div>
            </div>

            {/* Name */}
            <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-2 px-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {folder.name}
            </p>
            {folder.description && (
                <p className="text-xs text-[var(--foreground)] opacity-40 mt-0.5 px-0.5 line-clamp-1">
                    {folder.description}
                </p>
            )}
        </div>
    );
}
