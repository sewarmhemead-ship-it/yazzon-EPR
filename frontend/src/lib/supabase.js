/**
 * supabase.js — عميل Supabase للواجهة (المصادقة فقط).
 * تم تعديله لدعم الوضع التجريبي (Demo Mode) بشكل كامل.
 */

import { createClient } from '@supabase/supabase-js';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiUrl = import.meta.env.VITE_API_URL ?? '/api';

export const isSupabaseConfigured = isDemoMode || Boolean(url && anonKey);

if (!isSupabaseConfigured && !isDemoMode) {
  console.warn('Supabase ist nicht konfiguriert — bitte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY setzen.');
}

// إنشاء عميل وهمي للوضع التجريبي يحاكي عمل Supabase Auth
const demoClient = {
  auth: {
    signInWithPassword: async ({ email, password }) => {
      try {
        const res = await fetch(`${apiUrl}/demo/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) return { error: { message: data.error?.message || 'Login failed' } };
        localStorage.setItem('demo_token', data.access_token);
        
        // إعادة تحميل الصفحة لمحاكاة تسجيل الدخول وتحديث الـ AuthProvider
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
    onAuthStateChange: (callback) => {
      // In demo mode, we handle state changes via page reload, so this is just a dummy subscription
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  }
};

export const supabase = isDemoMode
  ? demoClient
  : (isSupabaseConfigured ? createClient(url, anonKey) : null);
