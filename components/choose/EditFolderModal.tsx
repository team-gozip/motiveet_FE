'use client';

import { useState, useRef } from 'react';
import { folderApi } from '@/lib/api';

interface Folder {
    folderId: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
    createdAt: string;
    isOwner: boolean;
}

interface EditFolderModalProps {
    folder: Folder;
    onClose: () => void;
    onUpdated: (folder: Folder) => void;
    onDeleted: (folderId: number) => void;
}

export default function EditFolderModal({ folder, onClose, onUpdated, onDeleted }: EditFolderModalProps) {
    const [name, setName] = useState(folder.name);
    const [description, setDescription] = useState(folder.description ?? '');
    const [imageUrl, setImageUrl] = useState<string | null>(folder.imageUrl);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const initial = name.charAt(0).toUpperCase() || folder.name.charAt(0).toUpperCase();

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setError('이미지 파일 크기는 2MB 이하여야 합니다.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            setImageUrl(ev.target?.result as string);
            setError('');
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError('그룹 이름을 입력해주세요.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const updated = await folderApi.update(folder.folderId, {
                name: name.trim(),
                description: description.trim() || undefined,
                imageUrl: imageUrl,
            });
            onUpdated({ ...folder, ...updated, isOwner: true });
        } catch {
            setError('그룹 수정에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setIsDeleting(true);
        try {
            await folderApi.delete(folder.folderId);
            onDeleted(folder.folderId);
        } catch {
            setError('그룹 삭제에 실패했습니다. 다시 시도해주세요.');
            setIsDeleting(false);
            setConfirmDelete(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-lg w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">그룹 수정</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-5 py-5 space-y-5">
                    {/* Image section */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">그룹 이미지</label>
                        <div className="flex items-center gap-4">
                            {/* Preview */}
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[var(--border-color)] flex-shrink-0 bg-[var(--highlight-bg)]">
                                {imageUrl ? (
                                    <img src={imageUrl} alt="그룹 이미지" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[var(--foreground)] font-bold text-xl">
                                        {initial}
                                    </div>
                                )}
                            </div>
                            {/* Buttons */}
                            <div className="flex flex-col gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-7 px-3 text-xs bg-[var(--highlight-bg)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--foreground)] rounded-md transition-colors"
                                >
                                    이미지 삽입
                                </button>
                                {imageUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setImageUrl(null)}
                                        className="h-7 px-3 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-md transition-colors"
                                    >
                                        이미지 삭제
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setImageUrl(null)}
                                    className="h-7 px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--highlight-bg)] border border-[var(--border-color)] rounded-md transition-colors"
                                >
                                    기본 이미지 사용
                                </button>
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageSelect}
                        />
                    </div>

                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                            그룹 이름 <span className="text-[var(--danger)]">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            placeholder="그룹 이름"
                            className="w-full h-10 px-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                            그룹 설명 <span className="text-[var(--text-tertiary)]">(선택)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="이 그룹에 대한 설명을 작성하세요"
                            rows={3}
                            className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all resize-none"
                        />
                    </div>

                    {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-5 py-3 bg-[var(--highlight-bg)] border-t border-[var(--border-color)] rounded-b-xl">
                    {/* Delete button */}
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className={`h-8 px-3 text-sm rounded-md font-medium transition-colors ${
                            confirmDelete
                                ? 'bg-[var(--danger)] text-white hover:bg-red-700'
                                : 'text-[var(--danger)] hover:bg-[var(--danger)]/10'
                        } disabled:opacity-40`}
                    >
                        {isDeleting ? '삭제 중...' : confirmDelete ? '정말 삭제하기' : '삭제하기'}
                    </button>

                    <div className="flex items-center gap-2">
                        {confirmDelete && (
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="h-8 px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                            >
                                취소
                            </button>
                        )}
                        {!confirmDelete && (
                            <>
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
                                    {isLoading ? '수정 중...' : '수정하기'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
