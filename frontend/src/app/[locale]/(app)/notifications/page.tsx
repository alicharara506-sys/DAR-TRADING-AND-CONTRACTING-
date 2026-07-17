'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { get, post } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Button, Card, EmptyState } from '@/components/ui/primitives';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => get('/notifications') });
  const markAll = useMutation({
    mutationFn: () => post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.notifications')}</h1>
        <Button size="sm" variant="secondary" onClick={() => markAll.mutate()}>
          <CheckCheck className="h-4 w-4" /> {t('common.approve')}
        </Button>
      </div>
      <Card>
        {(data ?? []).length === 0 ? (
          <EmptyState label={t('common.noData')} />
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(data ?? []).map((n: any) => (
              <div key={n.id} className={cn('flex gap-3 py-3', !n.readAt && 'font-medium')}>
                <Bell className={cn('mt-0.5 h-4 w-4 shrink-0', n.readAt ? 'text-zinc-300' : 'text-brand-600')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs font-normal text-zinc-500">{n.body}</p>}
                  <p className="mt-1 text-[10px] text-zinc-400">{fmtDateTime(n.createdAt, locale)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
