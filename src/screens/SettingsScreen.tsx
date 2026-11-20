import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Download, Landmark, Plus, Smartphone, Upload } from 'lucide-react';
import { useApp } from '../state';
import { Field, Toggle } from '../components/ui';
import { AccountForm } from './AccountForm';
import { ACCENTS } from '../lib/defaults';
import { CONCEPT_TEXT_MAX, NAME_MAX, THANKS_MAX, buildConcept, buildFolio, sanitizeFolioPrefix } from '../lib/concept';
import { LINK_TYPES, MAX_LINKS, sanitizeHandle } from '../lib/links';
import { validatePhone10, formatClabe } from '../lib/bankdata';
import { exportBackup, importBackup, removeDemoData, saveAccount, saveProduct, wipeAll } from '../lib/db';
import { demoAccount, demoProducts } from '../lib/demo';
import { downloadBlob } from '../lib/share';
import { isPublicOrigin } from '../lib/payload';
import { MODE_LABEL, type BankAccount, type LinkType, type Mode, type ModeProfile } from '../lib/types';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

export function SettingsScreen() {
  const { settings, accounts, updateSettings, reload, toast, products, sales } = useApp();
  const [editAccount, setEditAccount] = useState<BankAccount | 'new' | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasDemo = products.some((p) => p.demo) || accounts.some((a) => a.demo) || sales.some((s) => s.demo);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const toggleMode = async (m: Mode, on: boolean) => {
    const next = on ? [...new Set([...settings.enabledModes, m])] : settings.enabledModes.filter((x) => x !== m);
    if (next.length === 0) return toast('Debe quedar al menos un modo activo', 'error');
    await updateSettings((s) => ({ ...s, enabledModes: (['anime', 'adult'] as Mode[]).filter((x) => next.includes(x)) }));
  };

  const doExport = async () => {
    const json = await exportBackup();
    const d = new Date();
    downloadBlob(new Blob([json], { type: 'application/json' }), `otoo-respaldo-${d.toISOString().slice(0, 10)}.json`);
    toast('Respaldo descargado');
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    if (!confirm('Esto REEMPLAZA todos los datos de este teléfono con los del respaldo. ¿Continuar?')) return;
    try {
      await importBackup(await file.text());
      await reload();
      toast('Respaldo cargado');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const loadDemo = async () => {
    const acc = demoAccount();
    await saveAccount(acc);
    for (const p of demoProducts()) await saveProduct(p);
    await reload();
    toast('Datos de demostración cargados (marcados como DEMO)');
  };

  return (
    <div className="settings">
      {install && (
        <button
          className="btn primary"
          onClick={async () => {
            await install.prompt();
            setInstall(null);
          }}
        >
          <Smartphone size={20} /> Instalar app en este teléfono
        </button>
      )}

      <section className="card">
        <h3>Modos de venta</h3>
        <Toggle checked={settings.enabledModes.includes('anime')} onChange={(v) => toggleMode('anime', v)} label="✨ Convenciones anime" />
        <Toggle
          checked={settings.enabledModes.includes('adult')}
          onChange={(v) => toggleMode('adult', v)}
          label="🖤 Modo oscuro +18"
          hint="Catálogo aparte, tema oscuro y ticket discreto para erocons."
        />
      </section>

      {settings.enabledModes.map((m) => (
        <ProfileEditor key={m} mode={m} />
      ))}

      <section className="card">
        <h3>
          <Landmark size={18} /> Cuentas bancarias
        </h3>
        <ul className="account-list">
          {accounts.map((a) => (
            <li key={a.id}>
              <button onClick={() => setEditAccount(a)}>
                <span>
                  <strong>{a.alias || a.bankName}</strong>
                  {a.demo && <span className="mini danger">DEMO</span>}
                  {!a.active && <span className="mini">Inactiva</span>}
                  <span className="muted block">
                    {a.bankName} · {formatClabe(a.clabe)}
                  </span>
                </span>
                <ChevronRight size={20} />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn secondary" onClick={() => setEditAccount('new')}>
          <Plus size={18} /> Agregar cuenta
        </button>
      </section>

      <section className="card">
        <h3>Folios</h3>
        <Field label="Prefijo del folio" hint={`Tu próxima venta será ${buildFolio(settings.folioPrefix, settings.nextSeq)}. Usa letras distintas en cada teléfono para que no se repitan.`}>
          <input
            defaultValue={settings.folioPrefix}
            maxLength={4}
            onBlur={(e) => updateSettings((s) => ({ ...s, folioPrefix: sanitizeFolioPrefix(e.target.value) }))}
            style={{ textTransform: 'uppercase' }}
          />
        </Field>
      </section>

      <section className="card">
        <h3>Respaldo y cambio de teléfono</h3>
        <p className="field-hint">Tus datos viven solo en este teléfono. Descarga un respaldo seguido (después de cada evento) y cárgalo en otro teléfono para pasar todo.</p>
        <div className="row">
          <button className="btn secondary" onClick={doExport}>
            <Download size={18} /> Descargar
          </button>
          <button className="btn secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> Cargar
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
        <p className="field-hint">⚠ El respaldo contiene tus datos bancarios y ventas: guárdalo en un lugar privado.</p>
      </section>

      <section className="card">
        <h3>Demostración</h3>
        <p className="field-hint">Productos de cosplay ficticios y una cuenta falsa. Todo queda marcado como DEMO y los tickets dicen “NO TRANSFERIR”.</p>
        {hasDemo ? (
          <button
            className="btn secondary"
            onClick={async () => {
              if (!confirm('¿Borrar todos los datos de demostración (productos, cuenta y ventas DEMO)?')) return;
              await removeDemoData();
              await reload();
              toast('Datos de demostración borrados');
            }}
          >
            Borrar datos de demostración
          </button>
        ) : (
          <button className="btn secondary" onClick={loadDemo}>
            Cargar datos de demostración
          </button>
        )}
      </section>

      <section className="card">
        <h3>Acerca de</h3>
        <p className="field-hint">
          Otoo QR POS 0.1 · Los QR apuntan a: <strong>{location.host || 'archivo local'}</strong>{' '}
          {isPublicOrigin(location.href) ? '✓ público' : '⚠ no público (solo para pruebas)'}
        </p>
        <p className="field-hint">Otoo QR POS no procesa pagos ni cobra comisiones. El ticket no es un comprobante fiscal (CFDI).</p>
        <button
          className="btn ghost danger small"
          onClick={async () => {
            if (!confirm('¿Borrar TODOS los datos de este teléfono? Descarga un respaldo antes.')) return;
            if (!confirm('Última confirmación: se borrarán productos, cuentas y ventas.')) return;
            await wipeAll();
            await reload();
          }}
        >
          Borrar todos los datos
        </button>
      </section>

      {editAccount && <AccountForm account={editAccount === 'new' ? null : editAccount} onClose={() => setEditAccount(null)} />}
    </div>
  );
}

function ProfileEditor({ mode }: { mode: Mode }) {
  const { settings, accounts, updateSettings, toast } = useApp();
  const [p, setP] = useState<ModeProfile>(settings.profiles[mode]);
  const [open, setOpen] = useState(!settings.profiles[mode].displayName);
  const [linkType, setLinkType] = useState<LinkType>(mode === 'adult' ? 'tg' : 'ig');
  const [handle, setHandle] = useState('');
  const set = <K extends keyof ModeProfile>(k: K, v: ModeProfile[K]) => setP((o) => ({ ...o, [k]: v }));
  const dirty = JSON.stringify(p) !== JSON.stringify(settings.profiles[mode]);
  const waError = p.whatsapp ? validatePhone10(p.whatsapp) : null;

  const save = async () => {
    if (waError) return toast(waError, 'error');
    await updateSettings((s) => ({ ...s, profiles: { ...s.profiles, [mode]: { ...p, whatsapp: p.whatsapp.replace(/\D/g, '') } } }));
    toast(`Perfil de ${MODE_LABEL[mode]} guardado`);
  };

  const addLink = () => {
    const h = sanitizeHandle(handle);
    if (!h || p.links.length >= MAX_LINKS) return;
    set('links', [...p.links, `${linkType}:${h}`]);
    setHandle('');
  };

  return (
    <section className={`card profile ${mode}`}>
      <button className="card-toggle" onClick={() => setOpen(!open)}>
        <h3>
          {mode === 'adult' ? '🖤' : '✨'} Perfil · {MODE_LABEL[mode]}
        </h3>
        <ChevronRight size={20} className={open ? 'rot' : ''} />
      </button>
      {open && (
        <>
          <Field label="Nombre que ve el cliente" counter={`${p.displayName.length}/${NAME_MAX}`}>
            <input value={p.displayName} maxLength={NAME_MAX} onChange={(e) => set('displayName', e.target.value)} placeholder={mode === 'adult' ? 'Puedes usar un alias' : 'Tu nombre de cosplay'} />
          </Field>
          <Field label="Color">
            <div className="swatches">
              {ACCENTS.map((c) => (
                <button key={c} type="button" className={`swatch ${p.accent === c ? 'active' : ''}`} style={{ background: c }} onClick={() => set('accent', c)} aria-label={`Color ${c}`} />
              ))}
            </div>
          </Field>
          <Field
            label="Concepto de la transferencia"
            counter={`${p.conceptText.length}/${CONCEPT_TEXT_MAX}`}
            hint={`Sale en el estado de cuenta del cliente. Ejemplo: “${buildConcept(p.conceptText, buildFolio(settings.folioPrefix, settings.nextSeq), p.includeFolioInConcept)}”`}
          >
            <input value={p.conceptText} maxLength={CONCEPT_TEXT_MAX} onChange={(e) => set('conceptText', e.target.value)} />
          </Field>
          <Toggle
            checked={p.includeFolioInConcept}
            onChange={(v) => set('includeFolioInConcept', v)}
            label="Agregar folio al concepto"
            hint="Recomendado: así identificas cada pago en tu banco. El folio no revela qué compró."
          />
          <Toggle
            checked={p.showItems}
            onChange={(v) => set('showItems', v)}
            label="Mostrar artículos en el ticket del cliente"
            hint={mode === 'adult' ? 'Apágalo para máximo anonimato: el cliente solo verá “3 artículos” y el total.' : 'El cliente ve qué compró y cuánto costó cada cosa.'}
          />
          <Field label="Mensaje de agradecimiento" counter={`${p.thanks.length}/${THANKS_MAX}`}>
            <textarea value={p.thanks} maxLength={THANKS_MAX} rows={2} onChange={(e) => set('thanks', e.target.value)} />
          </Field>
          <Field label="WhatsApp para comprobantes (opcional)" error={waError} hint="El cliente te manda su comprobante con un toque.">
            <input value={p.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} inputMode="tel" placeholder="10 dígitos" />
          </Field>
          <Field label="Cuenta que recibe los pagos">
            <select value={p.accountId ?? ''} onChange={(e) => set('accountId', e.target.value || null)}>
              <option value="">La primera activa</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.alias || a.bankName} ••{a.clabe.slice(-4)}
                  {a.demo ? ' (DEMO)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <div className="field">
            <span className="field-label">
              Redes en el ticket <span className="counter">{p.links.length}/{MAX_LINKS}</span>
            </span>
            <ul className="links-edit">
              {p.links.map((l) => (
                <li key={l}>
                  <span>
                    {LINK_TYPES[l.split(':')[0] as LinkType]?.label} · @{l.split(':')[1]}
                  </span>
                  <button className="link-btn danger" onClick={() => set('links', p.links.filter((x) => x !== l))}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
            {p.links.length < MAX_LINKS && (
              <div className="link-add">
                <select value={linkType} onChange={(e) => setLinkType(e.target.value as LinkType)}>
                  {(Object.keys(LINK_TYPES) as LinkType[]).map((t) => (
                    <option key={t} value={t}>
                      {LINK_TYPES[t].label}
                    </option>
                  ))}
                </select>
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="usuario" onKeyDown={(e) => e.key === 'Enter' && addLink()} />
                <button className="btn secondary small" onClick={addLink}>
                  Agregar
                </button>
              </div>
            )}
          </div>
          <button className="btn primary" disabled={!dirty} onClick={save}>
            {dirty ? 'Guardar perfil' : 'Guardado ✓'}
          </button>
        </>
      )}
    </section>
  );
}
