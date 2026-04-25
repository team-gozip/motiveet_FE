'use client';

import { useState } from 'react';
import { folderApi } from '@/lib/api';

interface Folder {
    folderId: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
    createdAt: string;
    isOwner: boolean;
}

interface CreateFolderModalProps {
    onClose: () => void;
    onCreated: (folder: Folder) => void;
}

export default function CreateFolderModal({ onClose, onCreated }: CreateFolderModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError('그룹 이름을 입력해주세요.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const folder = await folderApi.create(name.trim(), description.trim() || undefined);
            onCreated({ ...folder, imageUrl: null, isOwner: true });
        } catch {
            setError('그룹 생성에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-lg w-full max-w-md">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">새 그룹 만들기</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-5 py-5 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                            그룹 이름 <span className="text-[var(--danger)]">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            placeholder="예: 개발팀, 주간 스탠드업"
                            className="w-full h-10 px-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                            설명 <span className="text-[var(--text-tertiary)]">(선택)</span>
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="이 그룹에 대한 간단한 설명"
                            className="w-full h-10 px-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all"
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-[var(--danger)]">{error}</p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[var(--highlight-bg)] border-t border-[var(--border-color)] rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="h-8 px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !name.trim()}
                        className="h-8 px-3.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-md text-sm font-medium transition-colors"
                    >
                        {isLoading ? '생성 중...' : '만들기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
