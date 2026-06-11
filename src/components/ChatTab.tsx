'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageCircle, HelpCircle, AlertCircle, ShoppingBag, ChevronLeft, MapPin } from 'lucide-react';
import { Spot, Agent, UgcPost, AffiliateLink, User, db } from '../lib/db';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  createdAt: string;
}

interface ChatTabProps {
  activeSpot: Spot | null;
  agent: Agent | null;
  ugc: UgcPost[];
  affiliates: AffiliateLink[];
  currentUser: User;
  onSelectSpotById?: (spotId: string) => void; // Optional callback to change selected spot from chat
  onMessageSent?: () => void; // Optional callback for quests tracker
}

const PRESET_PROMPTS = [
  { text: '自己紹介をして！', icon: '✨' },
  { text: 'このスポットの歴史は？', icon: '📜' },
  { text: '美味しい店はある？', icon: '🍜' },
  { text: '近くのおすすめホテルは？', icon: '🏨' },
];

export default function ChatTab({
  activeSpot,
  agent,
  ugc,
  affiliates,
  currentUser,
  onSelectSpotById,
  onMessageSent,
}: ChatTabProps) {
  const [messages, setMessages] = useState<{ [spotId: string]: Message[] }>({});
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showInbox, setShowInbox] = useState(!activeSpot); // If no active spot, show inbox list
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history for the active spot
  const activeSpotId = activeSpot?.id || '';
  const chatHistory = activeSpotId ? messages[activeSpotId] || [] : [];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Sync showInbox state if activeSpot changes externally
  useEffect(() => {
    if (activeSpot) {
      setShowInbox(false);
    } else {
      setShowInbox(true);
    }
  }, [activeSpot]);

  // Insert initial greeting if empty
  useEffect(() => {
    if (!activeSpotId || !agent || !activeSpot) return;

    if (!messages[activeSpotId] || messages[activeSpotId].length === 0) {
      let greeting = '';
      switch (agent.voiceTone) {
        case '親しみやすい':
          greeting = `ようこそ、${activeSpot.name}へ！オレはこの地を守る「${agent.name}」でぃ！歴史でも何でも聞いてきな！`;
          break;
        case '高飛車':
          greeting = `ふん、伏見稲荷の白狐「${agent.name}」です。用もないのに私の前に立つとは…。まあ、話くらいは聞いてあげます。`;
          break;
        case '賢者':
          greeting = `ようこそ参られました。私は大仏「${agent.name}」にございます。慌ただしい日常を忘れ、ここでは静かに心を落ち着かせなされ。`;
          break;
        case '神秘的':
          greeting = `明治の杜へようこそ。私は「${agent.name}」、この深い森の精霊です。心の中にある問いをそっと私に教えてください。`;
          break;
        case '厳格':
          greeting = `厳島を司る海の女神、「${agent.name}」でございます。そなたの清らかな心で、私に問いを投げかけるが良い。`;
          break;
        default:
          greeting = `私はこのスポットを守護する「${agent.name}」です。何が知りたいですか？`;
      }

      if (agent.firstMessage && agent.firstMessage.trim().length > 0) {
        greeting = agent.firstMessage;
      }

      setMessages((prev) => ({
        ...prev,
        [activeSpotId]: [
          {
            id: `msg-greet-${Date.now()}`,
            sender: 'agent',
            text: greeting,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    }
  }, [activeSpotId, agent, activeSpot, messages]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !activeSpotId || !agent || isLoading) return;

    const userMessage: Message = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => ({
      ...prev,
      [activeSpotId]: [...(prev[activeSpotId] || []), userMessage],
    }));
    setInputText('');
    setIsLoading(true);
    
    // Trigger callback for Quest tracking
    if (onMessageSent) {
      onMessageSent();
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          history: (messages[activeSpotId] || []).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
          spotId: activeSpotId,
          agent,
          ugc,
          affiliates,
          userName: currentUser.displayName,
          localTime: new Date().toLocaleString('ja-JP', { hour12: false, month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      const agentMessage: Message = {
        id: `msg-agent-${Date.now()}`,
        sender: 'agent',
        text: data.response,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => ({
        ...prev,
        [activeSpotId]: [...(prev[activeSpotId] || []), agentMessage],
      }));
    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: `msg-agent-err-${Date.now()}`,
        sender: 'agent',
        text: '神聖なる通信に乱れが生じました。少し時間をおいてから再び問いかけてくだされ。',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => ({
        ...prev,
        [activeSpotId]: [...(prev[activeSpotId] || []), errorMsg],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessageText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold underline hover:text-gold-light inline-flex items-center gap-1 font-bold bg-gold/10 px-2 py-0.5 rounded border border-gold/30 mt-1 cursor-pointer transition-all"
          >
            <ShoppingBag className="w-3 h-3 text-gold" />
            詳細はこちら
          </a>
        );
      }
      return part;
    });
  };

  const getAgentAvatar = (avatarType: string) => {
    switch (avatarType) {
      case 'dragon': return '🐉';
      case 'fox': return '🦊';
      case 'buddha': return '🙏';
      case 'spirit': return '🌿';
      case 'goddess': return '🌊';
      default: return '⛩️';
    }
  };

  // INBOX VIEW: List of all Gods / Chats
  if (showInbox) {
    const allSpots = db.getSpots();
    const allAgents = db.getAgents();

    return (
      <div className="flex flex-col h-full gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-805 text-gray-900 leading-tight">神仏メッセンジャー</h2>
          <p className="text-xs text-gray-500">現在地や訪れたスポットの神様と会話が可能です。</p>
        </div>

        {/* Inbox List */}
        <div className="flex-1 space-y-2.5 overflow-y-auto">
          {allAgents.map((ag) => {
            const spot = allSpots.find((s) => s.id === ag.spotId);
            if (!spot) return null;

            return (
              <button
                key={ag.id}
                onClick={() => {
                  if (onSelectSpotById) {
                    onSelectSpotById(spot.id);
                  }
                  setShowInbox(false);
                }}
                className="w-full glass-panel p-3.5 rounded-2xl border-black/5 hover:border-gold/30 bg-white/80 shadow-sm flex items-center justify-between gap-4 transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-2.5xl relative border-2 border-black/5"
                    style={{
                      boxShadow: `0 0 10px ${ag.haloColor}30`,
                      backgroundColor: `${ag.haloColor}10`,
                      borderColor: `${ag.haloColor}30`,
                    }}
                  >
                    {getAgentAvatar(ag.avatar3dUrl)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-bold text-gray-800 text-xs group-hover:text-gold transition-all">{ag.name}</span>
                      <span className="text-[8px] bg-gray-100 border border-gray-200 text-gray-500 px-1.5 py-0.2 rounded">
                        {ag.voiceTone}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-650 text-gray-600 truncate leading-tight">{ag.personaDescription}</p>
                    <span className="text-[8px] text-gray-400 mt-1 flex items-center gap-0.5 font-sans">
                      <MapPin className="w-2.5 h-2.5" />
                      {spot.name}
                    </span>
                  </div>
                </div>
                <div className="text-cyber-blue text-xs font-bold whitespace-nowrap">対話を開始 →</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ACTIVE CHAT VIEW
  if (!activeSpot || !agent) return null;

  return (
    <div className="flex flex-col h-full gap-3">
      
      {/* Header with BACK button */}
      <div
        className="glass-panel px-3 py-2 rounded-2xl border-black/5 bg-white/90 flex items-center justify-between"
        style={{ borderLeft: `3px solid ${agent.haloColor}` }}
      >
        <div className="flex items-center gap-2">
          {/* Back to Inbox button */}
          <button
            onClick={() => setShowInbox(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-all cursor-pointer mr-0.5"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xl"
            style={{
              boxShadow: `0 0 10px ${agent.haloColor}40`,
              backgroundColor: `${agent.haloColor}15`,
              border: `1px solid ${agent.haloColor}30`,
            }}
          >
            {getAgentAvatar(agent.avatar3dUrl)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-xs text-gray-805 text-gray-900 leading-none">{agent.name}</h3>
              <span className="text-[8px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-1 py-0.2 rounded">
                {agent.voiceTone}
              </span>
            </div>
            <span className="text-[8px] text-gray-400 font-sans leading-none block mt-0.5">
              {activeSpot.name}
            </span>
          </div>
        </div>

        {/* Small HUD status */}
        <span className="text-[9px] text-gold font-bold bg-gold/10 px-2 py-0.5 rounded border border-gold/20 flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5 text-gold animate-pulse" />
          RAG同調中
        </span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 glass-panel rounded-2xl border-black/5 bg-white/70 p-3 overflow-y-auto space-y-3.5 min-h-[220px]">
        {chatHistory.map((msg) => {
          const isAgent = msg.sender === 'agent';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${isAgent ? '' : 'flex-row-reverse'}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border text-base flex-shrink-0 ${
                  isAgent ? 'bg-gold/10 border-gold/20' : 'bg-cyber-blue/10 border-cyber-blue/20'
                }`}
                style={
                  isAgent
                    ? { borderColor: `${agent.haloColor}40` }
                    : currentUser.avatarFrameColor
                    ? { borderColor: currentUser.avatarFrameColor, borderWidth: '1.5px' }
                    : {}
                }
              >
                {isAgent ? getAgentAvatar(agent.avatar3dUrl) : '🧑‍🚀'}
              </div>

              <div className="flex flex-col max-w-[80%]">
                <div
                  className={`text-[9px] text-gray-400 mb-0.5 px-0.5 ${
                    isAgent ? 'text-left' : 'text-right'
                  }`}
                >
                  {isAgent ? agent.name : currentUser.displayName}
                </div>
                <div
                  className={`px-3 py-2 rounded-2xl text-[11px] leading-relaxed whitespace-pre-wrap ${
                    isAgent
                      ? 'bg-amber-50/80 border border-amber-200/40 text-gray-800 rounded-tl-none'
                      : 'bg-sky-50 border border-sky-200/60 text-gray-800 rounded-tr-none'
                  }`}
                >
                  {formatMessageText(msg.text)}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-base animate-pulse bg-gray-50 border border-gray-200"
              style={{ borderColor: `${agent.haloColor}30` }}
            >
              {getAgentAvatar(agent.avatar3dUrl)}
            </div>
            <div className="flex flex-col max-w-[80%]">
              <span className="text-[9px] text-gray-400 mb-0.5">{agent.name}</span>
              <div className="bg-amber-50/80 border border-amber-200/40 px-3 py-1.5 rounded-2xl rounded-tl-none flex items-center gap-1 h-7">
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Presets */}
      {chatHistory.length <= 1 && !isLoading && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {PRESET_PROMPTS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(preset.text)}
              className="whitespace-nowrap glass-panel px-2.5 py-1 rounded-full border-gray-200 bg-white text-[10px] text-gray-600 hover:border-gold hover:text-gold hover:bg-gold/5 transition-all text-left flex items-center gap-0.5 cursor-pointer"
            >
              <span>{preset.icon}</span>
              <span>{preset.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Message Input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`${agent.name} に話しかける...`}
          disabled={isLoading}
          className="flex-1 bg-white border border-gray-250 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold transition-all disabled:opacity-50 shadow-sm"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="bg-gold hover:bg-gold-light text-amber-950 disabled:opacity-40 px-3.5 py-2 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
