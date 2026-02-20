import { useState, useEffect } from 'react';
import Button from '../common/Button';
import { meetingApi } from '@/lib/api';
import { useMeeting } from '@/components/providers/MeetingProvider';

interface MeetingControlsProps {
    isActive: boolean;
    meetingId: number | null;
    onMeetingStart: (meetingId: number, chatId: number) => void;
    onMeetingEnd: (summary?: string) => void;
    onSubjectUpdate?: (subject: any) => void;
    memo?: string;
}

export default function MeetingControls({
    isActive,
    meetingId,
    onMeetingStart,
    onMeetingEnd,
    onSubjectUpdate,
    memo,
}: MeetingControlsProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { startGlobalMeeting, endGlobalMeeting, volume, activeMeetingId, isRecording } = useMeeting();

    // Check if THIS specific meeting controls instance corresponds to the active recording session
    const isThisMeetingRecording = isRecording && activeMeetingId === meetingId;

    const handleStart = async () => {
        const title = prompt('회의 제목을 입력해주세요:', '새로운 회의');
        if (!title) return;

        setIsLoading(true);
        try {
            const response = await meetingApi.start(title);
            if (response.success) {
                onMeetingStart(response.meetingId, response.chatId);
                await startGlobalMeeting(response.meetingId, response.chatId);
            }
        } catch (error) {
            console.error('Failed to start meeting:', error);
            alert('회의 시작에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEnd = async () => {
        if (!meetingId) return;

        const confirmed = confirm('회의를 종료하시겠습니까?');
        if (!confirmed) return;

        setIsLoading(true);
        try {
            const response = await meetingApi.end(meetingId, memo);
            if (response.success) {
                endGlobalMeeting();
                onMeetingEnd(response.summary);
            }
        } catch (error) {
            console.error('Failed to end meeting:', error);
            alert('회의 종료에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // Cleanup handled by Provider
    useEffect(() => {
        // No local cleanup needed anymore
        return () => { };
    }, []);

    // Volume Meter Component (SVG Waves)
    const VolumeMeter = () => {
        const isHigh = volume > 80;
        const color = isHigh ? '#ef4444' : '#6366f1'; // Red-500 or Indigo-500

        return (
            <div className="flex items-center space-x-1 ml-2 mr-1">
                <div className="flex items-end space-x-0.5 h-4">
                    {[0.6, 1.0, 1.5, 1.0, 0.6].map((multiplier, i) => {
                        const baseHeight = 4;
                        const dynamicHeight = Math.max(baseHeight, (volume * multiplier) / 4);
                        return (
                            <div
                                key={i}
                                className="w-1 rounded-full transition-all duration-100 ease-out"
                                style={{
                                    height: `${isThisMeetingRecording ? dynamicHeight : baseHeight}px`,
                                    backgroundColor: isThisMeetingRecording && volume > 5 ? color : '#94a3b8',
                                    opacity: isThisMeetingRecording ? (volume > 5 ? 1 : 0.4) : 0.2,
                                    boxShadow: isThisMeetingRecording && volume > 20 ? `0 0 8px ${color}66` : 'none'
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] px-6 py-3 rounded-full shadow-2xl transition-all duration-300 hover:shadow-[var(--accent-primary)]/10 active:scale-[0.99]">
            <div className="flex items-center justify-between space-x-8">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <div className={`w-3.5 h-3.5 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-gray-400 opacity-50'}`}></div>
                            {isActive && isThisMeetingRecording && <div className="absolute inset-0 w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping opacity-40"></div>}
                        </div>
                        <span className="text-xs font-bold text-[var(--foreground)] opacity-60 tracking-wider whitespace-nowrap">
                            {isActive ? 'RECORDING LIVE' : 'READY TO START'}
                        </span>
                    </div>

                    {/* Real-time Audio Visualizer */}
                    <div className="flex items-center h-4 border-l border-[var(--border-color)] pl-4">
                        <VolumeMeter />
                    </div>
                </div>

                <div className="flex items-center">
                    {!isActive ? (
                        <button
                            onClick={handleStart}
                            disabled={isLoading}
                            className="px-10 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:bg-gray-500 disabled:scale-100 uppercase tracking-widest"
                        >
                            {isLoading ? 'Wait...' : 'Start Meeting'}
                        </button>
                    ) : (
                        <button
                            onClick={handleEnd}
                            disabled={isLoading}
                            className="px-10 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-sm font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:bg-gray-500 uppercase tracking-widest"
                        >
                            {isLoading ? 'Wait...' : 'End Meeting'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
