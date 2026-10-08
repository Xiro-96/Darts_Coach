import { BarChart3, Crosshair, Dumbbell, Home, User } from 'lucide-react';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useApp } from './data/store';
import { cx } from './ui/components/ui';
import { navigate, useRoute } from './ui/router';
import { Dashboard } from './ui/screens/Dashboard';
import { Onboarding } from './ui/screens/Onboarding';
import { HistoryScreen, ProfileScreen } from './ui/screens/Profile';
import { RoutineScreen, TechniqueHome, TechniqueTopicScreen } from './ui/screens/Technique';
import { Train } from './ui/screens/Train';
import { SessionRunner } from './ui/session/SessionRunner';
import { SessionSummary } from './ui/session/SessionSummary';

// Selten genutzte bzw. große Bereiche (Diagramme, Kamera) werden erst bei Bedarf geladen
const Stats = lazy(() => import('./ui/screens/Stats').then((m) => ({ default: m.Stats })));
const DrillDetail = lazy(() => import('./ui/screens/DrillDetail').then((m) => ({ default: m.DrillDetail })));
const VideoAnalysis = lazy(() => import('./ui/screens/VideoAnalysis').then((m) => ({ default: m.VideoAnalysis })));
const CheckoutCalc = lazy(() => import('./ui/screens/CheckoutCalc').then((m) => ({ default: m.CheckoutCalc })));

function Loading() {
  return (
    <div className="grid min-h-[50dvh] place-items-center" aria-busy="true">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-surface-3 border-t-accent" />
    </div>
  );
}

const NAV = [
  { path: '/', label: 'Dashboard', icon: Home, match: (p: string) => p === '/' },
  { path: '/train', label: 'Trainieren', icon: Dumbbell, match: (p: string) => p.startsWith('/train') || p.startsWith('/checkout') },
  { path: '/technique', label: 'Technik', icon: Crosshair, match: (p: string) => p.startsWith('/technique') },
  { path: '/stats', label: 'Statistik', icon: BarChart3, match: (p: string) => p.startsWith('/stats') },
  { path: '/profile', label: 'Profil', icon: User, match: (p: string) => p.startsWith('/profile') },
];

export default function App() {
  const ready = useApp((s) => s.ready);
  const loadError = useApp((s) => s.loadError);
  const profile = useApp((s) => s.profile);
  const init = useApp((s) => s.init);
  const route = useRoute();

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <div className="flex flex-col items-center gap-3 text-ink-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-3 border-t-accent" />
          <span className="text-sm">Lade deine Daten …</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <h1 className="text-xl font-bold">Speicher nicht verfügbar</h1>
        <p className="mt-2 text-ink-2">Der lokale Speicher deines Browsers konnte nicht geöffnet werden ({loadError}). Im privaten Modus mancher Browser ist er deaktiviert. Bitte öffne die App in einem normalen Fenster.</p>
      </div>
    );
  }

  if (!profile) return <Onboarding />;

  const [section, sub, third] = route.parts;
  if (section === 'session') return <SessionRunner />;

  let content: ReactNode;
  switch (section) {
    case undefined:
      content = <Dashboard />;
      break;
    case 'train':
      content = sub === 'drill' && third ? <DrillDetail key={third} id={third} /> : <Train />;
      break;
    case 'checkout':
      content = <CheckoutCalc />;
      break;
    case 'technique':
      content = !sub ? <TechniqueHome /> : sub === 'routine' ? <RoutineScreen /> : sub === 'video' ? <VideoAnalysis /> : <TechniqueTopicScreen key={sub} id={sub} />;
      break;
    case 'stats':
      content = <Stats />;
      break;
    case 'profile':
      content = sub === 'history' ? <HistoryScreen /> : <ProfileScreen />;
      break;
    case 'summary':
      content = <SessionSummary id={sub ?? ''} />;
      break;
    default:
      content = <Dashboard />;
  }

  return (
    <div className="min-h-dvh md:pl-60">
      <SideNav path={route.path} />
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-[max(env(safe-area-inset-top),0.75rem)] md:px-8 md:pb-12">
        <Suspense fallback={<Loading />}>{content}</Suspense>
      </main>
      <BottomNav path={route.path} />
      <Toast />
    </div>
  );
}

function BottomNav({ path }: { path: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-lg md:hidden" aria-label="Hauptnavigation">
      <div className="mx-auto flex max-w-lg justify-around px-2 pt-1.5 safe-bottom">
        {NAV.map((n) => {
          const on = n.match(path);
          const Icon = n.icon;
          return (
            <button key={n.path} onClick={() => navigate(n.path)} aria-current={on ? 'page' : undefined} className={cx('flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold', on ? 'text-accent' : 'text-ink-3')}>
              <Icon size={22} strokeWidth={on ? 2.4 : 2} />
              {n.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function SideNav({ path }: { path: string }) {
  return (
    <nav className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface-1 px-4 py-6 md:flex" aria-label="Hauptnavigation">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-[#05170d]">
          <Crosshair size={22} />
        </div>
        <div>
          <div className="num text-xl tracking-wide">DARTS COACH</div>
          <div className="text-[11px] text-ink-3">Train smarter. Throw better.</div>
        </div>
      </div>
      {NAV.map((n) => {
        const on = n.match(path);
        const Icon = n.icon;
        return (
          <button key={n.path} onClick={() => navigate(n.path)} aria-current={on ? 'page' : undefined} className={cx('mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', on ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2')}>
            <Icon size={20} />
            {n.label}
          </button>
        );
      })}
    </nav>
  );
}

function Toast() {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8" role="status" aria-live="polite">
      <div
        key={toast.id}
        className={cx(
          'animate-fade-up rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl',
          toast.tone === 'good' && 'border-accent/40 bg-[#0f2a1d] text-accent',
          toast.tone === 'bad' && 'border-bad/40 bg-[#2a1214] text-bad',
          toast.tone === 'info' && 'border-line bg-surface-3 text-ink-1',
        )}
      >
        {toast.text}
      </div>
    </div>
  );
}
