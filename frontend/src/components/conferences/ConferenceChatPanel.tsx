'use client';

import React, { useMemo, useState } from 'react';
import { DailyRoomMessage } from '@/hooks/useDailyRoom';
import { Send } from 'lucide-react';
import { formatInTZ, getUserTimezone, parseISOUTC } from '@/lib/timezone';
import { useTranslation } from 'react-i18next';

interface ConferenceChatPanelProps {
  title?: string;
  messages: DailyRoomMessage[];
  canSend?: boolean;
  sending?: boolean;
  onSend: (text: string) => Promise<void> | void;
}

function fmtClock(value: string) {
  return formatInTZ(value, getUserTimezone(), 'h:mm a');
}

export default function ConferenceChatPanel({
  title,
  messages,
  canSend = true,
  sending = false,
  onSend,
}: Readonly<ConferenceChatPanelProps>) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const panelTitle = title || t('visitor.audienceRoom.liveChat');
  const ordered = useMemo(() => messages.slice().sort((a, b) => {
    return parseISOUTC(a.createdAt).getTime() - parseISOUTC(b.createdAt).getTime();
  }), [messages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    if (!next || !canSend || sending) return;
    await onSend(next);
    setDraft('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{panelTitle}</span>
        <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
          {ordered.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
        {ordered.length === 0 && (
          <div className="h-36 flex items-center justify-center text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{t('visitor.audienceRoom.noMessages')}</p>
          </div>
        )}

        {ordered.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl border px-3 py-2 ${msg.local ? 'bg-indigo-500/10 border-indigo-500/20 ml-8' : 'bg-white/[0.03] border-white/5 mr-8'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold text-zinc-300 truncate">{msg.senderName}</p>
              <span className="text-[9px] text-zinc-600 whitespace-nowrap">{fmtClock(msg.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-100 leading-relaxed break-words">{msg.text}</p>
          </div>
        ))}
      </div>

      {canSend && (
        <form onSubmit={submit} className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('visitor.audienceRoom.chatPlaceholder')}
              className="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/35"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              <Send size={12} />
              {sending ? t('visitor.audienceRoom.sending') : t('visitor.audienceRoom.send')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
