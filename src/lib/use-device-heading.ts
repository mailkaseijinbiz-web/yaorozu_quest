import { useEffect, useState } from 'react';

/**
 * 端末の向き（方位磁針）を返すフック。北=0、時計回り、単位は度。取得不可なら null。
 * iOS は webkitCompassHeading、その他は deviceorientation の alpha を (360 - alpha) % 360 で
 * 「北=0・時計回り」に正規化する。iOS 13+ は最初のユーザー操作で許可を要求する。
 *
 * 注意: アプリ全体で1箇所だけ呼ぶこと（リスナ・許可要求の二重登録を避けるため、
 * 値が必要な子コンポーネントには props で配る）。
 */
export function useDeviceHeading(): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => {
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading; // iOS
      else if (e.absolute === true && typeof e.alpha === 'number') h = (360 - e.alpha) % 360; // Android/絶対
      else if (typeof e.alpha === 'number') h = (360 - e.alpha) % 360;
      if (h != null && !isNaN(h)) setHeading(h);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE: any = typeof window !== 'undefined' ? (window as any).DeviceOrientationEvent : undefined;
    let attached = false;
    const attach = () => {
      window.addEventListener('deviceorientationabsolute', handler as EventListener);
      window.addEventListener('deviceorientation', handler as EventListener);
      attached = true;
    };
    if (DOE && typeof DOE.requestPermission === 'function') {
      // iOS 13+ はユーザー操作で許可が必要 → 最初のタップで要求
      const onFirst = () => {
        DOE.requestPermission().then((s: string) => { if (s === 'granted') attach(); }).catch(() => {});
        window.removeEventListener('touchend', onFirst);
        window.removeEventListener('click', onFirst);
      };
      window.addEventListener('touchend', onFirst, { once: true });
      window.addEventListener('click', onFirst, { once: true });
      return () => {
        window.removeEventListener('touchend', onFirst);
        window.removeEventListener('click', onFirst);
        if (attached) {
          window.removeEventListener('deviceorientationabsolute', handler as EventListener);
          window.removeEventListener('deviceorientation', handler as EventListener);
        }
      };
    }
    attach();
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener);
      window.removeEventListener('deviceorientation', handler as EventListener);
    };
  }, []);

  return heading;
}
