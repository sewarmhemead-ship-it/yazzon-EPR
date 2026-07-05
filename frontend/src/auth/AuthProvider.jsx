/**
 * AuthProvider.jsx — authentication context for the frontend.
 * Manages the Supabase session, loads the user profile (role) from the
 * backend via /auth/me, and exposes signIn/signOut. The role drives what the
 * UI shows (admin vs staff).
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

/** Access hook for the auth context. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { id, name, email, role } from the backend
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  // Loads the profile from the backend (confirms the users row and role).
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
    // Initial session.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // Track session changes (sign-in/sign-out).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load the profile whenever a session appears; clear it when it goes away.
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
