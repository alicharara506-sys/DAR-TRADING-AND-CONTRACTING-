'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Dictionary, getDictionary, isRtl, translate } from '@/i18n';
import { get, getTokens, post, setTokens } from '@/lib/api';

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
interface I18nContextValue {
  locale: string;
  dict: Dictionary;
  dir: 'ltr' | 'rtl';
  t: (path: string) => string;
  switchLocale: (locale: string) => void;
}
const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside provider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  role: { name: string };
  company: { id: string; name: string; baseCurrency: string };
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (resource: string, action: string) => boolean;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}

function AuthProvider({ children, locale }: { children: React.ReactNode; locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasTokens = typeof window !== 'undefined' && !!getTokens();

  const { data: user, isLoading, refetch } = useQuery<AuthUser | null>({
    queryKey: ['me'],
    queryFn: async () => {
      if (!getTokens()) return null;
      return get<AuthUser>('/auth/me');
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const login = async (email: string, password: string) => {
    const tokens = await post('/auth/login', { email, password });
    setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    await refetch();
    router.push(`/${locale}/dashboard`);
  };

  const logout = () => {
    const tokens = getTokens();
    if (tokens) post('/auth/logout', { refreshToken: tokens.refreshToken }).catch(() => undefined);
    setTokens(null);
    router.push(`/${locale}/login`);
  };

  const can = (resource: string, action: string) =>
    !!user &&
    (user.role.name === 'ADMIN' || user.permissions.includes(`${resource}:${action}`));

  // guard: redirect unauthenticated users to login
  useEffect(() => {
    const isLogin = pathname?.includes('/login');
    if (!isLoading && !user && !hasTokens && !isLogin) {
      router.replace(`/${locale}/login`);
    }
  }, [isLoading, user, hasTokens, pathname, router, locale]);

  return (
    <AuthContext.Provider value={{ user: user ?? null, loading: isLoading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Root providers
// ---------------------------------------------------------------------------
export function Providers({ children, locale }: { children: React.ReactNode; locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  const i18n = useMemo<I18nContextValue>(() => {
    const dict = getDictionary(locale);
    return {
      locale,
      dict,
      dir: isRtl(locale) ? 'rtl' : 'ltr',
      t: (path: string) => translate(dict, path),
      switchLocale: (next: string) => {
        const parts = (pathname ?? '/').split('/');
        parts[1] = next;
        document.cookie = `dar-locale=${next};path=/;max-age=31536000`;
        router.push(parts.join('/') || `/${next}`);
      },
    };
  }, [locale, pathname, router]);

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <I18nContext.Provider value={i18n}>
          <AuthProvider locale={locale}>{children}</AuthProvider>
        </I18nContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
