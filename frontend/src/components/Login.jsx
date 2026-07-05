/**
 * Login.jsx — sign-in screen (email + password via Supabase).
 * Shows a demo-credentials card in demo mode only, and a clear configuration
 * hint when Supabase environment variables are missing.
 */

import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export default function Login() {
  const { signIn, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function fill(mail) {
    setEmail(mail);
    setPassword('demo');
  }

  const inputCls =
    'mt-1 w-full min-h-[44px] rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-crust';

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-4xl font-black tracking-tight">
            YAZ<span className="text-crust">OO</span>N
          </h1>
          <p className="text-muted text-xs font-semibold tracking-widest uppercase mt-1">Lagerverwaltung</p>
          <p className="text-muted mt-3 text-sm">Bitte melde dich an, um fortzufahren.</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-xl bg-warn-soft p-3 text-sm text-warn">
            Supabase ist nicht konfiguriert. Trage <code>VITE_SUPABASE_URL</code> und{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code> ein.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 bg-surface rounded-2xl p-6 shadow-card">
          <label className="block">
            <span className="text-sm font-medium">E-Mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="name@backstube.at"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Passwort</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-sm text-critical">{error}</p>}

          <button
            type="submit"
            disabled={busy || !isSupabaseConfigured}
            className="w-full min-h-[48px] rounded-xl bg-crust px-4 font-semibold text-white hover:bg-crust-dark disabled:opacity-50 pressable transition-colors"
          >
            {busy ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>

        {isDemoMode && (
          <div className="mt-4 rounded-xl bg-crust-soft p-4 text-sm">
            <p className="font-semibold text-crust-dark">Demo-Zugänge (Passwort: demo)</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => fill('admin@demo.com')} className="min-h-[36px] rounded-lg border border-crust/30 px-3 font-medium text-crust-dark hover:bg-surface pressable">
                Als Admin
              </button>
              <button onClick={() => fill('staff@demo.com')} className="min-h-[36px] rounded-lg border border-crust/30 px-3 font-medium text-crust-dark hover:bg-surface pressable">
                Als Mitarbeiter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
