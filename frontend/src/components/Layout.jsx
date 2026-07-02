/**
 * Layout.jsx — الهيكل المستجيب:
 * موبايل: ترويسة مدمجة + شريط تنقّل سفلي (في متناول الإبهام، أهداف ≥44px، safe-area).
 * شاشات كبيرة: ترويسة بتبويبات علوية. أيقونات SVG مدمجة داخل حاوية بلورية CSS.
 */

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" />
    </svg>
  ),
  fridges: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="2" /><path d="M6 9.5h12" /><path d="M9 6v1.5M9 13v3" />
    </svg>
  ),
  items: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" />
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3.5 2" />
    </svg>
  ),
};

export default function Layout({ profile, tabs, active, onTab, onSignOut, children }) {
  const renderIcon = (tab, isActive) => (
    <span className={`glass-icon ${isActive ? 'glass-icon-active' : ''}`} aria-hidden="true">
      {ICONS[tab.icon]}
    </span>
  );

  return (
    <div className="min-h-full">
      {/* الترويسة */}
      <header className="sticky top-0 z-20 border-b border-line-soft bg-paper/85 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight leading-tight">
              YAZ<span className="text-crust">OO</span>N
            </h1>
            <p className="text-muted text-[10px] font-semibold tracking-widest uppercase leading-none">Lagerverwaltung</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold leading-tight">{profile?.name}</p>
            <button onClick={onSignOut} className="text-xs text-muted hover:text-crust min-h-[24px]">
              Abmelden
            </button>
          </div>
        </div>

        {/* تبويبات الشاشات الكبيرة */}
        <nav className="mx-auto max-w-2xl px-2 hidden sm:flex gap-1" role="tablist" aria-label="Hauptnavigation">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active === tab.key}
              aria-current={active === tab.key ? 'page' : undefined}
              onClick={() => onTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                active === tab.key
                  ? 'border-crust text-crust-dark'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {renderIcon(tab, active === tab.key)}
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* المحتوى — مساحة سفلية للـ bottom-nav على الموبايل */}
      <main className="mx-auto max-w-2xl px-4 py-5 pb-nav sm:pb-8">{children}</main>

      {/* شريط التنقّل السفلي (موبايل فقط) */}
      <nav
        className="glass-dock sm:hidden fixed bottom-0 inset-x-0 z-20 pb-[env(safe-area-inset-bottom)]"
        aria-label="Hauptnavigation"
      >
        <div className="mx-auto max-w-2xl grid grid-cols-5 px-1.5">
          {tabs.map((tab) => {
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTab(tab.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2 min-h-[62px] text-[10px] font-semibold pressable transition-colors ${
                  isActive ? 'text-crust-dark' : 'text-muted'
                }`}
              >
                {renderIcon(tab, isActive)}
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
