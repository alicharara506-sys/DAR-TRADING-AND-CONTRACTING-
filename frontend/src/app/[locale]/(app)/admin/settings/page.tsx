'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Button, Card, Input, Label, Spinner } from '@/components/ui/primitives';

const FIELDS = [
  ['name', 'Company name'], ['nameAr', 'Name (Arabic)'], ['nameFr', 'Name (French)'],
  ['legalName', 'Legal name'], ['registrationNo', 'Registration no.'], ['taxNumber', 'Tax number'],
  ['address', 'Address'], ['city', 'City'], ['country', 'Country'],
  ['phone', 'Phone'], ['email', 'Email'], ['website', 'Website'],
  ['baseCurrency', 'Base currency'], ['vatRate', 'VAT rate'],
] as const;

export default function SettingsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['company'], queryFn: () => get('/company') });
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (body: Record<string, any>) => patch('/company', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading || !data) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('nav.settings')}</h1>
      <Card title={t('app.company')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const body: Record<string, any> = {};
            for (const [name] of FIELDS) {
              const v = fd.get(name);
              if (v !== null && v !== '') body[name] = name === 'vatRate' ? Number(v) : v;
            }
            save.mutate(body);
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {FIELDS.map(([name, label]) => (
            <div key={name}>
              <Label htmlFor={name}>{label}</Label>
              <Input id={name} name={name} defaultValue={data[name] ?? ''} />
            </div>
          ))}
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" loading={save.isPending}>{t('common.save')}</Button>
            {saved && <span className="text-sm text-emerald-600">✓ {t('common.updated')}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
