'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { del, get, patch, post } from '@/lib/api';
import { Column, DataTable } from '@/components/data-table';
import { Button, Input, Label, Modal, Select, Textarea } from '@/components/ui/primitives';
import { useI18n } from '@/components/providers';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  options?: { value: string; label: string }[] | string[];
  required?: boolean;
  step?: string;
  colSpan?: 2;
  /** default value applied on create */
  defaultValue?: unknown;
}

/**
 * Config-driven CRUD module page: list + create/edit modal + delete.
 * Each ERP module page declares columns + form fields and gets full behaviour.
 */
export function CrudPage<T extends { id: string }>({
  title,
  queryKey,
  listPath,
  createPath,
  updatePath,
  deletePath,
  columns,
  fields,
  searchKeys,
  transformSubmit,
  extractList,
  readOnly,
  toolbarExtra,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  queryKey: string[];
  listPath: string;
  createPath?: string;
  updatePath?: (row: T) => string;
  deletePath?: (row: T) => string;
  columns: Column<T>[];
  fields: FieldDef[];
  searchKeys?: string[];
  transformSubmit?: (values: Record<string, any>) => Record<string, any>;
  extractList?: (response: any) => T[];
  readOnly?: boolean;
  toolbarExtra?: React.ReactNode;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => get(listPath),
  });
  const rows: T[] = extractList ? extractList(data) : (data?.data ?? data ?? []);

  const save = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const body = transformSubmit ? transformSubmit(values) : values;
      if (editing && updatePath) return patch(updatePath(editing), body);
      if (createPath) return post(createPath, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setCreating(false);
      setEditing(null);
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: (row: T) => del(deletePath!(row)),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const openForm = creating || !!editing;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Record<string, any> = {};
    for (const f of fields) {
      const raw = fd.get(f.name);
      if (f.type === 'checkbox') values[f.name] = fd.get(f.name) === 'on';
      else if (raw === null || raw === '') {
        if (f.required) {
          setError(`${f.label}: ${t('common.required')}`);
          return;
        }
      } else if (f.type === 'number') values[f.name] = Number(raw);
      else values[f.name] = raw;
    }
    save.mutate(values);
  };

  const actionCol: Column<T> = {
    key: '__actions',
    header: t('common.actions'),
    align: 'end',
    render: (row) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {updatePath && (
          <button
            aria-label={t('common.edit')}
            onClick={() => setEditing(row)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-brand-700 dark:hover:bg-zinc-800"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {deletePath && (
          <button
            aria-label={t('common.delete')}
            onClick={() => window.confirm(t('common.confirmDelete')) && remove.mutate(row)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {toolbarExtra}
          {!readOnly && createPath && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> {t('common.add')}
            </Button>
          )}
        </div>
      </div>

      <div className="card p-5">
        <DataTable
          data={rows}
          columns={readOnly || (!updatePath && !deletePath) ? columns : [...columns, actionCol]}
          loading={isLoading}
          searchKeys={searchKeys}
        />
      </div>

      <Modal
        open={openForm}
        onClose={() => {
          setCreating(false);
          setEditing(null);
          setError('');
        }}
        title={editing ? t('common.edit') : t('common.add')}
        wide={fields.length > 6}
      >
        <form onSubmit={handleSubmit} key={editing?.id ?? 'new'}>
          <div className={fields.length > 6 ? 'grid grid-cols-1 gap-4 sm:grid-cols-2' : 'space-y-4'}>
            {fields.map((f) => {
              const initial =
                editing !== null
                  ? formatInitial((editing as any)[f.name], f.type)
                  : formatInitial(f.defaultValue, f.type);
              return (
                <div key={f.name} className={f.colSpan === 2 ? 'sm:col-span-2' : ''}>
                  <Label htmlFor={f.name}>
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </Label>
                  {f.type === 'select' ? (
                    <Select id={f.name} name={f.name} defaultValue={initial ?? ''} required={f.required}>
                      <option value="" disabled>
                        —
                      </option>
                      {(f.options ?? []).map((o) => {
                        const opt = typeof o === 'string' ? { value: o, label: o.replace(/_/g, ' ') } : o;
                        return (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        );
                      })}
                    </Select>
                  ) : f.type === 'textarea' ? (
                    <Textarea id={f.name} name={f.name} defaultValue={initial ?? ''} required={f.required} />
                  ) : f.type === 'checkbox' ? (
                    <input
                      id={f.name}
                      name={f.name}
                      type="checkbox"
                      defaultChecked={Boolean(initial)}
                      className="h-5 w-5 rounded accent-brand-600"
                    />
                  ) : (
                    <Input
                      id={f.name}
                      name={f.name}
                      type={f.type ?? 'text'}
                      step={f.step ?? (f.type === 'number' ? 'any' : undefined)}
                      defaultValue={initial ?? ''}
                      required={f.required}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function formatInitial(v: unknown, type?: string) {
  if (v === null || v === undefined) return undefined;
  if (type === 'date') return String(v).slice(0, 10);
  if (typeof v === 'object') return undefined;
  return v as any;
}
