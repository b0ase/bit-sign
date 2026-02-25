'use client';

import React, { useRef, useState, useEffect } from 'react';
import { FiCamera, FiVideo, FiX, FiCheck, FiRotateCcw, FiActivity, FiRefreshCw } from 'react-icons/fi';

interface MediaCaptureProps {
    mode: 'PHOTO' | 'VIDEO';
    facingMode?: 'user' | 'environment';
    onCapture: (blob: Blob) => void;
    onCancel: () => void;
}

export default function MediaCapture({ mode, facingMode = 'user', onCapture, onCancel }: MediaCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [currentFacing, setCurrentFacing] = useState<'user' | 'environment'>(facingMode);
    const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
    const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
    const [isMobile, setIsMobile] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        // Detect mobile
        const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        setIsMobile(mobile);

        startCamera(currentFacing);
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            setHasMultipleCameras(videoInputs.length > 1);
        });
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

    const startCamera = async (facing: 'user' | 'environment') => {
        try {
            // On mobile, request portrait-friendly resolution
            const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const constraints: MediaStreamConstraints = {
                video: mobile
                    ? { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } }
                    : { facingMode: facing, width: 1280, height: 720 },
                audio: mode === 'VIDEO'
            };
            const s = await navigator.mediaDevices.getUserMedia(constraints);
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

    const flipCamera = () => {
        if (isRecording) return;
        stream?.getTracks().forEach(track => track.stop());
        const newFacing = currentFacing === 'user' ? 'environment' : 'user';
        setCurrentFacing(newFacing);
        startCamera(newFacing);
    };

    const rotateImage = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    const applyRotation = (sourceCanvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement => {
        if (degrees === 0) return sourceCanvas;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        if (degrees === 90 || degrees === 270) {
            canvas.width = sourceCanvas.height;
            canvas.height = sourceCanvas.width;
        } else {
            canvas.width = sourceCanvas.width;
            canvas.height = sourceCanvas.height;
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((degrees * Math.PI) / 180);
        ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
        return canvas;
    };

    const takePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Mirror selfie camera
            if (currentFacing === 'user') {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(videoRef.current, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    setCapturedBlob(blob);
                    setPreviewUrl(URL.createObjectURL(blob));
                    setRotation(0);
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
            stopCamera();
        };
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        setIsRecording(true);
        setRecordingTime(0);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleConfirm = () => {
        if (!capturedBlob) return;

        // If image is rotated, apply rotation before saving
        if (rotation !== 0 && mode === 'PHOTO' && previewUrl) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                const rotated = applyRotation(canvas, rotation);
                rotated.toBlob((blob) => {
                    if (blob) onCapture(blob);
                }, 'image/jpeg', 0.9);
            };
            img.src = previewUrl;
        } else {
            onCapture(capturedBlob);
        }
    };

    const handleReset = () => {
        setCapturedBlob(null);
        setPreviewUrl(null);
        setRotation(0);
        startCamera(currentFacing);
    };

    // Determine aspect ratio classes
    const isPortrait = isMobile && !capturedBlob;
    const aspectClass = isPortrait ? 'aspect-[9/16] max-h-[70vh]' : 'aspect-video';

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-4xl bg-zinc-900/50 border border-white/[0.05] rounded-sm overflow-hidden flex flex-col relative group">
                {/* Top controls */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                    <button
                        onClick={onCancel}
                        className="p-3 bg-black/50 text-white hover:bg-white hover:text-black transition-all rounded-full"
                    >
                        <FiX size={20} />
                    </button>
                </div>

                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    {hasMultipleCameras && !capturedBlob && (
                        <button
                            onClick={flipCamera}
                            className="p-3 bg-black/50 text-white hover:bg-white hover:text-black transition-all rounded-full"
                            title={currentFacing === 'user' ? 'Switch to rear camera' : 'Switch to selfie camera'}
                        >
                            <FiRefreshCw size={20} />
                        </button>
                    )}
                    {capturedBlob && mode === 'PHOTO' && (
                        <button
                            onClick={rotateImage}
                            className="p-3 bg-black/50 text-white hover:bg-white hover:text-black transition-all rounded-full"
                            title="Rotate 90°"
                        >
                            <FiRotateCcw size={20} />
                        </button>
                    )}
                </div>

                {/* Camera / Preview */}
                <div className={`relative ${capturedBlob ? 'aspect-auto' : aspectClass} bg-black flex items-center justify-center border-b border-white/[0.05] overflow-hidden`}>
                    {!capturedBlob ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${currentFacing === 'user' ? 'scale-x-[-1]' : ''}`}
                        />
                    ) : (
                        mode === 'PHOTO' ? (
                            <img
                                src={previewUrl!}
                                className="max-w-full max-h-[70vh] object-contain transition-transform duration-200"
                                style={{ transform: `rotate(${rotation}deg)` }}
                            />
                        ) : (
                            <video src={previewUrl!} controls className="w-full h-full object-cover" />
                        )
                    )}

                    {isRecording && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-red-600 animate-pulse text-white text-sm font-medium rounded-md">
                            <FiActivity /> Recording 0:{recordingTime.toString().padStart(2, '0')}
                        </div>
                    )}

                    {/* Camera mode indicator */}
                    {!capturedBlob && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full text-[10px] text-zinc-400 uppercase tracking-wider">
                            {currentFacing === 'user' ? 'Selfie' : 'Rear'} Camera
                        </div>
                    )}
                </div>

                {/* Bottom controls */}
                <div className="p-4 sm:p-6 flex items-center justify-between border-t border-white/[0.05] bg-zinc-950/50 backdrop-blur-md">
                    <div className="space-y-1">
                        <h3 className="text-sm font-medium text-white">
                            {mode === 'PHOTO' ? 'Take Photo' : 'Record Video'}
                        </h3>
                        <p className="text-xs text-zinc-500 max-w-xs">
                            {capturedBlob && mode === 'PHOTO' && rotation !== 0
                                ? `Rotated ${rotation}°`
                                : mode === 'PHOTO'
                                    ? 'Capture a photo for identity verification.'
                                    : 'Record a short video (max 10s).'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
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
