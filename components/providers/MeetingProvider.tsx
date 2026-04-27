'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { meetingApi } from '@/lib/api';

const CROSS_TAB_CHANNEL = 'motiveet:meeting';

interface MeetingContextType {
  activeMeetingId: number | null;
  activeChatId: number | null;
  isRecording: boolean;
  volume: number;
  startGlobalMeeting: (meetingId: number, chatId: number) => Promise<void>;
  endGlobalMeeting: () => void;
  checkActiveMeeting: () => void;
  lastAnalysisResult: any;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const [activeMeetingId, setActiveMeetingId] = useState<number | null>(null);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const activeMeetingIdRef = useRef<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const [lastAnalysisResult, setLastAnalysisResult] = useState<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // BE의 active meeting과 클라이언트 상태가 어긋났는지 확인.
  // 다른 탭/디바이스에서 종료되거나 BE sweep으로 정리된 경우 로컬 녹음을 정지한다.
  const checkActiveMeeting = async () => {
    const localId = activeMeetingIdRef.current;
    if (!localId) return;
    try {
      const current = await meetingApi.getCurrent().catch(() => null);
      const stillActive = current && current.meetingId === localId && !current.endedAt;
      if (!stillActive) {
        console.log('[MeetingProvider] BE no longer has this meeting active — cleaning up local state');
        stopRecordingCleanup();
        setActiveMeetingId(null);
        setActiveChatId(null);
      }
    } catch { /* ignore — 네트워크 일시 단절은 무시 */ }
  };

  const stopRecordingCleanup = () => {
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    }

    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }

    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    }

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});

    mediaRecorderRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    animationFrameRef.current = null;
    setVolume(0);
    setIsRecording(false);
  };

  useEffect(() => {
    activeMeetingIdRef.current = activeMeetingId;
  }, [activeMeetingId]);

  useEffect(() => {
    // 다른 탭에서 회의가 종료되면 BroadcastChannel로 동기화 — 같은 meetingId면 로컬 녹음도 정지.
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CROSS_TAB_CHANNEL);
      ch.onmessage = (e) => {
        const data = e.data;
        if (data?.type === 'end' && activeMeetingIdRef.current === data.meetingId) {
          console.log('[MeetingProvider] received cross-tab end signal — cleaning up');
          stopRecordingCleanup();
          setActiveMeetingId(null);
          setActiveChatId(null);
        }
      };
      channelRef.current = ch;
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkActiveMeeting();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // checkActiveMeeting is async — setState calls inside happen after await, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkActiveMeeting();
    return () => {
      stopRecordingCleanup();
      try { channelRef.current?.close(); } catch { /* ignore */ }
      channelRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async (meetingId: number) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('마이크 접근이 불가능합니다.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio Context for Volume
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        setVolume(sum / bufferLength);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // Media Recorder
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && activeMeetingIdRef.current) {
          const currentMeetingId = activeMeetingIdRef.current;
          const audioBlob = new Blob([e.data], { type: 'audio/webm' });
          meetingApi.uploadAudio(currentMeetingId, audioBlob)
            .then(res => {
              console.log('[GlobalAudio] Upload success', res);
              setLastAnalysisResult(res);
            })
            .catch(err => console.error('[GlobalAudio] Upload failed', err));
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      // Whisper chunking (30s)
      intervalRef.current = setInterval(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setTimeout(() => {
            if (recorder.state === 'inactive' && activeMeetingIdRef.current) {
                try { recorder.start(); } catch(e) {}
            }
          }, 200);
        }
      }, 30000);

    } catch (err) {
      console.error("Failed to start global recording:", err);
      alert("마이크 사용을 시작할 수 없습니다.");
    }
  };

  const startGlobalMeeting = async (meetingId: number, chatId: number) => {
    // If already recording another meeting, confirm
    if (isRecording && activeMeetingId !== meetingId) {
      const confirmData = confirm("다른 회의가 진행 중입니다. 종료하고 새 회의를 시작하시겠습니까?");
      if (!confirmData) return;
      endGlobalMeeting();
    }

    setActiveMeetingId(meetingId);
    setActiveChatId(chatId);
    await startRecording(meetingId);
  };

  const endGlobalMeeting = () => {
    const id = activeMeetingIdRef.current;
    stopRecordingCleanup();
    setActiveMeetingId(null);
    setActiveChatId(null);
    // 다른 탭에 회의 종료 알림 → 그 탭들도 녹음 정지.
    if (id != null) {
      try { channelRef.current?.postMessage({ type: 'end', meetingId: id }); } catch { /* ignore */ }
    }
  };

  return (
    <MeetingContext.Provider value={{
      activeMeetingId,
      activeChatId,
      isRecording,
      volume,
      startGlobalMeeting,
      endGlobalMeeting,
      checkActiveMeeting,
      lastAnalysisResult
    }}>
      {children}
    </MeetingContext.Provider>
  );
}

export const useMeeting = () => {
  const context = useContext(MeetingContext);
  if (context === undefined) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }
  return context;
};
