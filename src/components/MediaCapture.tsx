'use client';

import React, { useRef, useState, useEffect } from 'react';
import { FiCamera, FiVideo, FiX, FiCheck, FiRotateCcw, FiActivity } from 'react-icons/fi';

interface MediaCaptureProps {
    mode: 'PHOTO' | 'VIDEO';
    onCapture: (blob: Blob) => void;
    onCancel: () => void;
}

export default function MediaCapture({ mode, onCapture, onCancel }: MediaCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isRecording) {
            timer = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 10) {
                        stopRecording();
                        return 10;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isRecording]);

    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 1280, height: 720 },
                audio: mode === 'VIDEO'
            });
            setStream(s);
            if (videoRef.current) videoRef.current.srcObject = s;
        } catch (err) {
            console.error('Camera access denied:', err);
            alert('Camera access is required for this attestation.');
            onCancel();
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const takePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    setCapturedBlob(blob);
                    setPreviewUrl(URL.createObjectURL(blob));
                    stopCamera();
                }
            }, 'image/jpeg', 0.9);
        }
    };

    const startRecording = () => {
        if (!stream) return;
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            setCapturedBlob(blob);
            setPreviewUrl(URL.createObjectURL(blob));
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
        setRecordingTime(0);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            stopCamera();
        }
    };

    const handleConfirm = () => {
        if (capturedBlob) onCapture(capturedBlob);
    };

    const handleReset = () => {
        setCapturedBlob(null);
        setPreviewUrl(null);
        startCamera();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="w-full max-w-4xl bg-zinc-900/50 border border-white/[0.05] rounded-sm overflow-hidden flex flex-col relative group">
                <button
                    onClick={onCancel}
                    className="absolute top-6 right-6 z-20 p-3 bg-black/50 text-white hover:bg-white hover:text-black transition-all rounded-full"
                >
                    <FiX size={20} />
                </button>

                <div className="relative aspect-video bg-black flex items-center justify-center border-b border-white/[0.05]">
                    {!capturedBlob ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted={!isRecording}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        mode === 'PHOTO' ? (
                            <img src={previewUrl!} className="w-full h-full object-cover" />
                        ) : (
                            <video src={previewUrl!} controls className="w-full h-full object-cover" />
                        )
                    )}

                    {isRecording && (
                        <div className="absolute top-6 left-6 flex items-center gap-3 px-4 py-2 bg-red-600 animate-pulse text-white font-mono text-[10px] font-black uppercase tracking-widest rounded-sm">
                            <FiActivity /> Recording // 00:{recordingTime.toString().padStart(2, '0')}
                        </div>
                    )}
                </div>

                <div className="p-10 flex items-center justify-between border-t border-white/[0.05] bg-zinc-950/50 backdrop-blur-md">
                    <div className="space-y-1">
                        <h3 className="font-mono font-black text-xs uppercase tracking-tight text-white">
                            {mode === 'PHOTO' ? 'Visual Evidence' : 'Video Attestation'}
                        </h3>
                        <p className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest leading-relaxed max-w-xs">
                            {mode === 'PHOTO'
                                ? 'Capture physical proof of identity or signed paper records.'
                                : 'Record a statement of intent to be inscribed on-chain.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-6">
                        {!capturedBlob ? (
                            mode === 'PHOTO' ? (
                                <button
                                    onClick={takePhoto}
                                    className="w-20 h-20 bg-white text-black flex items-center justify-center rounded-full hover:scale-110 transition-transform active:scale-95 shadow-2xl"
                                >
                                    <FiCamera size={32} />
                                </button>
                            ) : (
                                !isRecording ? (
                                    <button
                                        onClick={startRecording}
                                        className="w-20 h-20 bg-red-600 text-white flex items-center justify-center rounded-full hover:scale-110 transition-transform active:scale-95 shadow-2xl border-4 border-white/20"
                                    >
                                        <FiVideo size={32} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopRecording}
                                        className="w-20 h-20 bg-white text-black flex items-center justify-center rounded-full hover:scale-110 transition-transform active:scale-95 shadow-xl"
                                    >
                                        <div className="w-8 h-8 bg-current rounded-sm" />
                                    </button>
                                )
                            )
                        ) : (
                            <div className="flex gap-4">
                                <button
                                    onClick={handleReset}
                                    className="px-10 py-5 border border-white/10 text-white font-mono font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all flex items-center gap-3"
                                >
                                    <FiRotateCcw /> Retake
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="px-10 py-5 bg-white text-black font-mono font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all flex items-center gap-3"
                                >
                                    <FiCheck /> Inscribe Proof
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
