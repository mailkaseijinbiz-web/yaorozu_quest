'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * 読み込み完了でふわっと現れる画像。読み込み中は薄いグレーの下地を見せ、
 * 真っ白からのパッと表示（カクつき）を避ける。loading は既定で 'lazy'。
 * すべての img 属性をそのまま透過するので <img> の置き換えとして使える。
 */
export default function FadeImg({ className, style, onLoad, ...rest }: Props) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  // キャッシュ済みで onLoad が発火しない場合に備え、マウント時に complete を確認する。
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      ref={ref}
      alt={rest.alt ?? ''}
      loading={rest.loading ?? 'lazy'}
      onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
      className={className}
      style={{
        backgroundColor: loaded ? undefined : 'rgba(0, 0, 0, 0.06)',
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.4s ease',
        ...style,
      }}
    />
  );
}
