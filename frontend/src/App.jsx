/**
 * App.jsx — root component: auth gate, navigation, and toast notifications.
 * Tabs: Übersicht (morning overview), Kühlung (fridges), Bestand, Warnungen,
 * Verlauf (movement history).
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from './auth/AuthProvider.jsx';
import Login from './components/Login.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './components/Dashboard.jsx';
import FridgesView from './components/FridgesView.jsx';
import ItemsView from './components/ItemsView.jsx';
import AlertsView from './components/AlertsView.jsx';
import HistoryView from './components/HistoryView.jsx';

const TABS = [
  { key: 'home', label: 'Übersicht', icon: 'home' },
  { key: 'fridges', label: 'Kühlung', icon: 'fridges' },
  { key: 'items', label: 'Bestand', icon: 'items' },
  { key: 'alerts', label: 'Warnungen', icon: 'alerts' },
  { key: 'history', label: 'Verlauf', icon: 'history' },
];

const TOAST_DURATION_MS = 3000;

export default function App() {
  const { loading, session, profile, profileError, signOut } = useAuth();
  const [active, setActive] = useState('home');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, kind = 'success') => {
    setToast({ message, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  if (loading) {
    return <div className="min-h-full grid place-items-center text-muted">Wird geladen …</div>;
  }

  if (!session) {
    return <Login />;
  }

  // Valid session but no matching users row in the backend: access denied.
  if (session && !profile) {
    return (
      <div className="min-h-full grid place-items-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-bold">Kein Zugriff</h1>
          <p className="text-muted mt-2 text-sm">
            {profileError ?? 'Dein Konto ist noch nicht freigeschaltet. Bitte an einen Administrator wenden.'}
          </p>
          <button
            onClick={signOut}
            className="mt-4 min-h-[44px] rounded-lg border border-line px-4 font-medium hover:bg-surface pressable"
          >
            Abmelden
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout profile={profile} tabs={TABS} active={active} onTab={setActive} onSignOut={signOut}>
        {active === 'home' && <Dashboard goTo={setActive} />}
        {active === 'fridges' && <FridgesView notify={notify} />}
        {active === 'items' && <ItemsView notify={notify} />}
        {active === 'alerts' && <AlertsView notify={notify} />}
        {active === 'history' && <HistoryView />}
      </Layout>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] sm:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-float anim-sheet ${
            toast.kind === 'error' ? 'bg-critical' : 'bg-ink'
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
