'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Plus, Send, User } from 'lucide-react';
import { get, post } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Button, Spinner } from '@/components/ui/primitives';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export default function AiAssistantPage() {
  const { t, dict, locale } = useI18n();
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => get('/ai/conversations'),
  });
  const { data: conversation } = useQuery({
    queryKey: ['ai-conversation', conversationId],
    queryFn: () => get(`/ai/conversations/${conversationId}`),
    enabled: !!conversationId,
  });

  const ask = useMutation({
    mutationFn: (question: string) =>
      post('/ai/ask', { question, conversationId: conversationId ?? undefined }),
    onSuccess: (result) => {
      setConversationId(result.conversationId);
      setPending(null);
      qc.invalidateQueries({ queryKey: ['ai-conversation', result.conversationId] });
      qc.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
    onError: () => setPending(null),
  });

  const messages: Message[] = conversation?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pending]);

  const send = (question: string) => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setPending(q);
    setInput('');
    ask.mutate(q);
  };

  const suggestions: string[] = (dict as any).ai.suggestions ?? [];

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-5">
      {/* Conversation list */}
      <aside className="card hidden w-64 shrink-0 flex-col overflow-hidden lg:flex">
        <div className="border-b border-zinc-100 p-3 dark:border-zinc-800">
          <Button size="sm" variant="secondary" className="w-full" onClick={() => setConversationId(null)}>
            <Plus className="h-3.5 w-3.5" /> {t('ai.newChat')}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {(conversations ?? []).map((c: any) => (
            <button
              key={c.id}
              onClick={() => setConversationId(c.id)}
              className={cn(
                'mb-1 w-full rounded-xl px-3 py-2 text-start text-xs transition-colors',
                c.id === conversationId
                  ? 'bg-brand-50 font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
              )}
            >
              <p className="truncate">{c.title ?? '…'}</p>
              <p className="mt-0.5 text-[10px] text-zinc-400">{fmtDateTime(c.updatedAt, locale)}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <div className="card flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">{t('ai.title')}</h1>
            <p className="text-[11px] text-zinc-400">DAR Trading & Contracting</p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && !pending && (
            <div className="flex h-full flex-col items-center justify-center">
              <Bot className="mb-4 h-10 w-10 text-zinc-300" />
              <p className="mb-6 max-w-sm text-center text-sm text-zinc-400">{t('ai.placeholder')}</p>
              <div className="flex max-w-lg flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs text-zinc-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-brand-900/30"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                    m.role === 'assistant'
                      ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200',
                  )}
                >
                  {m.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div
                  className={cn(
                    'max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    m.role === 'assistant'
                      ? 'bg-zinc-50 text-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-100'
                      : 'bg-brand-700 text-white',
                  )}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {pending && (
            <>
              <div className="flex flex-row-reverse gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
                  <User className="h-4 w-4" />
                </div>
                <div className="max-w-[75%] rounded-2xl bg-brand-700 px-4 py-3 text-sm text-white">{pending}</div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-400 dark:bg-zinc-800/70">
                  <Spinner className="h-4 w-4" /> {t('ai.thinking')}
                </div>
              </div>
            </>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-zinc-100 p-4 dark:border-zinc-800"
        >
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('ai.placeholder')}
              className="h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-sm placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              aria-label={t('ai.placeholder')}
            />
            <Button type="submit" loading={ask.isPending} aria-label={t('ai.send')}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
