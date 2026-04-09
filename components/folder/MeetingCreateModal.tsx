'use client';

import { useState } from 'react';
import { roomApi } from '@/lib/api';

interface MeetingCreateModalProps {
    folderId: number;
    roomType: 'ONLINE' | 'OFFLINE';
    onClose: () => void;
    onCreated: (roomId: number) => void;
}

interface Participant {
    id: string;
    username: string;
}

export default function MeetingCreateModal({ folderId, roomType, onClose, onCreated }: MeetingCreateModalProps) {
    const [title, setTitle] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [addInput, setAddInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAddParticipant = () => {
        const username = addInput.trim();
        if (!username) return;
        if (participants.some(p => p.username === username)) {
            setAddInput('');
            return;
        }
        setParticipants(prev => [...prev, { id: String(Date.now()), username }]);
        setAddInput('');
    };

    const handleRemoveParticipant = (id: string) => {
        setParticipants(prev => prev.filter(p => p.id !== id));
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            setError('회의 주제를 입력해주세요.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const room = await roomApi.create(folderId, title.trim(), roomType);
            await roomApi.join(room.roomId);
            onCreated(room.roomId);
        } catch (e) {
            setError('회의 생성에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Title input — dark header style */}
                <div className="bg-[var(--foreground)] px-5 py-4">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => { setTitle(e.target.value); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder="회의 주제 입력"
                        className="w-full bg-transparent text-[var(--background)] text-base font-semibold placeholder-[var(--background)]/40 outline-none"
                        autoFocus
                    />
                </div>

                {/* Participants */}
                <div className="bg-[var(--highlight-bg)] min-h-[140px] max-h-[220px] overflow-y-auto">
                    {participants.length === 0 && (
                        <div className="flex items-center justify-center h-20">
                            <p className="text-xs text-[var(--foreground)] text-[var(--text-tertiary)]">
                                초대할 인원을 아래에서 추가하세요
                            </p>
                        </div>
                    )}
                    {participants.map(p => (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] last:border-0">
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-[var(--foreground)] text-[var(--text-secondary)]">
                                    {p.username.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <span className="flex-1 text-sm text-[var(--foreground)]">{p.username}</span>
                            <button
                                onClick={() => handleRemoveParticipant(p.id)}
                                className="p-1 text-[var(--foreground)] text-[var(--text-tertiary)] hover:opacity-70 transition-opacity"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add participant */}
                <div className="border-t-2 border-dashed border-indigo-300/40">
                    <div className="flex items-center gap-2 px-4 py-3">
                        <input
                            type="text"
                            value={addInput}
                            onChange={(e) => setAddInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                            placeholder="아이디로 인원 추가"
                            className="flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder-[var(--foreground)] placeholder-text-[var(--text-tertiary)]"
                        />
                        {addInput.trim() && (
                            <button
                                onClick={handleAddParticipant}
                                className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                            >
                                추가
                            </button>
                        )}
                        {!addInput.trim() && (
                            <span className="text-xs text-indigo-400 opacity-60">+ 인원 추가</span>
                        )}
                    </div>
                </div>

                {/* Error + Actions */}
                <div className="px-4 py-4 border-t border-[var(--border-color)] bg-[var(--card-bg)]">
                    {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${roomType === 'ONLINE' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                            <span className="text-xs text-[var(--foreground)] text-[var(--text-secondary)]">
                                {roomType === 'ONLINE' ? '온라인 회의' : '오프라인 회의'}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-[var(--foreground)] text-[var(--text-secondary)] hover:opacity-100 transition-opacity"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading || !title.trim()}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:text-[var(--text-secondary)] text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                {isLoading ? '생성 중...' : '회의 시작'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
