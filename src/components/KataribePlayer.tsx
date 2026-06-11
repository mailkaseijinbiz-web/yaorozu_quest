'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';
import { UgcPost } from '../lib/db';

interface KataribePlayerProps {
  ugcList: UgcPost[];
  onClose: () => void;
}

export default function KataribePlayer({ ugcList, onClose }: KataribePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // コンポーネントマウント時に SpeechSynthesis を初期化
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      // アンマウント時に再生を強制停止
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const playNext = useCallback((index: number) => {
    if (!synthRef.current) return;
    if (index >= ugcList.length) {
      setIsFinished(true);
      setIsPlaying(false);
      return;
    }

    const post = ugcList[index];
    const textToSpeak = `${post.userDisplayName}の声。${post.content}`;

    synthRef.current.cancel(); // 念のため現在の音声をキャンセル

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9; // 少しゆっくりめに語らせる
    utterance.pitch = 0.9; // 落ち着いたトーン

    // 日本語の音声を優先的に選択
    const voices = synthRef.current.getVoices();
    const jaVoice = voices.find((v) => v.lang === 'ja-JP' || v.lang === 'ja_JP');
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    utterance.onstart = () => {
      setCurrentIndex(index);
      setIsPlaying(true);
    };

    utterance.onend = () => {
      // 1つの読み上げが終わったら少し（1秒）間をあけて次へ
      setTimeout(() => {
        if (synthRef.current && !synthRef.current.paused) {
          playNext(index + 1);
        }
      }, 1000);
    };

    utterance.onerror = (e) => {
      console.error('SpeechSynthesis error', e);
      setIsPlaying(false);
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [ugcList]);

  // 初回マウント時に少し遅延させてから再生開始（ユーザーアクション後なので自動再生ポリシーを回避しやすい）
  useEffect(() => {
    if (ugcList.length > 0 && !isFinished) {
      // モバイルブラウザによっては最初のタップイベント内での同期的な呼び出しが必要な場合があるため
      // 呼び出し元でこのコンポーネントをマウントする際に onClick イベントの延長線上になるようにする
      playNext(0);
    }
  }, [ugcList, playNext, isFinished]);

  const handleStop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsPlaying(false);
    onClose();
  };

  const currentPost = ugcList[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[6000] flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-md transition-opacity duration-1000"
      style={{ opacity: 1 }}
    >
      {/* 背景の波紋エフェクト */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {isPlaying && (
          <>
            <div className="w-64 h-64 border border-white/20 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite] opacity-30" />
            <div className="w-96 h-96 border border-white/10 rounded-full animate-[ping_6s_cubic-bezier(0,0,0.2,1)_infinite] opacity-20 absolute" />
          </>
        )}
      </div>

      <div className="relative z-10 w-full max-w-md text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-8 backdrop-blur-md border border-white/20">
          {isPlaying ? (
            <Volume2 className="w-8 h-8 text-white/80 animate-pulse" />
          ) : isFinished ? (
            <Volume2 className="w-8 h-8 text-white/30" />
          ) : (
            <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
          )}
        </div>

        {isFinished ? (
          <div className="text-white/80 font-serif animate-in fade-in duration-1000">
            <p className="text-lg mb-6 tracking-widest">語り終えました</p>
          </div>
        ) : currentPost ? (
          <div key={currentPost.id} className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <p className="text-white/50 text-sm mb-4 tracking-widest">
              {currentIndex + 1} / {ugcList.length}
            </p>
            <p className="text-white/90 text-lg md:text-xl font-serif leading-loose tracking-wide mb-6">
              {currentPost.content}
            </p>
            <p className="text-white/60 text-sm tracking-widest">
              — {currentPost.userDisplayName}
            </p>
          </div>
        ) : null}

        <button
          onClick={handleStop}
          className="mt-12 flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white/80 text-sm tracking-widest transition-colors"
        >
          {isFinished ? '戻る' : (
            <>
              <Square className="w-4 h-4 fill-current" />
              耳を塞ぐ
            </>
          )}
        </button>
      </div>
    </div>
  );
}
