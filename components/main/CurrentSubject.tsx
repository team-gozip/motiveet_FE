'use client';

import { useState, useEffect } from 'react';
import { subjectApi } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Subject {
    subjectId: number;
    chatId: number;
    text: string;
}

interface FileData {
    fileId: number;
    fileName: string;
    fileUrl: string;
    fileType: string;
}

interface CurrentSubjectProps {
    subject: Subject | null;
    meetingId: number | null;
    isActive: boolean;
    suggestions?: string[];
    summary?: string;
    files: FileData[];
    onSubjectChange?: (newSubject: any) => void;
    onResearch?: (topic: string) => void;
}

export default function CurrentSubject({ subject, meetingId, isActive, suggestions = [], summary, files, onSubjectChange, onResearch }: CurrentSubjectProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const [showSummary, setShowSummary] = useState(false);
    const [newSubjectText, setNewSubjectText] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (subject) {
            setEditText(subject.text);
        }
    }, [subject]);

    const handleEditToggle = () => {
        if (isEditing && subject) {
            handleSave();
        } else {
            setIsEditing(true);
        }
    };

    const handleSave = async () => {
        if (!subject || !editText.trim()) return;

        try {
            const sid = subject.subjectId || (subject as any).id;
            const response = await subjectApi.update(sid, editText);
            if (onSubjectChange) {
                onSubjectChange({ ...subject, text: response.text });
            }
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update subject:', error);
            alert('주제 수정에 실패했습니다.');
        }
    };

    const handleCreateSubject = async () => {
        if (!meetingId || !newSubjectText.trim() || isCreating) return;

        setIsCreating(true);
        try {
            const response = await subjectApi.create(meetingId, newSubjectText);
            if (onSubjectChange) {
                onSubjectChange({
                    subjectId: response.subjectId,
                    chatId: response.chatId,
                    text: response.text,
                });
                setNewSubjectText('');
            }
        } catch (error) {
            console.error('Failed to create subject:', error);
            alert('주제 생성에 실패했습니다.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSelectSuggestion = async (text: string) => {
        if (!subject) return;

        try {
            const sid = subject.subjectId || (subject as any).id;
            const response = await subjectApi.update(sid, text);
            if (onSubjectChange) {
                onSubjectChange({ ...subject, text: response.text });
            }
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to select suggestion:', error);
        }
    };

    if (!subject) {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="bg-[var(--card-bg)] rounded-xl shadow-md p-8 border border-[var(--border-color)] transition-all duration-300">
                    {isActive ? (
                        <div className="max-w-md mx-auto text-center space-y-4">
                            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-600 dark:text-indigo-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-[var(--foreground)]">새로운 주제 시작하기</h3>
                            <p className="text-sm text-[var(--foreground)] opacity-50 mb-4">현재 논의 중인 소주제가 없습니다. 활발한 회의를 위해 주제를 먼저 설정해 주세요.</p>
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={newSubjectText}
                                    onChange={(e) => setNewSubjectText(e.target.value)}
                                    placeholder="주제 이름을 입력하세요 (예: 브랜딩 전략)"
                                    className="flex-1 px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    onKeyPress={(e) => e.key === 'Enter' && handleCreateSubject()}
                                />
                                <button
                                    onClick={handleCreateSubject}
                                    disabled={!newSubjectText.trim() || isCreating}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {isCreating ? '생성 중...' : '생성'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-[var(--foreground)] opacity-40 font-medium">이 회의에는 생성된 주제가 없습니다.</p>
                        </div>
                    )}
                </div>

                {/* AI Extracted Topics - also shown when subject is null */}
                {suggestions.length > 0 && (
                    <div className="bg-[#0f172a]/30 dark:bg-black/20 rounded-2xl border border-[var(--border-color)] p-6 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between mb-4 ml-1">
                            <h3 className="text-[10px] font-bold text-[var(--foreground)] opacity-30 uppercase tracking-[0.2em] flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2 animate-pulse"></span>
                                AI 추출 주제 분석
                            </h3>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {suggestions.map((sug, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onResearch?.(sug)}
                                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold text-[var(--foreground)] rounded-full border border-[var(--border-color)] transition-all flex items-center group active:scale-95 shadow-sm hover:shadow-indigo-500/10"
                                >
                                    <svg className="w-3.5 h-3.5 mr-2 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    {sug}
                                    <svg className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Subject Card - Professional Indigo & Slate Gradient */}
            <div className="bg-gradient-to-br from-[#4f46e5] to-[#6366f1] dark:from-[#7482FF] dark:to-[#2F377F] rounded-2xl shadow-xl p-8 transition-all duration-300 border border-white/10 group relative overflow-hidden">
                <div className="relative z-10 font-bold">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                            <h2 className="text-xs text-white/70 uppercase tracking-widest">Live Topic</h2>
                        </div>
                        <button
                            onClick={handleEditToggle}
                            className="text-white/60 hover:text-white text-xs flex items-center bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-all"
                        >
                            {isEditing ? (
                                <>
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    저장
                                </>
                            ) : (
                                <>
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                    수정
                                </>
                            )}
                        </button>
                    </div>

                    {isEditing ? (
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-black/20 border border-white/20 rounded-xl p-4 text-white text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-white/30 resize-none transition-all"
                            rows={2}
                            autoFocus
                        />
                    ) : (
                        <p className="text-2xl text-white leading-tight drop-shadow-md mb-2">{subject.text}</p>
                    )}

                    {summary && (
                        <button
                            onClick={() => setShowSummary(true)}
                            className="w-full mt-2 py-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl flex items-center justify-center text-white font-bold transition-all shadow-lg hover:shadow-xl group backdrop-blur-sm"
                        >
                            <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 group-hover:bg-indigo-700 transition-colors shadow-sm">AI 분석 완료</span>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            회의 최종 요약 리포트 확인하기
                        </button>
                    )}
                </div>
            </div>

            {/* AI Extracted Topics - Separate section below the card as requested */}
            {suggestions.length > 0 && (
                <div className="bg-[#0f172a]/30 dark:bg-black/20 rounded-2xl border border-[var(--border-color)] p-6 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center justify-between mb-4 ml-1">
                        <h3 className="text-[10px] font-bold text-[var(--foreground)] opacity-30 uppercase tracking-[0.2em] flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2"></span>
                            AI 추출 주제 분석
                        </h3>
                        {isCreating && <span className="text-[10px] text-indigo-500 animate-pulse font-bold">주제 분석 중...</span>}
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {suggestions.map((sug, idx) => (
                            <button
                                key={idx}
                                onClick={() => onResearch?.(sug)}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold text-[var(--foreground)] rounded-full border border-[var(--border-color)] transition-all flex items-center group active:scale-95 shadow-sm hover:shadow-indigo-500/10"
                            >
                                <svg className="w-3.5 h-3.5 mr-2 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {sug}
                                <svg className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        ))}
                    </div>
                </div>
            )}


            {/* Related Files */}
            {files.length > 0 && (
                <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm p-6 border border-[var(--border-color)] transition-all duration-300">
                    <h3 className="text-xs font-bold text-[var(--foreground)] opacity-40 uppercase tracking-widest mb-4 flex items-center ml-1">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        회의 관련 첨부 자료
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {files.map((file) => (
                            <a
                                key={file.fileId}
                                href={file.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center p-4 bg-[var(--background)] hover:bg-[#EEF3F5] dark:hover:bg-[#1e293b] rounded-xl transition-all border border-[var(--border-color)] hover:border-[#cbd5e1] group"
                            >
                                <div className="flex-shrink-0 w-11 h-11 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="ml-4 flex-1 overflow-hidden">
                                    <p className="text-sm font-bold text-[var(--foreground)] opacity-90 truncate">{file.fileName}</p>
                                    <p className="text-[10px] text-[var(--foreground)] opacity-40 uppercase tracking-tighter mt-0.5">{file.fileType}</p>
                                </div>
                                <svg className="w-4 h-4 text-[var(--foreground)] opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Markdown Summary Modal */}
            {showSummary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[var(--background)] w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl border border-[var(--border-color)] flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--card-bg)] rounded-t-2xl">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-bold text-[var(--foreground)]">AI 회의 최종 요약</h2>
                            </div>
                            <button
                                onClick={() => setShowSummary(false)}
                                className="p-2 hover:bg-[var(--border-color)] rounded-full transition-colors text-[var(--foreground)] opacity-60 hover:opacity-100"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="prose dark:prose-invert prose-slate max-w-none text-[var(--foreground)] markdown-preview">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {summary || '*요약 내용이 없습니다.*'}
                                </ReactMarkdown>
                            </div>
                        </div>
                        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--card-bg)] rounded-b-2xl flex justify-end">
                            <button
                                onClick={() => setShowSummary(false)}
                                className="px-5 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
