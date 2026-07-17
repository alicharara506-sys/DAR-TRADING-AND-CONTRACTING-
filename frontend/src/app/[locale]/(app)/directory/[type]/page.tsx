'use client';

import { useParams } from 'next/navigation';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { StatusBadge } from '@/components/ui/primitives';

const TYPE_MAP: Record<string, { api: string; labelKey: string }> = {
  clients: { api: 'CLIENT', labelKey: 'nav.clients' },
  consultants: { api: 'CONSULTANT', labelKey: 'nav.consultants' },
  contractors: { api: 'CONTRACTOR', labelKey: 'nav.contractors' },
  suppliers: { api: 'SUPPLIER', labelKey: 'nav.suppliers' },
};

export default function DirectoryPage() {
  const { t } = useI18n();
  const { type } = useParams<{ type: string }>();
  const cfg = TYPE_MAP[type] ?? TYPE_MAP.clients;

  return (
    <CrudPage
      key={type}
      title={t(cfg.labelKey)}
      queryKey={['parties', cfg.api]}
      listPath={`/parties?type=${cfg.api}&pageSize=200`}
      createPath="/parties"
      updatePath={(r: any) => `/parties/${r.id}`}
      deletePath={(r: any) => `/parties/${r.id}`}
      searchKeys={['name', 'code', 'contactPerson', 'city']}
      transformSubmit={(v) => ({ ...v, type: cfg.api })}
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: 'name', header: t('common.name'), render: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'contactPerson', header: 'Contact' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Phone' },
        { key: 'city', header: 'City' },
        { key: 'rating', header: 'Rating', align: 'center', render: (r: any) => (r.rating ? '★'.repeat(r.rating) : '—') },
        { key: 'paymentTermsDays', header: 'Terms', align: 'end', render: (r: any) => (r.paymentTermsDays ? `${r.paymentTermsDays}d` : '—') },
        { key: 'isActive', header: t('common.status'), render: (r: any) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CLOSED'} /> },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: t('common.name'), required: true },
        { name: 'nameAr', label: 'Name (AR)' },
        { name: 'nameFr', label: 'Name (FR)' },
        { name: 'contactPerson', label: 'Contact person' },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'city', label: 'City' },
        { name: 'country', label: 'Country' },
        { name: 'taxNumber', label: 'Tax number' },
        { name: 'paymentTermsDays', label: 'Payment terms (days)', type: 'number' },
        { name: 'rating', label: 'Rating (1-5)', type: 'number' },
        { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 },
      ]}
    />
  );
}
