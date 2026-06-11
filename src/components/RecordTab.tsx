'use client';

import React, { useMemo, useState } from 'react';
import { Search, MapPin, Camera, CalendarDays, Trash2, Check, Stamp, NotebookPen, X, Plus } from 'lucide-react';
import { Spot, User as UserType, db } from '../lib/db';
import { distanceKm } from '../lib/geo';
import {
  getVisitRecords,
  addVisitRecord,
  deleteVisitRecord,
  countVisitsForSpot,
  VisitRecord,
} from '../lib/visit-records';
import { getGoShuinList, addPhotoGoshuin, deleteGoshuin, Goshuin } from '../lib/goshuin';
import { compressImage } from '../lib/upload';

interface RecordTabProps {
  currentUser: UserType;
  userLocation: { lat: number; lng: number };
  spots: Spot[];
  onOpenDetail?: (spot: Spot) => void;
  onChanged?: () => void; // 徳の更新などを親へ通知
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

export default function RecordTab({ currentUser, userLocation, spots, onOpenDetail, onChanged }: RecordTabProps) {
  const [topTab, setTopTab] = useState<'visits' | 'goshuin'>('visits');
  const [records, setRecords] = useState<VisitRecord[]>(() => getVisitRecords(currentUser.id));
  const refresh = () => setRecords(getVisitRecords(currentUser.id));
  // タップで開く「記録の詳細」（写真を大きく・メモ全文・寺社詳細への導線）
  const [recDetail, setRecDetail] = useState<VisitRecord | null>(null);

  // 記録追加フォーム
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Spot | null>(null);
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setPhoto(await compressImage(f, { maxDim: 900, quality: 0.6 }));
    } catch {
      /* 読み込み失敗は無視（写真なしで記録できる） */
    }
  };

  const resetForm = () => {
    setSelected(null);
    setQuery('');
    setNote('');
    setPhoto(null);
    setDate(todayInput());
  };

  // 記録を保存（徳の探訪ボーナスも付与）
  const saveRecord = (spot: Spot, opts?: { visitedAt?: string; note?: string; photo?: string }) => {
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
    saveRecord(selected, {
      visitedAt: new Date(`${date}T12:00:00`).toISOString(),
      note,
      photo: photo ?? undefined,
    });
    resetForm();
  };

  // ── 御朱印（撮影して保存）──
  const [goshuinList, setGoshuinList] = useState<Goshuin[]>(() => getGoShuinList(currentUser.id));
  const refreshGoshuin = () => setGoshuinList(getGoShuinList(currentUser.id));
  const [gFormOpen, setGFormOpen] = useState(false);
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
      {/* 上部タブ */}
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

      {topTab === 'visits' ? (
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
                {photo ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="参拝の写真" className="w-full max-h-48 object-cover" />
                    <button
                      onClick={() => setPhoto(null)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 text-[13px] font-black py-2.5 rounded-xl cursor-pointer hover:bg-gray-200 transition-all">
                    <Camera className="w-4 h-4" />写真を追加（御朱印など・任意）
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
                  </label>
                )}
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
                {sortedRecords.map((rec) => (
                  <div key={rec.id} className="flex gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                    {/* カード本体のタップで詳細を開く（削除は右の独立ボタン） */}
                    <button onClick={() => setRecDetail(rec)} className="flex gap-3 flex-1 min-w-0 text-left cursor-pointer">
                      {rec.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rec.photo} alt={rec.spotName} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
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
                      </div>
                    </button>
                    <button
                      onClick={() => { deleteVisitRecord(currentUser.id, rec.id); refresh(); }}
                      className="self-start w-7 h-7 rounded-full hover:bg-rose-50 flex items-center justify-center text-gray-300 hover:text-rose-500 transition-all cursor-pointer"
                      title="記録を削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
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
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">※御朱印は公式のものではありません</span>
                <span className="text-[12px] font-black text-gray-400">{goshuinList.length}件</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[...goshuinList].reverse().map((g) => (
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

      {/* ── 記録の詳細（写真を大きく・メモ全文・寺社詳細への導線） ── */}
      {recDetail && (() => {
        const detailSpot = spots.find((s) => s.id === recDetail.spotId) ?? null;
        return (
          <div className="fixed inset-0 z-[3500] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/55" onClick={() => setRecDetail(null)} />
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              {/* 写真（あれば大きく） */}
              {recDetail.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={recDetail.photo} alt={recDetail.spotName} className="w-full h-56 object-cover flex-shrink-0" />
              ) : (
                <div className="w-full h-32 flex items-center justify-center text-6xl bg-gradient-to-br from-blue-50 to-amber-50 flex-shrink-0">
                  {recDetail.godEmoji}
                </div>
              )}
              <button
                onClick={() => setRecDetail(null)}
                aria-label="閉じる"
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-4 overflow-y-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {ordinalOf(recDetail)}回目の記録
                  </span>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />{fmtDate(recDetail.visitedAt)} 参拝
                  </span>
                </div>
                <h3 className="text-lg font-black text-gray-900 mt-1.5">{recDetail.godEmoji} {recDetail.spotName}</h3>
                {recDetail.note ? (
                  <p className="text-[14px] text-gray-700 leading-relaxed mt-2 whitespace-pre-wrap">{recDetail.note}</p>
                ) : (
                  <p className="text-[13px] text-gray-300 mt-2">メモはありません</p>
                )}

                <div className="flex items-center gap-2 mt-4">
                  {detailSpot && (
                    <button
                      onClick={() => { setRecDetail(null); onOpenDetail?.(detailSpot); }}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-shrine-red text-white text-[13px] font-black py-2.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <MapPin className="w-4 h-4" />この寺社の詳細を開く
                    </button>
                  )}
                  <button
                    onClick={() => { deleteVisitRecord(currentUser.id, recDetail.id); refresh(); setRecDetail(null); }}
                    className="flex items-center justify-center gap-1 text-[13px] font-black text-rose-500 bg-rose-50 px-3.5 py-2.5 rounded-xl hover:bg-rose-100 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />削除
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
