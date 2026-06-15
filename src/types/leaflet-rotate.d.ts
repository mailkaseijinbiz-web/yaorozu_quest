// leaflet-rotate（地図回転プラグイン）の型補完。
// 本プラグインは Leaflet の L.Map に回転 API を後付け（monkey-patch）するため、
// 利用する分のオプション/メソッドだけを宣言マージで補う。
import 'leaflet';

declare module 'leaflet' {
  interface MapOptions {
    /** 回転を有効化する（必須。false だと setBearing は無効） */
    rotate?: boolean;
    /** 初期方位（度・北=0・時計回り） */
    bearing?: number;
    /** 既定の回転コントロールを表示する（自前ボタンを使うため通常 false） */
    rotateControl?: boolean;
    /** 2本指のひねりで回転（タッチ） */
    touchRotate?: boolean;
    /** Shift+ドラッグで回転（デスクトップ） */
    shiftKeyRotate?: boolean;
    /** 方位磁針の向きに追従（本アプリでは未使用） */
    compassBearing?: boolean;
  }

  interface Map {
    /** 地図の方位を設定（度・北=0・時計回り）。'rotate' イベントを発火する。 */
    setBearing(theta: number): void;
    /** 現在の地図の方位を取得（度・[0,360)） */
    getBearing(): number;
  }
}

declare module 'leaflet-rotate';
