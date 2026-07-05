/**
 * supabase.js — Supabase client for the frontend (authentication only).
 * supabase-js is allowed here; the CLAUDE.md ban applies to backend data
 * access. In demo mode a minimal stand-in client talks to the local
 * /api/demo/login endpoint instead of Supabase.
 */

import { createClient } from '@supabase/supabase-js';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiUrl = import.meta.env.VITE_API_URL ?? '/api';

export const isSupabaseConfigured = isDemoMode || Boolean(url && anonKey);

if (!isSupabaseConfigured && !isDemoMode) {
  console.warn('Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Demo stand-in mimicking the subset of supabase.auth the app uses.
// State changes are handled via a full page reload, keeping it trivial.
const demoClient = {
  auth: {
    signInWithPassword: async ({ email, password }) => {
      try {
        const res = await fetch(`${apiUrl}/demo/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) return { error: { message: data.error?.message || 'Login fehlgeschlagen' } };
        localStorage.setItem('demo_token', data.access_token);

        // Reload so AuthProvider picks up the new session state.
        setTimeout(() => window.location.reload(), 100);

        return { data: { session: { access_token: data.access_token } }, error: null };
      } catch (e) {
        return { error: { message: e.message } };
      }
    },
    signOut: async () => {
      localStorage.removeItem('demo_token');
      window.location.reload();
    },
    getSession: async () => {
      const token = localStorage.getItem('demo_token');
      return { data: { session: token ? { access_token: token } : null } };
    },
    onAuthStateChange: () => {
      // Demo mode signals state changes via page reload; no live subscription.
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  },
};

export const supabase = isDemoMode
  ? demoClient
  : (isSupabaseConfigured ? createClient(url, anonKey) : null);
