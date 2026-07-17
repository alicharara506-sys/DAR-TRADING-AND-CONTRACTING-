'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui/primitives';
import { useAuth, useI18n } from '@/components/providers';

export default function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch {
      setError(t('auth.invalid'));
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-4">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,#c49a4f33_0,transparent_40%),radial-gradient(circle_at_80%_80%,#53806833_0,transparent_40%)]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass relative w-full max-w-md rounded-2xl p-8 shadow-glass"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lg">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">{t('app.company')}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('auth.subtitle')}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="admin@dar-tc.com"
            />
          </div>
          <div>
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password" type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            {t('auth.signIn')}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400">
          {t('login.demo')}: <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{t('login.hint')}</code>
        </p>
      </motion.div>
    </div>
  );
}
