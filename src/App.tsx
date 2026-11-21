import { useEffect, useState } from 'react';
import { Package, Receipt, Settings as SettingsIcon, ShoppingBag, WifiOff } from 'lucide-react';
import { AppProvider, useApp, useOnline, type Tab } from './state';
import { Toast } from './components/ui';
import { SellScreen } from './screens/SellScreen';
import { SalesScreen } from './screens/SalesScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { Onboarding } from './screens/Onboarding';
import { QrView } from './screens/QrView';
import { SaleDetail } from './screens/SaleDetail';
import { ProductForm } from './screens/ProductForm';
import { MODE_LABEL, type Mode } from './lib/types';

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'vender', label: 'Vender', icon: ShoppingBag },
  { id: 'ventas', label: 'Ventas', icon: Receipt },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'ajustes', label: 'Ajustes', icon: SettingsIcon }
];

function Shell() {
  const app = useApp();
  const { settings, mode, tab, setTab, qrSaleId, detailSaleId, editProduct, sales } = app;
  const online = useOnline();
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    const h = () => setUpdateReady(true);
    window.addEventListener('otoo-update', h);
    return () => window.removeEventListener('otoo-update', h);
  }, []);
  const pending = sales.filter((s) => s.status === 'PENDIENTE').length;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = mode;
    root.style.setProperty('--accent', settings.profiles[mode].accent);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'adult' ? '#0b0a0e' : settings.profiles[mode].accent);
  }, [mode, settings]);

  if (!settings.onboarded) return <Onboarding />;

  return (
    <div className="app">
      <header className="topbar">
        <ModeSwitch />
        {!online && (
          <span className="offline" title="Sin internet">
            <WifiOff size={16} /> Sin internet · todo se guarda
          </span>
        )}
        {updateReady && (
          <button className="update-banner" onClick={() => (window as unknown as { otooUpdate: () => void }).otooUpdate()}>
            Hay una versión nueva · Toca para actualizar
          </button>
        )}
      </header>
      <main className="content">
        {tab === 'vender' && <SellScreen />}
        {tab === 'ventas' && <SalesScreen />}
        {tab === 'productos' && <ProductsScreen />}
        {tab === 'ajustes' && <SettingsScreen />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">
              <t.icon size={24} />
              {t.id === 'ventas' && pending > 0 && <span className="badge">{pending}</span>}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {editProduct && <ProductForm />}
      {detailSaleId && <SaleDetail />}
      {qrSaleId && <QrView />}
      <Toast />
    </div>
  );
}

function ModeSwitch() {
  const { settings, mode, setMode, cart } = useApp();
  const name = settings.profiles[mode].displayName || 'Otoo QR POS';
  if (settings.enabledModes.length < 2) return <h1 className="brand">{name}</h1>;
  const change = async (m: Mode) => {
    if (m === mode) return;
    if (cart.length && !confirm('Cambiar de modo vacía la venta actual. ¿Continuar?')) return;
    await setMode(m);
  };
  return (
    <div className="mode-switch" role="tablist" aria-label="Modo de venta">
      {(['anime', 'adult'] as Mode[]).map((m) => (
        <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'active' : ''} onClick={() => change(m)}>
          {m === 'adult' ? '🖤 ' : '✨ '}
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}
