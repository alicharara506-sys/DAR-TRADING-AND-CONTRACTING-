'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState, Input, Spinner } from '@/components/ui/primitives';
import { useI18n } from '@/components/providers';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null;
  className?: string;
  align?: 'start' | 'end' | 'center';
}

/**
 * Client-side data table: search, sort, pagination.
 * Server-paginated lists pass data straight through with `total`.
 */
export function DataTable<T extends { id?: string }>({
  data,
  columns,
  loading,
  searchKeys,
  pageSize = 15,
  onRowClick,
  toolbar,
  dense,
}: {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchKeys?: string[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  dense?: boolean;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let rows = data;
    if (query && searchKeys?.length) {
      const q = query.toLowerCase();
      rows = rows.filter((row) =>
        searchKeys.some((k) => {
          const v = k.split('.').reduce<any>((acc, part) => acc?.[part], row);
          return v !== null && v !== undefined && String(v).toLowerCase().includes(q);
        }),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      rows = [...rows].sort((a, b) => {
        const av = col?.sortValue ? col.sortValue(a) : (a as any)[sort.key];
        const bv = col?.sortValue ? col.sortValue(b) : (b as any)[sort.key];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return (av < bv ? -1 : 1) * sort.dir;
      });
    }
    return rows;
  }, [data, query, sort, searchKeys, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {searchKeys?.length ? (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={t('common.search')}
              className="ps-9"
              aria-label={t('common.search')}
            />
          </div>
        ) : (
          <div />
        )}
        {toolbar}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-start font-semibold',
                    col.align === 'end' && 'text-end',
                    col.align === 'center' && 'text-center',
                    col.className,
                  )}
                >
                  <button
                    className="inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200"
                    onClick={() =>
                      setSort((s) =>
                        s?.key === col.key
                          ? s.dir === 1
                            ? { key: col.key, dir: -1 }
                            : null
                          : { key: col.key, dir: 1 },
                      )
                    }
                  >
                    {col.header}
                    {sort?.key === col.key &&
                      (sort.dir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <Spinner className="mx-auto" />
                </td>
              </tr>
            ) : current.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState label={t('common.noData')} />
                </td>
              </tr>
            ) : (
              current.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-zinc-100 transition-colors last:border-0 dark:border-zinc-800/60',
                    onRowClick && 'cursor-pointer hover:bg-brand-50/50 dark:hover:bg-zinc-800/50',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 align-middle',
                        dense ? 'py-2' : 'py-3',
                        col.align === 'end' && 'text-end',
                        col.align === 'center' && 'text-center',
                        col.className,
                      )}
                    >
                      {col.render ? col.render(row) : ((row as any)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
          <span>
            {t('common.page')} {page + 1} {t('common.of')} {pageCount} · {filtered.length} {t('common.rows')}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
            >
              ‹
            </button>
            <button
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
