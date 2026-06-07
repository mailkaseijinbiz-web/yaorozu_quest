'use client';

import React, { useState } from 'react';
import { ThumbsUp, Send, User, MapPin, Sparkles, HelpCircle, ChevronUp, ChevronDown, MessageSquare } from 'lucide-react';
import { Spot, UgcPost, AffiliateLink, User as UserType } from '../lib/db';

interface UgcPanelProps {
  activeSpot: Spot | null;
  ugcList: UgcPost[];
  affiliates: AffiliateLink[];
  currentUser: UserType;
  creatorProfile: UserType | null;
  userTokuAtSpot: number;
  onAddUgc: (content: string) => void;
  onLikePost: (postId: string) => void;
  onUnlikePost: (postId: string) => void;
  onShareSpot: (spotId: string) => void; // Callback to award Toku for sharing
  sheetState: 'collapsed' | 'half' | 'expanded';
  setSheetState: (state: 'collapsed' | 'half' | 'expanded') => void;
  onNavigateToChat: () => void;
}

export default function UgcPanel({
  activeSpot,
  ugcList,
  affiliates,
  currentUser,
  creatorProfile,
  userTokuAtSpot,
  onAddUgc,
  onLikePost,
  onUnlikePost,
  onShareSpot,
  sheetState,
  setSheetState,
  onNavigateToChat,
}: UgcPanelProps) {
  const [inputText, setInputText] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const handleSnsShare = () => {
    if (!activeSpot) return;
    const shareUrl = `${window.location.origin}/?spot=${activeSpot.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      onShareSpot(activeSpot.id);
    }).catch(() => {
      // Fallback
      onShareSpot(activeSpot.id);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onAddUgc(inputText.trim());
    setInputText('');
  };

  if (!activeSpot) return null;

  const handleDragHeaderClick = () => {
    if (sheetState === 'collapsed') {
      setSheetState('half');
    } else if (sheetState === 'half') {
      setSheetState('expanded');
    } else {
      setSheetState('collapsed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md text-gray-800 rounded-t-3xl border-t border-black/10 shadow-2xl relative transition-all duration-300">
      
      {/* iOS Drag Indicator & Collapsible Trigger */}
      <div 
        onClick={handleDragHeaderClick}
        className="py-3 cursor-pointer flex flex-col items-center justify-center select-none active:bg-black/5 rounded-t-3xl"
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full mb-1" />
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-800 uppercase tracking-widest font-black">
            {activeSpot.name}
          </span>
          {sheetState === 'expanded' ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
          )}
        </div>
      </div>

      {/* Sheet Content Scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
        
        {/* Spot Summary & Core Actions */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-shrine-red/10 border border-shrine-red/30 text-shrine-red text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                {activeSpot.category}
              </span>
              <span className="text-gray-500 text-[10px] font-mono">
                必要徳: {activeSpot.tokuRequirement} pts
              </span>
            </div>
            <h3 className="text-lg font-black text-gray-900">{activeSpot.name}</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{activeSpot.description}</p>
          </div>

          {/* Quick Chat Shortcut */}
          <button
            onClick={onNavigateToChat}
            className="flex-shrink-0 bg-gold hover:opacity-90 text-white p-3 rounded-2xl flex items-center justify-center shadow-lg shadow-gold/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>

        {/* Creator & Your Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Creator Profile */}
          <div className="glass-panel p-3 rounded-2xl border-black/5 bg-gray-50/80 flex items-center gap-2 shadow-sm">
            <div 
              className="w-8 h-8 rounded-full bg-white border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0"
              style={creatorProfile?.avatarFrameColor ? { borderColor: creatorProfile.avatarFrameColor, borderWidth: '1.5px' } : {}}
            >
              {creatorProfile ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creatorProfile.avatarUrl} alt={creatorProfile.displayName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[8px] text-gold font-bold block leading-none mb-0.5">創世主</span>
              <span className="text-xs font-bold text-gray-800 block truncate leading-tight">
                {creatorProfile ? creatorProfile.displayName : '未就任'}
              </span>
            </div>
          </div>

          {/* Your Toku */}
          <div className="glass-panel p-3 rounded-2xl border-black/5 bg-gray-50/80 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[8px] text-cyber-blue font-bold block leading-none mb-0.5">あなたの徳</span>
              <span className="text-xs font-bold text-gray-800 block leading-tight">
                {userTokuAtSpot} pts
              </span>
            </div>
            <Sparkles className="w-4 h-4 text-cyber-blue animate-pulse" />
          </div>
        </div>

        {/* Only show full details when not collapsed */}
        {sheetState !== 'collapsed' && (
          <>
            {/* Spot Enjoyments Guide & SNS Share */}
            <div className="glass-panel p-3.5 rounded-2xl border-black/5 bg-amber-50/15 space-y-3.5 shadow-sm">
              <h4 className="text-xs font-black text-amber-800 flex items-center gap-1.5 leading-none">
                <span>🗺️</span>
                <span>このスポットの楽しみ方</span>
              </h4>
              <ul className="space-y-2 text-[10px] text-gray-700 leading-relaxed font-sans pl-0.5">
                {activeSpot.enjoyments?.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 text-xs flex-shrink-0 leading-none">🔸</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
              
              <button
                onClick={handleSnsShare}
                className="w-full bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 text-white py-2 px-3 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-md shadow-sky-400/15 active:scale-95 cursor-pointer"
              >
                <span>🔗</span>
                <span>SNSで共有して徳を積む (+15 pts)</span>
              </button>
            </div>

            {/* Guide & Help system */}
            <div className="text-[11px]">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="text-gray-500 hover:text-gray-800 transition-all flex items-center gap-1 cursor-pointer font-bold"
              >
                <HelpCircle className="w-3.5 h-3.5 text-gold" />
                <span>徳システムと創世主になる方法</span>
              </button>
              {showHelp && (
                <div className="bg-gray-50 border border-black/5 p-3 rounded-xl mt-2 space-y-1 text-gray-600 leading-relaxed shadow-inner">
                  <p>投稿（+50徳）、役に立った評価の獲得（+10徳）を重ね、このスポットで累積徳が1位になると<strong>創世主</strong>となります。創世主は「創世主設定」から神仏アバターの口調やビジュアルをカスタマイズできます。</p>
                </div>
              )}
            </div>

            {/* Local Affiliate Listings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">周辺のおすすめ情報</h4>
                <span className="text-[9px] text-gold font-bold bg-gold/10 px-2 py-0.5 rounded border border-gold/25">提携中</span>
              </div>
              
              {affiliates.length === 0 ? (
                <p className="text-[10px] text-gray-500">現在、おすすめ案件はありません。</p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {affiliates.map((aff) => (
                    <a
                      key={aff.id}
                      href={aff.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glass-panel p-2.5 rounded-2xl border-black/5 bg-white hover:bg-gray-50 flex gap-3 transition-all group shadow-sm hover:border-gold/30"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-black/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={aff.imageUrl} alt={aff.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold text-gold uppercase tracking-wider font-sans">
                              {aff.category === 'hotel' ? '🏨 宿泊' : aff.category === 'restaurant' ? '🍱 グルメ' : '🚣 体験'}
                            </span>
                            <span className="text-[9px] font-bold text-gray-700">★ {aff.rating}</span>
                          </div>
                          <h5 className="font-bold text-[11px] text-gray-900 truncate mt-0.5 group-hover:text-gold transition-all">
                            {aff.title}
                          </h5>
                        </div>
                        <div className="flex justify-between items-center text-[10px] mt-1">
                          <span className="text-gray-500 font-mono">{aff.priceRange}</span>
                          <span className="text-cyber-blue font-bold">予約する →</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* UGC Input Form */}
            <div className="glass-panel p-3.5 rounded-2xl border-black/5 bg-gray-50/80 shadow-sm">
              <h4 className="text-xs font-black text-gray-800 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-gold" />
                この場所の口コミを投稿する
              </h4>
              <form onSubmit={handleSubmit} className="space-y-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="豆知識やおすすめスポットを共有して徳を獲得しましょう！"
                  rows={2}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:border-gold transition-all leading-relaxed shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="w-full bg-shrine-red hover:opacity-90 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-shrine-red/10 cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  送信して徳を積む (+50 pts)
                </button>
              </form>
            </div>

            {/* UGC Feed */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">参拝者の声 ({ugcList.length})</h4>
              {ugcList.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-gray-200 rounded-2xl text-[10px] text-gray-400 bg-white">
                  まだ口コミがありません。最初の発見者になりましょう。
                </div>
              ) : (
                <div className="space-y-2.5">
                  {ugcList.map((post) => {
                    const isLiked = post.likedBy.includes(currentUser.id);
                    return (
                      <div key={post.id} className="glass-panel p-3 rounded-2xl border-black/5 bg-white space-y-2 shadow-sm">
                        <div className="flex items-center justify-between text-[9px] text-gray-500">
                          <span className="font-bold text-gray-600 flex items-center gap-1">
                            <span className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center text-[9px]">🧑</span>
                            {post.userDisplayName}
                          </span>
                          <span>{new Date(post.createdAt).toLocaleDateString('ja-JP')}</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed font-sans">{post.content}</p>
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => (isLiked ? onUnlikePost(post.id) : onLikePost(post.id))}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                              isLiked
                                ? 'bg-amber-50 border-amber-300 text-amber-700'
                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>役に立った ({post.likesCount})</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
