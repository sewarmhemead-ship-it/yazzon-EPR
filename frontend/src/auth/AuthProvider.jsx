/**
 * AuthProvider.jsx — سياق المصادقة للواجهة.
 * يدير جلسة Supabase، ويجلب ملف المستخدم (الدور) من الـ backend عبر /auth/me،
 * ويوفّر signIn / signOut. الدور يحدّد ما تعرضه الواجهة (admin مقابل staff).
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

/** يتيح استهلاك سياق المصادقة. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return ctx;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { id, name, email, role } من الـ backend
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  // يجلب ملف المستخدم من الـ backend (يؤكّد وجود صفّ users ويعطي الدور).
  const loadProfile = useCallback(async () => {
    try {
      const { user } = await api.me();
      setProfile(user);
      setProfileError(null);
    } catch (err) {
      setProfile(null);
      setProfileError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    // الجلسة الابتدائية.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // متابعة تغيّرات الجلسة (دخول/خروج).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // عند توفّر جلسة، اجلب الملف؛ وعند غيابها صفّره.
  useEffect(() => {
    if (session) {
      loadProfile();
    } else {
      setProfile(null);
    }
  }, [session, loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = {
    session,
    profile,
    role: profile?.role ?? null,
    isAdmin: profile?.role === 'admin',
    loading,
    profileError,
    isSupabaseConfigured,
    signIn,
    signOut,
    reloadProfile: loadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
