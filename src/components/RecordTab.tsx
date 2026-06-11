'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Search, MapPin, Camera, CalendarDays, Trash2, Check, Stamp, NotebookPen, X, Pencil } from 'lucide-react';

const GoshuinJapanMap = dynamic(() => import('./GoshuinJapanMap'), {
  ssr: false,
  loading: () => <div className="w-full h-56 rounded-2xl bg-gray-100 animate-pulse" />,
});
import { Spot, User as UserType, db } from '../lib/db';
import { distanceKm } from '../lib/geo';
import {
  getVisitRecords,
  addVisitRecord,
  deleteVisitRecord,
  updateVisitRecord,
  countVisitsForSpot,
  hasRecordForSpotOnDate,
  recordPhotos,
  MAX_RECORD_PHOTOS,
  VisitRecord,
} from '../lib/visit-records';
import { getGoShuinList, addPhotoGoshuin, deleteGoshuin, grantGoShuin, hasGoShuin, Goshuin } from '../lib/goshuin';
import { compressImage } from '../lib/upload';

/** デジタル御朱印を取得できる距離（メートル）。これ未満で取得可能。 */
const GOSHUIN_RANGE_M = 100;

interface RecordTabProps {
  currentUser: UserType;
  userLocation: { lat: number; lng: number };
  spots: Spot[];
  onOpenDetail?: (spot: Spot) => void;
  onChanged?: () => void; // 徳の更新などを親へ通知
  section?: 'visits' | 'goshuin'; // 指定時はそのセクションのみ表示し、内部の切替タブを隠す
}

const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};
const catEmoji = (s: { godEmoji?: string; category?: string }) => s.godEmoji || (s.category === '神社' ? '⛩️' : '🙏');

// クエスト達成時の軌跡を小さなSVGの地図として描く（緑=出発, 赤=到着）。容量ゼロ・オフライン可。
function TrailMini({ points }: { points: { lat: number; lng: number }[] }) {
  if (!points || points.length < 2) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 150, H = 80, pad = 8;
  const spanLat = maxLat - minLat || 1e-6, spanLng = maxLng - minLng || 1e-6;
  const px = (lng: number) => pad + ((lng - minLng) / spanLng) * (W - 2 * pad);
  const py = (lat: number) => H - pad - ((lat - minLat) / spanLat) * (H - 2 * pad); // 北が上
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(p.lng).toFixed(1)} ${py(p.lat).toFixed(1)}`).join(' ');
  const a = points[0], b = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded-lg bg-gray-50 border border-gray-100">
      <path d={d} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      <circle cx={px(a.lng)} cy={py(a.lat)} r={3.5} fill="#10b981" />
      <circle cx={px(b.lng)} cy={py(b.lat)} r={3.5} fill="#ef4444" />
    </svg>
  );
}

export default function RecordTab({ currentUser, userLocation, spots, onOpenDetail, onChanged, section }: RecordTabProps) {
  const [topTab, setTopTab] = useState<'visits' | 'goshuin'>(section ?? 'visits');
  // section 固定時は内部の切替に追従させる（メインタブとして単独表示するため）
  const effectiveTab = section ?? topTab;
  const [records, setRecords] = useState<VisitRecord[]>(() => getVisitRecords(currentUser.id));
  const refresh = () => setRecords(getVisitRecords(currentUser.id));

  // 記録追加フォーム
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Spot | null>(null);
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [goshuinMsg, setGoshuinMsg] = useState<string | null>(null); // 御朱印取得のフィードバック

  // 記録の編集（あとから日付・メモ・写真を直せる）
  const [editingRec, setEditingRec] = useState<VisitRecord | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (rec: VisitRecord) => {
    setEditingRec(rec);
    setEditDate(rec.visitedAt.slice(0, 10));
    setEditNote(rec.note || '');
    setEditPhotos(recordPhotos(rec));
  };
  const onPickEditPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_RECORD_PHOTOS - editPhotos.length;
    if (room <= 0) return;
    const added: string[] = [];
    for (const f of files.slice(0, room)) {
      try { added.push(await compressImage(f, { maxDim: 900, quality: 0.6 })); } catch { /* skip */ }
    }
    if (added.length) setEditPhotos((prev) => [...prev, ...added].slice(0, MAX_RECORD_PHOTOS));
  };
  const onSaveEdit = () => {
    if (!editingRec || editSaving) return;
    setEditSaving(true);
    try {
      const visitedAt = new Date(`${editDate}T12:00:00`).toISOString();
      const ok = updateVisitRecord(currentUser.id, editingRec.id, { visitedAt, note: editNote, photos: editPhotos });
      if (!ok) { alert('記録を保存できませんでした。'); return; }
      refresh();
      onChanged?.();
      setEditingRec(null);
    } finally {
      setEditSaving(false);
    }
  };

  // 現在地から近い順の寺社（「ここに行った？」候補）。
  // 最初は3件だけ見せて「もっと見る」で広げる（記録フォームが主役なので控えめに）。
  const nearby = useMemo(
    () =>
      [...spots]
        .map((s) => ({ s, d: distanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 18),
    [spots, userLocation.lat, userLocation.lng]
  );
  const [nearbyShown, setNearbyShown] = useState(3);

  // すぐ入力できるよう、最寄りの寺社のフォームを初回に自動で開く（その後の手動操作は妨げない）。
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (effectiveTab !== 'visits' || autoSelectedRef.current) return;
    if (!selected && !query && nearby.length > 0) {
      setSelected(nearby[0].s);
      autoSelectedRef.current = true;
    }
  }, [effectiveTab, nearby, selected, query]);

  // 検索（名前・神名・カテゴリ）。近い順に最大6件。
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return [...spots]
      .filter((s) => [s.name, s.godName, s.category].some((t) => t && t.toLowerCase().includes(q)))
      .map((s) => ({ s, d: distanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6)
      .map((x) => x.s);
  }, [q, spots, userLocation.lat, userLocation.lng]);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime()),
    [records]
  );

  // その寺社の何回目か（古い順に番号を振る）
  const ordinalOf = (rec: VisitRecord) => {
    const same = records.filter((r) => r.spotId === rec.spotId).sort((a, b) => new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime());
    return same.findIndex((r) => r.id === rec.id) + 1;
  };

  // 写真を追加（複数選択可・最大 MAX_RECORD_PHOTOS 枚まで）
  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_RECORD_PHOTOS - photos.length;
    if (room <= 0) return;
    const added: string[] = [];
    for (const f of files.slice(0, room)) {
      try {
        added.push(await compressImage(f, { maxDim: 900, quality: 0.6 }));
      } catch {
        /* 読み込み失敗は無視（その1枚をスキップ） */
      }
    }
    if (added.length) setPhotos((prev) => [...prev, ...added].slice(0, MAX_RECORD_PHOTOS));
  };

  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setSelected(null);
    setQuery('');
    setNote('');
    setPhotos([]);
    setGoshuinMsg(null);
    setDate(todayInput());
  };

  // 記録を保存（徳の探訪ボーナスも付与）
  const saveRecord = (spot: Spot, opts?: { visitedAt?: string; note?: string; photos?: string[] }) => {
    setSaving(true);
    try {
      addVisitRecord(currentUser.id, spot, opts);
      db.recordVisit(currentUser.id, spot.id); // visitedSpotIds と探訪ボーナス（重複は無視）
      refresh();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const onSubmitForm = () => {
    if (!selected || saving) return;
    const visitedAt = new Date(`${date}T12:00:00`).toISOString();
    // 1日1投稿：同じ寺社・同じ日にすでに記録があれば追加しない
    if (hasRecordForSpotOnDate(currentUser.id, selected.id, visitedAt)) {
      alert('この寺社のこの日の記録はすでにあります（1日にひとつの投稿）。');
      return;
    }
    saveRecord(selected, { visitedAt, note, photos });
    resetForm();
  };

  // デジタル御朱印を取得（選択中の寺社から100m未満でのみ取得可能）
  const selectedDist = selected ? distanceKm(userLocation.lat, userLocation.lng, selected.latitude, selected.longitude) : Infinity;
  const selectedInRange = selectedDist * 1000 < GOSHUIN_RANGE_M;
  const selectedHasGoshuin = selected ? hasGoShuin(currentUser.id, selected.id) : false;
  const onGetGoshuin = () => {
    if (!selected) return;
    if (selectedHasGoshuin) { setGoshuinMsg('この場の御朱印はすでに授かっています。'); return; }
    if (!selectedInRange) { setGoshuinMsg(`御朱印は${GOSHUIN_RANGE_M}m未満に近づくと授かれます。`); return; }
    const granted = grantGoShuin(currentUser.id, selected, selected.godName || '');
    if (granted) {
      setGoshuinMsg('🧧 デジタル御朱印を授かりました！');
      refreshGoshuin();
      onChanged?.();
    } else {
      setGoshuinMsg('御朱印を保存できませんでした。');
    }
  };

  // ── 御朱印（撮影して保存）──
  const [goshuinList, setGoshuinList] = useState<Goshuin[]>(() => getGoShuinList(currentUser.id));
  const refreshGoshuin = () => setGoshuinList(getGoShuinList(currentUser.id));
  const [gFormOpen, setGFormOpen] = useState(false);
  const [goshuinSort, setGoshuinSort] = useState<'date' | 'place'>('date'); // 御朱印の並び替え（日時順／場所順）
  // 日本地図に灯す赤い点（緯度経度。古い御朱印は spot から補完）
  const goshuinPoints = useMemo(
    () =>
      goshuinList
        .map((g) => {
          if (typeof g.lat === 'number' && typeof g.lng === 'number') return { lat: g.lat, lng: g.lng, name: g.spotName };
          const s = db.getSpot(g.spotId);
          return s ? { lat: s.latitude, lng: s.longitude, name: g.spotName } : null;
        })
        .filter((p): p is { lat: number; lng: number; name: string } => !!p),
    [goshuinList]
  );
  // 並び替え後の御朱印（日時=新しい順／場所=寺社名の五十音順、同名は新しい順）
  const sortedGoshuin = useMemo(
    () =>
      [...goshuinList].sort((a, b) => {
        const t = new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
        if (goshuinSort === 'place') return a.spotName.localeCompare(b.spotName, 'ja') || t;
        return t;
      }),
    [goshuinList, goshuinSort]
  );
  const [gQuery, setGQuery] = useState('');
  const [gSelected, setGSelected] = useState<Spot | null>(null);
  const [gName, setGName] = useState('');
  const [gPhoto, setGPhoto] = useState<string | null>(null);
  const [gSaving, setGSaving] = useState(false);

  const gq = gQuery.trim().toLowerCase();
  const gMatches = useMemo(() => {
    if (!gq) return [];
    return [...spots]
      .filter((s) => [s.name, s.godName, s.category].some((t) => t && t.toLowerCase().includes(gq)))
      .slice(0, 6);
  }, [gq, spots]);

  const onPickGoshuinPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setGPhoto(await compressImage(f, { maxDim: 1100, quality: 0.7 }));
    } catch {
      /* 読み込み失敗は無視 */
    }
  };

  const resetGForm = () => { setGFormOpen(false); setGQuery(''); setGSelected(null); setGName(''); setGPhoto(null); };

  const saveGoshuinPhoto = () => {
    if (!gPhoto || gSaving) return;
    const name = (gSelected?.name || gName).trim();
    if (!name) return;
    setGSaving(true);
    try {
      const saved = addPhotoGoshuin(currentUser.id, {
        spotId: gSelected?.id,
        spotName: name,
        category: gSelected?.category,
        godName: gSelected?.godName,
        godEmoji: gSelected?.godEmoji,
        latitude: gSelected?.latitude,
        longitude: gSelected?.longitude,
        photo: gPhoto,
      });
      if (!saved) {
        alert('端末の保存容量が一杯のため、御朱印を保存できませんでした。');
        return;
      }
      refreshGoshuin();
      onChanged?.();
      resetGForm();
    } finally {
      setGSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fa] pb-6">
      {/* 上部タブ（メインタブとして単独表示するときは隠す） */}
      {!section && (
      <div className="flex border-b border-black/5 bg-white sticky top-0 z-10">
        {([
          { key: 'visits' as const, label: '参拝の記録', icon: NotebookPen },
          { key: 'goshuin' as const, label: '御朱印', icon: Stamp },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTopTab(key)}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-[13px] font-black transition-all cursor-pointer border-b-2 ${
              topTab === key ? 'text-shrine-red border-shrine-red' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
      )}

      {effectiveTab === 'visits' ? (
        <div className="p-4 space-y-6">
          {/* 新しい記録を追加 */}
          <section>
            <h3 className="text-base font-black text-gray-900 mb-2">新しい記録を追加</h3>

            {/* 寺社を検索して選択 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={selected ? selected.name : query}
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                placeholder="寺社を選択"
                className="w-full bg-white border border-gray-200 rounded-2xl pl-9 pr-9 py-3 text-sm text-gray-800 focus:outline-none focus:border-shrine-red shadow-sm"
              />
              {(selected || query) && (
                <button
                  onClick={resetForm}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 検索候補 */}
            {!selected && matches.length > 0 && (
              <div className="mt-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {matches.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelected(s); setQuery(''); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                  >
                    <span className="text-2xl">{catEmoji(s)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-black text-gray-900 truncate">{s.name}</span>
                      <span className="block text-[11px] text-gray-400 truncate">{s.category}{s.godName ? `・${s.godName}` : ''}</span>
                    </span>
                    <span className="text-[12px] font-black text-[#2563eb] flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {(() => { const d = distanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude); return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`; })()}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* 選択後の入力フォーム（日付・メモ・写真） */}
            {selected && (
              <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl">{catEmoji(selected)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-900 truncate">{selected.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{selected.category}{selected.godName ? `・${selected.godName}` : ''}</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[13px] font-bold text-gray-600">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                  参拝日
                  <input
                    type="date"
                    value={date}
                    max={todayInput()}
                    onChange={(e) => setDate(e.target.value)}
                    className="ml-auto bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-800 focus:outline-none focus:border-shrine-red"
                  />
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={140}
                  placeholder="ひとことメモ（任意）"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-shrine-red resize-none"
                />
                {/* 写真（最大 MAX_RECORD_PHOTOS 枚）。複数選択して追加できる */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-bold text-gray-500">写真（任意・最大{MAX_RECORD_PHOTOS}枚）</span>
                    <span className="text-[11px] font-black text-gray-400">{photos.length}/{MAX_RECORD_PHOTOS}</span>
                  </div>
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                      {photos.map((p, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p} alt={`参拝の写真${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {photos.length < MAX_RECORD_PHOTOS && (
                    <label className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 text-[13px] font-black py-2.5 rounded-xl cursor-pointer hover:bg-gray-200 transition-all">
                      <Camera className="w-4 h-4" />写真を追加（御朱印など・複数可）
                      <input type="file" accept="image/*" multiple className="hidden" onChange={onPickPhoto} />
                    </label>
                  )}
                </div>

                {/* デジタル御朱印の取得（100m未満でのみ） */}
                <div>
                  <button
                    onClick={onGetGoshuin}
                    disabled={selectedHasGoshuin || !selectedInRange}
                    className={`w-full flex items-center justify-center gap-1.5 text-sm font-black py-3 rounded-xl transition-all ${
                      selectedHasGoshuin
                        ? 'bg-emerald-50 text-emerald-600 cursor-default'
                        : selectedInRange
                        ? 'bg-rose-600 text-white hover:opacity-90 active:scale-[0.99] cursor-pointer'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Stamp className="w-4 h-4" />
                    {selectedHasGoshuin
                      ? 'デジタル御朱印 取得済み'
                      : selectedInRange
                      ? 'デジタル御朱印を取得'
                      : `デジタル御朱印を取得（${GOSHUIN_RANGE_M}m未満で取得可）`}
                  </button>
                  {goshuinMsg ? (
                    <p className="text-[11px] font-bold text-gray-500 mt-1.5 text-center">{goshuinMsg}</p>
                  ) : !selectedHasGoshuin ? (
                    <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                      現在地から {selectedDist < 1 ? `${Math.round(selectedDist * 1000)}m` : `${selectedDist.toFixed(1)}km`}
                      {selectedInRange ? '・取得できます' : `・あと ${Math.max(0, Math.round(selectedDist * 1000 - GOSHUIN_RANGE_M))}m`}
                    </p>
                  ) : null}
                </div>

                <button
                  onClick={onSubmitForm}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-1.5 bg-shrine-red text-white text-sm font-black py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />この参拝を記録する（+5徳）
                </button>
              </div>
            )}

            {/* ここに行った？（近くの寺社から選ぶ。「行った」で上の記録フォームが開く） */}
            {!selected && (
              <div className="mt-4">
                <p className="text-[13px] font-black text-gray-700 mb-2">ここに行った？</p>
                <div className="space-y-1.5">
                  {nearby.length === 0 && (
                    <p className="text-[13px] text-gray-400">近くの寺社が見つかりません。マップを開くと周辺の寺社が読み込まれます。</p>
                  )}
                  {nearby.slice(0, nearbyShown).map(({ s, d }) => {
                    const cnt = countVisitsForSpot(currentUser.id, s.id);
                    return (
                      <div key={s.id} className="flex items-center gap-2.5 bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2.5">
                        <button onClick={() => onOpenDetail?.(s)} className="text-2xl cursor-pointer">{catEmoji(s)}</button>
                        <button onClick={() => onOpenDetail?.(s)} className="flex-1 min-w-0 text-left cursor-pointer">
                          <span className="block text-sm font-black text-gray-900 truncate">{s.name}</span>
                          <span className="block text-[11px] text-gray-400 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`}
                            {cnt > 0 && <span className="text-emerald-600 font-black">・記録 {cnt}件</span>}
                          </span>
                        </button>
                        <button
                          onClick={() => { setSelected(s); setQuery(''); }}
                          className="flex-shrink-0 flex items-center gap-1 bg-emerald-500 text-white text-[13px] font-black px-3 py-1.5 rounded-full hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />行った
                        </button>
                      </div>
                    );
                  })}
                  {nearby.length > nearbyShown && (
                    <button
                      onClick={() => setNearbyShown((n) => n + 5)}
                      className="w-full text-[13px] font-black text-gray-500 bg-white border border-gray-100 shadow-sm rounded-2xl py-2.5 hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      もっと見る
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* これまでの記録 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-black text-gray-900">これまでの記録</h3>
              <span className="text-[12px] font-black text-gray-400">{records.length}件・参拝日順</span>
            </div>
            {sortedRecords.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                <div className="text-4xl mb-2">📓</div>
                <p className="text-[13px] text-gray-500 leading-relaxed">まだ参拝の記録がありません。<br />上の「行った」から最初の記録を残しましょう。</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedRecords.map((rec) => {
                  const pics = recordPhotos(rec);
                  return (
                  <div key={rec.id} className="flex gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                    {pics.length > 0 ? (
                      <div className="relative w-16 h-16 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pics[0]} alt={rec.spotName} className="w-16 h-16 rounded-xl object-cover" />
                        {pics.length > 1 && (
                          <span className="absolute bottom-1 right-1 text-[10px] font-black text-white bg-black/55 rounded-full px-1.5 py-0.5 leading-none">+{pics.length - 1}</span>
                        )}
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 bg-gradient-to-br from-blue-50 to-amber-50">{rec.godEmoji}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-emerald-600">{ordinalOf(rec)}回目の記録</span>
                      </div>
                      <p className="text-sm font-black text-gray-900 truncate">{rec.spotName}</p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <CalendarDays className="w-3 h-3" />{fmtDate(rec.visitedAt)} 参拝
                      </p>
                      {rec.note && <p className="text-[12px] text-gray-600 mt-1 line-clamp-2">{rec.note}</p>}
                      {rec.trail && rec.trail.length > 1 && (
                        <div className="mt-1.5 w-[150px] max-w-full">
                          <TrailMini points={rec.trail} />
                          <p className="text-[10px] text-gray-400 mt-0.5">🛤️ 当日歩いた道のり</p>
                        </div>
                      )}
                    </div>
                    <div className="self-start flex flex-col items-center gap-1">
                      <button
                        onClick={() => openEdit(rec)}
                        className="w-7 h-7 rounded-full hover:bg-blue-50 flex items-center justify-center text-gray-300 hover:text-blue-500 transition-all cursor-pointer"
                        title="記録を編集"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { deleteVisitRecord(currentUser.id, rec.id); refresh(); }}
                        className="w-7 h-7 rounded-full hover:bg-rose-50 flex items-center justify-center text-gray-300 hover:text-rose-500 transition-all cursor-pointer"
                        title="記録を削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* 御朱印コレクション（対話で授かった御朱印＋撮影して保存した御朱印） */
        <div className="p-4 space-y-4">
          {/* 撮影して追加 */}
          {gFormOpen ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-900">御朱印を撮影して保存</h3>
                <button onClick={resetGForm} className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>

              {/* 寺社を選ぶ（任意）／自由入力 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={gSelected ? gSelected.name : gQuery}
                  onChange={(e) => { setGQuery(e.target.value); setGSelected(null); setGName(e.target.value); }}
                  placeholder="寺社名（選択または入力）"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-shrine-red"
                />
              </div>
              {!gSelected && gMatches.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden -mt-1">
                  {gMatches.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setGSelected(s); setGQuery(''); setGName(s.name); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <span className="text-xl">{catEmoji(s)}</span>
                      <span className="flex-1 min-w-0 text-sm font-black text-gray-900 truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 写真 */}
              {gPhoto ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gPhoto} alt="御朱印" className="w-full max-h-64 object-cover" />
                  <button onClick={() => setGPhoto(null)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 text-[13px] font-black py-3 rounded-xl cursor-pointer hover:bg-gray-200 transition-all">
                  <Camera className="w-4 h-4" />御朱印を撮影 / 選択
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickGoshuinPhoto} />
                </label>
              )}

              <button
                onClick={saveGoshuinPhoto}
                disabled={gSaving || !gPhoto || !(gSelected?.name || gName).trim()}
                className="w-full flex items-center justify-center gap-1.5 bg-shrine-red text-white text-sm font-black py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-4 h-4" />御朱印を保存
              </button>
            </div>
          ) : (
            <button
              onClick={() => setGFormOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 bg-shrine-red text-white text-sm font-black py-3 rounded-2xl shadow-sm hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />御朱印を撮影して保存
            </button>
          )}

          {/* コレクション */}
          {goshuinList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <div className="text-4xl mb-2">🧧</div>
              <p className="text-[13px] text-gray-500 leading-relaxed">まだ御朱印がありません。<br />上のボタンで御朱印を撮影するか、マップで神と対話すると授かれます。</p>
            </div>
          ) : (
            <>
              {/* 日本地図：御朱印を授かった場所が赤く灯る */}
              {goshuinPoints.length > 0 && (
                <div>
                  <GoshuinJapanMap points={goshuinPoints} />
                  <p className="text-[10px] text-gray-400 mt-1 text-center">🗾 御朱印を授かった {goshuinPoints.length} か所が灯っています</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">※御朱印は公式のものではありません</span>
                <span className="text-[12px] font-black text-gray-400">{goshuinList.length}件</span>
              </div>
              {/* 並び替え：日時順 / 場所順 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-gray-400">並び替え</span>
                {([
                  { key: 'date', label: '日時順' },
                  { key: 'place', label: '場所順' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setGoshuinSort(key)}
                    className={`text-[12px] font-black px-2.5 py-1 rounded-full transition-all cursor-pointer ${goshuinSort === key ? 'bg-shrine-red text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {sortedGoshuin.map((g) => (
                  <div key={g.id} className="relative bg-white rounded-2xl border border-red-100 shadow-sm p-3 flex flex-col items-center text-center">
                    {g.source === 'photo' && (
                      <button
                        onClick={() => { deleteGoshuin(currentUser.id, g.id); refreshGoshuin(); onChanged?.(); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/30 text-white flex items-center justify-center cursor-pointer"
                        title="御朱印を削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {g.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.photo} alt={g.spotName} className="w-full h-28 rounded-xl object-cover mb-1.5" />
                    ) : (
                      <div className="relative w-20 h-20 flex-shrink-0 mb-1">
                        <div className="absolute inset-0 rounded-full border-4 border-red-600/80" />
                        <div className="absolute inset-1.5 rounded-full border-2 border-red-600/40" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                          <span className="text-2xl leading-none">{g.godEmoji}</span>
                          {g.godName && <span className="text-[8px] font-black text-red-700 text-center leading-tight px-1" style={{ maxWidth: 64 }}>{g.godName}</span>}
                        </div>
                      </div>
                    )}
                    <p className="text-sm font-black text-gray-900 truncate w-full">{g.spotName}</p>
                    {g.godName && <p className="text-[11px] text-gray-400 truncate w-full">{g.godName}</p>}
                    <p className="text-[10px] text-gray-300 mt-1">{fmtDate(g.receivedAt)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 記録の編集モーダル ── */}
      {editingRec && (
        <div className="fixed inset-0 z-[4000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditingRec(null)}>
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[88%] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-black/5 sticky top-0 bg-white">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5"><Pencil className="w-4 h-4 text-blue-500" />記録を編集</h3>
              <button onClick={() => setEditingRec(null)} className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm font-black text-gray-900">{editingRec.spotName}</p>

              {/* 日付 */}
              <label className="block">
                <span className="text-[11px] font-black text-gray-500 flex items-center gap-1 mb-1"><CalendarDays className="w-3 h-3" />参拝日</span>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-shrine-red" />
              </label>

              {/* メモ */}
              <label className="block">
                <span className="text-[11px] font-black text-gray-500 mb-1 block">メモ</span>
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} placeholder="参拝の思い出を残そう" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-shrine-red resize-none" />
              </label>

              {/* 写真 */}
              <div>
                <span className="text-[11px] font-black text-gray-500 mb-1.5 block">写真（{editPhotos.length}/{MAX_RECORD_PHOTOS}）</span>
                <div className="flex flex-wrap gap-2">
                  {editPhotos.map((p, i) => (
                    <div key={i} className="relative w-16 h-16">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt="" className="w-16 h-16 rounded-xl object-cover" />
                      <button onClick={() => setEditPhotos((prev) => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow cursor-pointer"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {editPhotos.length < MAX_RECORD_PHOTOS && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:text-shrine-red hover:border-shrine-red cursor-pointer transition-all">
                      <Camera className="w-5 h-5" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={onPickEditPhoto} />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-black/5 sticky bottom-0 bg-white">
              <button onClick={() => setEditingRec(null)} className="flex-1 py-2.5 rounded-full text-sm font-black text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer">キャンセル</button>
              <button onClick={onSaveEdit} disabled={editSaving} className="flex-1 py-2.5 rounded-full text-sm font-black text-white bg-shrine-red hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"><Check className="w-4 h-4" />保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
