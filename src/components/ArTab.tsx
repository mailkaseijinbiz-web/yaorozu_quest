'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, Download, Share2, Sparkles, AlertTriangle, Check, Info } from 'lucide-react';
import { Spot, Agent, User } from '../lib/db';
import { shareToSns } from '../lib/share';
import SpiritCanvas from './Spirit3D';

interface ArTabProps {
  activeSpot: Spot | null;
  agent: Agent | null;
  currentUser: User;
  isNearSpot: boolean;
  onWarpRequest: () => void;
  onPhotoTaken?: () => void; // Optional callback for quests tracker
}

export default function ArTab({
  activeSpot,
  agent,
  currentUser,
  isNearSpot,
  onWarpRequest,
  onPhotoTaken,
}: ArTabProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [useCamera, setUseCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spiritWrapRef = useRef<HTMLDivElement>(null); // 3D精霊のラッパ（写真合成用）

  // Initialize/Shutdown camera stream based on useCamera toggles
  useEffect(() => {
    if (useCamera && isNearSpot) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then((s) => {
          setStream(s);
          setCameraError(null);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.error('Camera access error:', err);
          setCameraError('カメラの起動に失敗しました。カメラの使用許可が与えられているか確認してください。');
          setUseCamera(false);
        });
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [useCamera, isNearSpot]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const toggleCamera = () => {
    setUseCamera(!useCamera);
  };

  // Capture Photo Logic: draws video + hologram overlay on a Canvas
  const capturePhoto = () => {
    if (!canvasRef.current || !activeSpot || !agent) return;

    // Trigger visual Shutter Flash
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = 640;
    canvas.height = 480;

    // 1. Draw Background (Video frame or simulated Shrine art)
    if (useCamera && videoRef.current && stream) {
      // Draw camera video frame
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      // Draw Simulated mystical background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#0a0c16');
      grad.addColorStop(0.5, '#1e1115');
      grad.addColorStop(1, '#08080f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw abstract shrine Torii in background (simple vector drawing)
      ctx.strokeStyle = 'rgba(230, 0, 18, 0.25)';
      ctx.lineWidth = 10;
      // Pillars
      ctx.beginPath();
      ctx.moveTo(220, 480);
      ctx.lineTo(220, 160);
      ctx.moveTo(420, 480);
      ctx.lineTo(420, 160);
      // Top beams
      ctx.moveTo(160, 180);
      ctx.lineTo(480, 180);
      ctx.moveTo(180, 140);
      ctx.lineTo(460, 140);
      ctx.stroke();

      // Add text details
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.font = '20px monospace';
      ctx.fillText('GOD CAMERA SIMULATION MODE', 30, 50);
    }

    // 2. Draw Halo Aura
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 20;
    const haloRadius = 110;

    // Draw glowing back ring
    ctx.shadowBlur = 30;
    ctx.shadowColor = agent.haloColor;
    ctx.strokeStyle = agent.haloColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw concentric thinner ring
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, haloRadius - 10, 0, Math.PI * 2);
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;

    // 3. Draw the live 3D spirit by compositing its WebGL canvas
    const spiritCanvas = spiritWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (spiritCanvas && spiritCanvas.width > 0) {
      const size = 300;
      ctx.drawImage(spiritCanvas, centerX - size / 2, centerY - size / 2 - 10, size, size);
    } else {
      // フォールバック：3Dが読めない場合は絵文字
      const getAvatarEmoji = (type: string) => {
        switch (type) {
          case 'dragon': return '🐉';
          case 'fox': return '🦊';
          case 'buddha': return '🙏';
          case 'spirit': return '🌿';
          case 'goddess': return '🌊';
          default: return '⛩️';
        }
      };
      ctx.font = '110px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(getAvatarEmoji(agent.avatar3dUrl), centerX, centerY);
    }

    // 5. Draw Decorative HUD Overlay
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 2;
    // Four corner brackets
    const padding = 20;
    const bracketLen = 30;
    
    // Top Left
    ctx.beginPath();
    ctx.moveTo(padding + bracketLen, padding);
    ctx.lineTo(padding, padding);
    ctx.lineTo(padding, padding + bracketLen);
    // Top Right
    ctx.moveTo(canvas.width - padding - bracketLen, padding);
    ctx.lineTo(canvas.width - padding, padding);
    ctx.lineTo(canvas.width - padding, padding + bracketLen);
    // Bottom Left
    ctx.moveTo(padding + bracketLen, canvas.height - padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(padding, canvas.height - padding + -bracketLen);
    // Bottom Right
    ctx.moveTo(canvas.width - padding - bracketLen, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding + -bracketLen);
    ctx.stroke();

    // 6. Draw Branding watermark banner at bottom
    ctx.fillStyle = 'rgba(13, 14, 18, 0.85)';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`八百万神霊AR: ${agent.name} 降臨`, 20, canvas.height - 25);
    
    ctx.fillStyle = '#d4af37';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${activeSpot.name} 霊位`, canvas.width - 20, canvas.height - 25);

    // Set captured state
    const dataUrl = canvas.toDataURL('image/png');
    setCapturedImage(dataUrl);
    setIsCaptured(true);
    
    // Trigger quest callback
    if (onPhotoTaken) {
      onPhotoTaken();
    }
  };

  const handleShare = async () => {
    if (!capturedImage) return;
    setIsSharing(true);
    setShareNote(null);

    try {
      // 共有は共通ヘルパー shareToSns に一本化（Web Share シート→未対応環境はリンクをコピー）。
      // 画像（dataURL）を添付し、対応端末では神霊ARの一枚をそのまま共有できる。
      const shareUrl = activeSpot
        ? `${window.location.origin}/?spot=${activeSpot.id}`
        : window.location.origin;
      const result = await shareToSns({
        title: `八百万神霊AR: ${agent?.name ?? ''}`,
        text: `${activeSpot?.name}で神様をAR召喚しました！ #八百万クエスト #YaorozuQuest`,
        url: shareUrl,
        imageUrl: capturedImage,
      });

      if (result === 'shared' || result === 'copied') {
        setShareSuccess(true);
        // デスクトップ等の未対応環境ではリンクをコピーした旨を伝える
        setShareNote(result === 'copied' ? 'リンクをコピーしました。SNSアプリに貼り付けて投稿できます。' : null);
        setTimeout(() => {
          setShareSuccess(false);
          setShareNote(null);
        }, 3000);
      } else if (result === 'unavailable') {
        setShareNote('この環境では共有できませんでした。');
      }
      // 'cancelled' は何も表示しない（ユーザーが共有シートを閉じただけ）
    } finally {
      setIsSharing(false);
    }
  };

  const resetArPhoto = () => {
    setIsCaptured(false);
    setCapturedImage(null);
  };

  if (!activeSpot || !agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 glass-panel rounded-2xl border-black/5 bg-white/85">
        <Camera className="w-12 h-12 text-gray-300 mb-3 animate-pulse" />
        <p className="text-sm text-gray-500">
          まずはマップから神社・寺院を選択してください。
        </p>
      </div>
    );
  }

  // If user is too far from spot, lock the AR interface
  if (!isNearSpot) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 glass-panel rounded-2xl border-black/5 bg-gradient-to-br from-gray-50 to-orange-50/20 shadow-md">
        <AlertTriangle className="w-16 h-16 text-shrine-red mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-gray-800 mb-2">距離が離れすぎています</h3>
        <p className="text-xs text-gray-605 text-gray-600 max-w-sm leading-relaxed mb-6">
          神霊AR召喚を行うには、対象のスポット（<strong>{activeSpot.name}</strong>）から1km以内に接近している必要があります。
        </p>
        <button
          onClick={onWarpRequest}
          className="bg-shrine-red hover:opacity-90 text-white text-xs font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-shrine-red/10 cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          現地（1km以内）へワープして起動
        </button>
      </div>
    );
  }

  // Get active emoji
  const getAvatarEmoji = (type: string) => {
    switch (type) {
      case 'dragon': return '🐉';
      case 'fox': return '🦊';
      case 'buddha': return '🙏';
      case 'spirit': return '🌿';
      case 'goddess': return '🌊';
      default: return '⛩️';
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 relative">
      {/* Visual Shutter Shutter Flash overlay */}
      {showFlash && (
        <div className="absolute inset-0 bg-white z-50 animate-fade-out pointer-events-none" />
      )}

      {/* AR Viewfinder (Main Screen) */}
      <div
        ref={containerRef}
        className="flex-1 relative glass-panel rounded-2xl border-white/10 overflow-hidden bg-black flex items-center justify-center min-h-[300px] shadow-inner"
      >
        {!isCaptured ? (
          <>
            {/* Live Feed / Camera */}
            {useCamera ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover z-0"
              />
            ) : (
              // Simulated mystical shrine background
              <div className="absolute inset-0 bg-gradient-to-br from-[#0c0d15] via-[#1c0f13] to-[#07080f] z-0 flex items-center justify-center">
                {/* Simulated Shrine Pillars overlay */}
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_center,#ffffff_0%,transparent_70%)]" />
                <svg className="w-48 h-48 text-shrine-red opacity-[0.25] animate-pulse" viewBox="0 0 100 100" fill="none">
                  {/* Simplistic Torii Gate Silhouette */}
                  <path d="M25,85 L25,30 M75,85 L75,30 M15,35 L85,35 M20,25 L80,25" stroke="currentColor" strokeWidth="5" />
                </svg>
              </div>
            )}

            {/* Glowing AR Interface Overlays */}
            <div className="absolute inset-0 z-10 pointer-events-none p-4 flex flex-col justify-between">
              {/* TOP HUD */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-cyber-blue font-bold tracking-widest bg-dark-bg/80 border border-cyber-blue/30 px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 bg-cyber-blue rounded-full animate-ping" />
                  AR.召喚ステータス: LOCK
                </span>
                
                <span className="text-[10px] text-gold font-bold bg-dark-bg/80 border border-gold/30 px-3 py-1 rounded-full backdrop-blur-sm">
                  マーカー認識: SUCCESS
                </span>
              </div>

              {/* TARGET RETICLE BRACKETS */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/10 rounded-3xl flex items-center justify-center">
                {/* 4 neon gold corners */}
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-gold rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-gold rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-gold rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-gold rounded-br-xl" />
                
                {/* Centering crosshairs */}
                <div className="w-2 h-[1px] bg-gold/50" />
                <div className="h-2 w-[1px] bg-gold/50 absolute" />
              </div>

              {/* BOTTOM watermark */}
              <div className="flex items-end justify-between">
                <div className="text-left text-white/50 text-[9px] font-mono leading-tight bg-black/40 p-2 rounded backdrop-blur-sm">
                  <div>SPOT: {activeSpot.name}</div>
                  <div>COORD: {activeSpot.latitude.toFixed(4)}, {activeSpot.longitude.toFixed(4)}</div>
                </div>
                <div className="text-right text-white/50 text-[9px] font-mono leading-tight bg-black/40 p-2 rounded backdrop-blur-sm">
                  <div>FPS: 60</div>
                  <div>DEVICE: WEBCAM_API</div>
                </div>
              </div>
            </div>

            {/* SCANLINE ANIMATION */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
              <div className="absolute w-full h-[3px] ar-scanner-line opacity-40" />
            </div>

            {/* Hologram Representation of God */}
            <div className="absolute z-10 flex flex-col items-center justify-center animate-float">
              {/* Rotating Aura Ring */}
              <div
                className="w-48 h-48 rounded-full border-2 border-dashed animate-halo-rotate absolute flex items-center justify-center pointer-events-none"
                style={{
                  borderColor: agent.haloColor,
                  boxShadow: `0 0 25px ${agent.haloColor}30, inset 0 0 15px ${agent.haloColor}15`,
                }}
              />
              {/* Internal glowing circle */}
              <div
                className="w-40 h-40 rounded-full border border-double absolute pointer-events-none opacity-40"
                style={{ borderColor: agent.haloColor }}
              />

              {/* God Character — 3D 精霊（カメラに重ねて出現） */}
              <div
                ref={spiritWrapRef}
                className="relative z-10 w-56 h-56 pointer-events-none"
                style={{ filter: `drop-shadow(0 0 24px ${agent.haloColor}66)` }}
              >
                <SpiritCanvas seed={agent.name} motion="greet" style={{ width: '100%', height: '100%' }} />
              </div>

              {/* Floating Accessories */}
              {agent.accessoryType !== 'なし' && (
                <div
                  className="absolute bottom-2 right-2 text-3xl animate-pulse z-20"
                  style={{
                    filter: `drop-shadow(0 0 8px ${agent.haloColor})`,
                  }}
                >
                  {agent.accessoryType === '鏡' ? '🪞' : agent.accessoryType === '剣' ? '⚔️' : agent.accessoryType === '扇子' ? '🪭' : ''}
                </div>
              )}

              {/* Glowing Halo halo ring */}
              <div
                className="absolute -top-4 w-12 h-3 rounded-full opacity-60 pointer-events-none"
                style={{
                  border: `2px solid ${agent.haloColor}`,
                  boxShadow: `0 0 8px ${agent.haloColor}`,
                  transform: 'rotateX(75deg)',
                }}
              />

              {/* Creator Credit Badge inside AR view */}
              {activeSpot.creatorId && (
                <div className="absolute -bottom-14 whitespace-nowrap bg-black/75 border border-gold/40 text-gold text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 backdrop-blur shadow-lg">
                  <Sparkles className="w-3 h-3 text-gold animate-pulse" />
                  創世主クレジット表示中
                </div>
              )}
            </div>
          </>
        ) : (
          // Photo preview state
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-dark-bg/95">
            <div className="w-full max-w-sm rounded-xl overflow-hidden border border-white/10 shadow-2xl relative bg-dark-surface">
              {/* Captured Canvas Preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage || ''}
                alt="Captured God AR"
                className="w-full h-auto object-contain"
              />
              
              {/* Share Watermark Tag */}
              <div className="absolute top-2 right-2 bg-black/60 border border-white/10 text-[9px] px-2 py-0.5 rounded text-white flex items-center gap-1 backdrop-blur-sm">
                <Check className="w-3 h-3 text-cyber-green" /> Captured
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invisible Canvas for composite photo generation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Control Buttons Bar */}
      <div className="glass-panel p-3 rounded-2xl border-black/5 bg-white/90 shadow-sm flex items-center justify-between gap-3 text-xs">
        {!isCaptured ? (
          <>
            {/* Real Camera Feed Toggle */}
            <button
              onClick={toggleCamera}
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                useCamera
                  ? 'bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue hover:bg-cyber-blue/20 shadow-sm'
                  : 'bg-white border-gray-250 text-gray-650 hover:bg-gray-50'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${useCamera ? 'animate-spin-slow' : ''}`} />
              {useCamera ? '背景シミュレータに切替' : '実カメラ映像をON'}
            </button>

            {/* Shutter Capture Button */}
            <button
              onClick={capturePhoto}
              className="bg-gold hover:bg-gold-light text-amber-950 px-5 py-2.5 rounded-xl font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-gold/20 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              AR記念撮影
            </button>
          </>
        ) : (
          <>
            {/* Discard Photo */}
            <button
              onClick={resetArPhoto}
              className="bg-white border border-gray-250 text-gray-650 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer shadow-sm"
            >
              撮り直す
            </button>

            {/* Actions for captured photo */}
            <div className="flex gap-2">
              <a
                href={capturedImage || '#'}
                download={`yaorozu_${agent.name}_ar.png`}
                className="bg-cyber-blue hover:bg-opacity-90 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-md shadow-cyber-blue/20"
              >
                <Download className="w-3.5 h-3.5" />
                保存
              </a>

              <button
                onClick={handleShare}
                disabled={isSharing}
                className="bg-gold hover:bg-gold-light text-amber-950 px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-md shadow-gold/20 disabled:opacity-50"
              >
                {shareSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-amber-950" />
                    シェア完了！
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    {isSharing ? 'シェア中...' : 'SNSへシェア'}
                  </>
                )}
              </button>
            </div>

            {shareNote && (
              <p className="text-[10px] text-gray-500 text-center -mt-1">{shareNote}</p>
            )}
          </>
        )}
      </div>

      {/* Captured Preview OGP preview for Social media */}
      {isCaptured && capturedImage && (
        <div className="glass-panel p-4 rounded-2xl border-black/5 bg-white/80 space-y-3 shadow-sm">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyber-blue" />
            SNS OGPシェア・プレビュー
          </h4>
          <p className="text-[10px] text-gray-600">
            X (Twitter) などで投稿した際、タイムライン上では以下のように動的なプレビュー画像が表示され、バイラル拡散を促進します。
          </p>
          <div className="border border-gray-200 rounded-xl overflow-hidden max-w-sm mx-auto bg-white p-3 text-[11px] text-gray-800 space-y-2 font-sans shadow-sm">
            {/* Simulated Tweet */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gold/15 rounded-full border border-gold/40 flex items-center justify-center text-xs">⛩️</div>
              <div>
                <span className="font-bold">{currentUser.displayName}</span>
                <span className="text-gray-500 ml-1">@pilgrim_yaorozu</span>
              </div>
            </div>
            <p className="text-gray-700">
              {activeSpot.name}で神様 {agent.name} を召喚した！めっちゃ良い写真撮れた！神のご加護がありますように。
              <span className="text-cyber-blue"> #八百万クエスト</span> <span className="text-cyber-blue"> #YaorozuQuest</span>
            </p>
            {/* Card view */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capturedImage} alt="OGP preview" className="w-full h-32 object-cover" />
              <div className="p-2 border-t border-gray-200">
                <div className="text-gray-500 text-[9px] uppercase">yaorozu-quest.app</div>
                <div className="font-bold text-gray-900 text-[10px] truncate">
                  八百万神霊AR - {agent.name} 降臨写真 【{activeSpot.name}】
                </div>
                <div className="text-gray-400 text-[9px] truncate">
                  UGC投稿で徳を積み、この場所の「創世主」となりAIエージェントを支配せよ！
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
