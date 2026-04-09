'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { notificationApi } from '@/lib/api';

interface Notification {
    id: number;
    type: string;
    title: string;
    body: string | null;
    roomId: number | null;
    isRead: boolean;
    createdAt: string;
}

// ── Toast (상단 슬라이드) ────────────────────────────
function Toast({ notif, onClose }: { notif: Notification; onClose: () => void }) {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const handleClick = () => {
        if (notif.roomId) {
            notificationApi.markRead(notif.id).catch(() => {});
            router.push(`/room/${notif.roomId}`);
        }
        onClose();
    };

    return (
        <div
            className="animate-slide-down cursor-pointer flex items-start gap-3 bg-[var(--card-bg)] border border-[var(--border-color)] shadow-xl rounded-xl px-4 py-3 max-w-sm w-full"
            onClick={handleClick}
        >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--foreground)]">{notif.title}</p>
                {notif.body && <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{notif.body}</p>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--foreground)] transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}

// ── NotificationBell (알림 벨 + 드롭다운) ────────────
export default function NotificationBell() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [toasts, setToasts] = useState<Notification[]>([]);
    const prevIdsRef = useRef<Set<number>>(new Set());
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const [listResp, countResp] = await Promise.all([
                notificationApi.list(),
                notificationApi.unreadCount(),
            ]);
            setNotifications(listResp.items);
            setUnreadCount(countResp.count);

            // 새 알림이면 토스트
            const currentIds = new Set(listResp.items.map(n => n.id));
            const newNotifs = listResp.items.filter(n => !n.isRead && !prevIdsRef.current.has(n.id));
            if (prevIdsRef.current.size > 0 && newNotifs.length > 0) {
                setToasts(prev => [...prev, ...newNotifs]);
            }
            prevIdsRef.current = currentIds;
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // 외부 클릭으로 닫기
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleNotifClick = async (notif: Notification) => {
        await notificationApi.markRead(notif.id).catch(() => {});
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        setIsOpen(false);
        if (notif.roomId) router.push(`/room/${notif.roomId}`);
    };

    const handleMarkAllRead = async () => {
        await notificationApi.markAllRead().catch(() => {});
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
    };

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return '방금';
        if (mins < 60) return `${mins}분 전`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}시간 전`;
        return `${Math.floor(hours / 24)}일 전`;
    };

    return (
        <>
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
                {toasts.map(t => (
                    <Toast key={t.id} notif={t} onClose={() => removeToast(t.id)} />
                ))}
            </div>

            {/* Bell + Dropdown */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative p-2 rounded-md hover:bg-[var(--highlight-bg)] transition-colors text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                >
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-50">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                            <span className="text-sm font-semibold text-[var(--foreground)]">알림</span>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-[10px] font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
                                >
                                    모두 읽음
                                </button>
                            )}
                        </div>
                        <div className="max-h-[320px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="flex items-center justify-center py-10">
                                    <span className="text-xs text-[var(--text-tertiary)]">알림이 없습니다</span>
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <button
                                        key={notif.id}
                                        onClick={() => handleNotifClick(notif)}
                                        className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--highlight-bg)] transition-colors border-b border-[var(--border-color)] last:border-0 ${
                                            !notif.isRead ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                                        }`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                            !notif.isRead
                                                ? 'bg-indigo-100 dark:bg-indigo-900/30'
                                                : 'bg-[var(--highlight-bg)]'
                                        }`}>
                                            <svg className={`w-3.5 h-3.5 ${!notif.isRead ? 'text-indigo-500' : 'text-[var(--text-tertiary)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-medium ${!notif.isRead ? 'text-[var(--foreground)]' : 'text-[var(--text-secondary)]'}`}>
                                                {notif.title}
                                            </p>
                                            {notif.body && (
                                                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">{notif.body}</p>
                                            )}
                                            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{timeAgo(notif.createdAt)}</p>
                                        </div>
                                        {!notif.isRead && (
                                            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
