'use client';

import { useState } from 'react';
import { folderApi } from '@/lib/api';

interface Folder {
    folderId: number;
    name: string;
    description: string | null;
    createdAt: string;
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
            onCreated(folder);
        } catch (e) {
            setError('그룹 생성에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold text-[var(--foreground)]">새 그룹 만들기</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-[var(--foreground)] opacity-40 hover:opacity-100 transition-opacity"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-3 mb-5">
                    <div>
                        <label className="text-xs font-semibold text-[var(--foreground)] opacity-50 mb-1.5 block uppercase tracking-wider">
                            그룹 이름 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            placeholder="예: 개발팀, 주간 스탠드업"
                            className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder-[var(--foreground)] placeholder-opacity-20"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-[var(--foreground)] opacity-50 mb-1.5 block uppercase tracking-wider">
                            설명 (선택)
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="이 그룹에 대한 간단한 설명"
                            className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder-[var(--foreground)] placeholder-opacity-20"
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-red-500">{error}</p>
                    )}
                </div>

                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-[var(--foreground)] opacity-50 hover:opacity-100 transition-opacity"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !name.trim()}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                        {isLoading ? '생성 중...' : '만들기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
