'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { StatusBadge } from '@/components/ui/primitives';
import { fmtDateTime } from '@/lib/format';

export default function UsersPage() {
  const { t, locale } = useI18n();
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => get('/users/roles/all') });
  const roleOptions = (roles ?? []).map((r: any) => ({ value: r.id, label: r.name.replace(/_/g, ' ') }));

  return (
    <CrudPage
      title={t('nav.users')}
      queryKey={['users']}
      listPath="/users?pageSize=200"
      createPath="/users"
      updatePath={(r: any) => `/users/${r.id}`}
      deletePath={(r: any) => `/users/${r.id}`}
      searchKeys={['email', 'firstName', 'lastName']}
      columns={[
        { key: 'firstName', header: t('common.name'), render: (r: any) => <span className="font-medium">{r.firstName} {r.lastName}</span> },
        { key: 'email', header: 'Email' },
        { key: 'role', header: 'Role', render: (r: any) => <span className="rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{r.role?.name.replace(/_/g, ' ')}</span> },
        { key: 'locale', header: 'Locale', align: 'center', render: (r: any) => r.locale?.toUpperCase() },
        { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
        { key: 'lastLoginAt', header: 'Last login', render: (r: any) => fmtDateTime(r.lastLoginAt, locale) },
      ]}
      fields={[
        { name: 'firstName', label: 'First name', required: true },
        { name: 'lastName', label: 'Last name', required: true },
        { name: 'email', label: 'Email', required: true },
        { name: 'password', label: 'Password (min 8 chars)' },
        { name: 'roleId', label: 'Role', type: 'select', options: roleOptions, required: true },
        { name: 'locale', label: 'Language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }, { value: 'fr', label: 'Français' }], defaultValue: 'en' },
        { name: 'phone', label: 'Phone' },
      ]}
    />
  );
}
