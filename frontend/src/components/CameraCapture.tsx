import React, { useRef, useState, useCallback } from 'react';

interface CameraCaptureProps {
    onCapture: (base64Image: string) => void;
    onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);

    const mountedRef = useRef(true);

    React.useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const startCamera = useCallback(async () => {
        setIsInitializing(true);
        setError(null);
        try {
            let mediaStream;
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
            } catch (e) {
                // Fallback to any camera if environment fails
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: true
                });
            }
            if (!mountedRef.current) {
                mediaStream.getTracks().forEach(t => t.stop());
                return;
            }
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.play().catch(e => console.warn("Video play interrupted:", e));
            }
        } catch (err: any) {
            if (!mountedRef.current) return;
            console.error('Camera error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Camera access denied. Please grant permission in your browser settings.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera found on this device.');
            } else if (err.name === 'NotSupportedError') {
                setError('HTTPS is required to access the camera.');
            } else {
                setError(`Could not access camera: ${err.message || err.name}`);
            }
        } finally {
            if (mountedRef.current) setIsInitializing(false);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    // Start camera on mount, stop on unmount
    React.useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [startCamera, stopCamera]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                onCapture(dataUrl);
                stopCamera();
            }
        }
    };

    const handleCancel = () => {
        stopCamera();
        onCancel();
    };

    return (
        <div className="camera-capture-container" style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--bg-primary)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }}>
            <div className="page-header" style={{ width: '100%', textAlign: 'center', marginBottom: '16px' }}>
                <h2 className="page-title">Scan Ingredient</h2>
            </div>

            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '500px',
                aspectRatio: '3/4',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--border)'
            }}>
                {isInitializing && !error && (
                    <div className="loading-center" style={{ position: 'absolute', inset: 0 }}>
                        <div className="spinner"></div>
                        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Accessing camera...</p>
                    </div>
                )}

                {error ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                        <div className="empty-icon">📷</div>
                        <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>
                        <button className="btn btn-secondary" onClick={startCamera}>Retry</button>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        playsInline
                        autoPlay
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                )}
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div style={{
                marginTop: '24px',
                display: 'flex',
                gap: '16px',
                width: '100%',
                maxWidth: '500px'
            }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCancel}>
                    Cancel
                </button>
                <button
                    className="btn btn-primary"
                    style={{ flex: 2 }}
                    onClick={handleCapture}
                    disabled={!!error || isInitializing}
                >
                    Capture
                </button>
            </div>
        </div>
    );
}
