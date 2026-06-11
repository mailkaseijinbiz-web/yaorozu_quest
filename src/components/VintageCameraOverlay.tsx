'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';

interface VintageCameraOverlayProps {
  vintageImageUrl?: string;
  onCapture: (base64Data: string) => void;
  onCancel: () => void;
}

export default function VintageCameraOverlay({ vintageImageUrl, onCapture, onCancel }: VintageCameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // デフォルトの古い写真（神社仏閣の汎用的な古い風景等）
  const overlayUrl = vintageImageUrl || 'https://images.unsplash.com/photo-1579781403061-0428dc64cd60?auto=format&fit=crop&q=80&w=800&grayscale=true';

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        activeStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('カメラの起動に失敗しました。権限を確認してください。');
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !stream) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 映像を描画
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // ハプティック振動
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      onCapture(dataUrl);
    } else {
      setIsCapturing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-black flex flex-col items-center justify-center animate-in fade-in">
      <button onClick={onCancel} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center active:scale-95 transition-all z-20">
        <X className="w-5 h-5" />
      </button>

      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {errorMsg ? (
          <div className="text-white text-center p-6">
            <p className="text-rose-400 mb-4">{errorMsg}</p>
            <p className="text-sm text-gray-400">標準のファイル選択を使用してください。</p>
          </div>
        ) : (
          <>
            {/* カメラ映像 */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* 過去の景色オーバーレイ */}
            {/* mix-blend-mode で良い感じに合成する */}
            <div 
              className="absolute inset-0 w-full h-full bg-center bg-cover bg-no-repeat opacity-40 mix-blend-overlay pointer-events-none"
              style={{ backgroundImage: `url(${overlayUrl})` }}
            />
            
            {/* ガイドライン等 */}
            <div className="absolute inset-0 w-full h-full border-[1px] border-white/20 m-8 pointer-events-none flex items-center justify-center">
              <div className="text-white/60 text-xs tracking-widest font-serif drop-shadow-md bg-black/30 px-3 py-1 rounded">
                過去の景色と重ね合わせる
              </div>
            </div>

            {/* 撮影用隠しキャンバス */}
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>

      {!errorMsg && (
        <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center z-20">
          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 backdrop-blur-sm active:scale-90 transition-transform"
          >
            {isCapturing ? (
              <RefreshCw className="w-8 h-8 text-white animate-spin" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
