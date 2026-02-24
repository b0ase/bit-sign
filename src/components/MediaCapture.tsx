'use client';

import React, { useRef, useState, useEffect } from 'react';
import { FiCamera, FiVideo, FiX, FiCheck, FiRotateCcw, FiActivity } from 'react-icons/fi';

interface MediaCaptureProps {
    mode: 'PHOTO' | 'VIDEO';
    facingMode?: 'user' | 'environment';
    onCapture: (blob: Blob) => void;
    onCancel: () => void;
}

export default function MediaCapture({ mode, facingMode = 'user', onCapture, onCancel }: MediaCaptureProps) {
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
                video: { facingMode, width: 1280, height: 720 },
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
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            setCapturedBlob(blob);
            setPreviewUrl(URL.createObjectURL(blob));
            // Stop camera AFTER blob is created — stopping earlier kills the stream
            // before MediaRecorder can flush its final data chunk
            stopCamera();
        };
        mediaRecorderRef.current = recorder;
        recorder.start(1000); // collect data every 1s for reliable chunk capture
        setIsRecording(true);
        setRecordingTime(0);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Don't call stopCamera() here — it's called in recorder.onstop
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
                            muted
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
                        <div className="absolute top-6 left-6 flex items-center gap-3 px-4 py-2 bg-red-600 animate-pulse text-white text-sm font-medium rounded-md">
                            <FiActivity /> Recording 0:{recordingTime.toString().padStart(2, '0')}
                        </div>
                    )}
                </div>

                <div className="p-6 flex items-center justify-between border-t border-white/[0.05] bg-zinc-950/50 backdrop-blur-md">
                    <div className="space-y-1">
                        <h3 className="text-sm font-medium text-white">
                            {mode === 'PHOTO' ? 'Take Photo' : 'Record Video'}
                        </h3>
                        <p className="text-xs text-zinc-500 max-w-xs">
                            {mode === 'PHOTO'
                                ? 'Capture a photo for identity verification.'
                                : 'Record a short video (max 10s).'}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {!capturedBlob ? (
                            mode === 'PHOTO' ? (
                                <button
                                    onClick={takePhoto}
                                    className="w-16 h-16 bg-white text-black flex items-center justify-center rounded-full hover:scale-105 transition-transform active:scale-95 shadow-lg"
                                >
                                    <FiCamera size={24} />
                                </button>
                            ) : (
                                !isRecording ? (
                                    <button
                                        onClick={startRecording}
                                        className="w-16 h-16 bg-red-600 text-white flex items-center justify-center rounded-full hover:scale-105 transition-transform active:scale-95 shadow-lg border-4 border-white/20"
                                    >
                                        <FiVideo size={24} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopRecording}
                                        className="w-16 h-16 bg-white text-black flex items-center justify-center rounded-full hover:scale-105 transition-transform active:scale-95 shadow-lg"
                                    >
                                        <div className="w-6 h-6 bg-current rounded-sm" />
                                    </button>
                                )
                            )
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReset}
                                    className="px-5 py-3 border border-zinc-700 text-white text-sm font-medium rounded-md hover:bg-zinc-800 transition-all flex items-center gap-2"
                                >
                                    <FiRotateCcw size={14} /> Retake
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="px-5 py-3 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition-all flex items-center gap-2"
                                >
                                    <FiCheck size={14} /> Save
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
