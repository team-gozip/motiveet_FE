'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { meetingApi } from '@/lib/api';

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initial check for any active meeting on mount (optional, if we want to restore state)
  // For now, we rely on user action or passed props, but checking API is safer.
  const checkActiveMeeting = async () => {
    try {
      const current = await meetingApi.getCurrent();
      if (current && !current.endedAt) {
        // If there's a meeting running on server but we don't have local recorder,
        // we unfortunately can't "resume" recording seamlessly without browser permission again.
        // However, we can at least set the state to "active" UI-wise.
        // Re-acquiring microphone might need user gesture, so we might skip auto-start recording here
        // unless we prompt user.
        // For this Hackathon/MVP: we assume "start" happens in this session. 
        // If page refresh happens, we might lose the *recorder* instance.
        // TODO: Handle page refresh persistence better if needed.
        setActiveMeetingId(current.meetingId);
        setActiveChatId(current.chatId);
      }
    } catch (e) {
      console.error("Failed to check active meeting:", e);
    }
  };

  useEffect(() => {
    activeMeetingIdRef.current = activeMeetingId;
  }, [activeMeetingId]);

  useEffect(() => {
    checkActiveMeeting();
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const startRecording = async (meetingId: number) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('마이크 접근이 불가능합니다.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
            if (recorder.state === 'inactive') recorder.start();
          }, 200);
        }
      }, 30000);

    } catch (err) {
      console.error("Failed to start global recording:", err);
      alert("마이크 사용을 시작할 수 없습니다.");
    }
  };

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (intervalRef.current) clearInterval(intervalRef.current);

    mediaRecorderRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    animationFrameRef.current = null;
    intervalRef.current = null;
    setVolume(0);
    setIsRecording(false);
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
    stopRecordingCleanup();
    setActiveMeetingId(null);
    setActiveChatId(null);
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
