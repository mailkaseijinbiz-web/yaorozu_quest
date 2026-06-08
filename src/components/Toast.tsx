'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastTone = 'default' | 'success' | 'reward' | 'warning';

interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
}

interface NotifyOptions {
  tone?: ToastTone;
  duration?: number;
}

interface ToastContextValue {
  notify: (text: string, opts?: NotifyOptions) => void;
  toasts: ToastItem[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<ToastTone, string> = {
  default: 'bg-gray-900 text-white',
  success: 'bg-emerald-600 text-white',
  reward: 'bg-gradient-to-r from-amber-500 to-gold text-white',
  warning: 'bg-rose-600 text-white',
};

/**
 * アプリ全体で使う軽量トースト。状態だけを管理し、表示は <ToastViewport /> が担う
 * （端末枠の内側に配置できるよう分離している）。
 * 使い方: const { notify } = useToast(); notify('保存しました', { tone: 'success' });
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const notify = useCallback((text: string, opts?: NotifyOptions) => {
    const id = ++idRef.current;
    const tone = opts?.tone ?? 'default';
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    const duration = opts?.duration ?? 2200;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return <ToastContext.Provider value={{ notify, toasts }}>{children}</ToastContext.Provider>;
}

export function useToast(): Pick<ToastContextValue, 'notify'> {
  const ctx = useContext(ToastContext);
  // Provider 外でも落ちないよう no-op を返す（保険）。
  return ctx ?? { notify: () => {} };
}

/** トーストの実表示。端末枠の内側（ナビの少し上）に積み上げて出す。 */
export function ToastViewport() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[5000] flex flex-col items-center gap-2 px-6">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`toast-enter max-w-[90%] rounded-full px-4 py-2.5 text-[13px] font-black shadow-lg shadow-black/15 ${TONE_STYLE[t.tone]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
