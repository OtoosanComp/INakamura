import { useState } from 'react';
import { useApp } from '../state';
import { Field } from '../components/ui';
import { bankFromClabe, onlyDigits, validateClabe, validatePhone10 } from '../lib/bankdata';
import { saveAccount, saveProduct, uid } from '../lib/db';
import { demoAccount, demoProducts } from '../lib/demo';
import type { Mode } from '../lib/types';

export function Onboarding() {
  const { updateSettings, reload } = useApp();
  const [name, setName] = useState('');
  const [modes, setModes] = useState<Mode[]>(['anime']);
  const [clabe, setClabe] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [touched, setTouched] = useState(false);

  const c = validateClabe(clabe);
  const errors = {
    name: !name.trim() ? 'Escribe tu nombre o el de tu marca' : null,
    modes: modes.length === 0 ? 'Elige al menos uno' : null,
    clabe: c.ok ? null : c.error,
    beneficiary: beneficiary.trim().length < 3 ? 'Escribe el nombre del titular de la cuenta' : null,
    whatsapp: whatsapp && validatePhone10(whatsapp)
  };
  const valid = Object.values(errors).every((e) => !e);

  const toggleMode = (m: Mode) => setModes((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));

  const start = async () => {
    setTouched(true);
    if (!valid) return;
    const accId = uid();
    await saveAccount({
      id: accId,
      alias: 'Principal',
      bankName: bankFromClabe(clabe) ?? 'Banco',
      beneficiary: beneficiary.trim(),
      clabe: onlyDigits(clabe),
      active: true
    });
    await updateSettings((s) => {
      for (const m of ['anime', 'adult'] as Mode[]) {
        s.profiles[m].displayName = name.trim();
        s.profiles[m].accountId = accId;
        if (m === 'anime') s.profiles[m].whatsapp = onlyDigits(whatsapp);
      }
      return { ...s, onboarded: true, enabledModes: modes, currentMode: modes[0] };
    });
    await reload();
  };

  const demo = async () => {
    const acc = demoAccount();
    await saveAccount(acc);
    for (const p of demoProducts()) await saveProduct(p);
    await updateSettings((s) => {
      s.profiles.anime = { ...s.profiles.anime, displayName: 'Demo Cosplay', accountId: acc.id, links: ['ig:otoo.demo'] };
      s.profiles.adult = { ...s.profiles.adult, displayName: 'Demo After Dark', accountId: acc.id, links: ['tg:otoo_demo'] };
      return { ...s, onboarded: true, enabledModes: ['anime', 'adult'], currentMode: 'anime', folioPrefix: 'D' };
    });
    await reload();
  };

  return (
    <div className="onboarding">
      <div className="ob-hero">
        <div className="ob-logo">QR</div>
        <h1>Otoo QR POS</h1>
        <p>Arma la venta, muestra el QR y tu cliente copia tu CLABE con un toque. Sin comisiones: el dinero va directo a tu cuenta.</p>
      </div>

      <Field label="¿Cómo te verán tus clientes?" error={touched ? errors.name : null}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre o marca de cosplay" maxLength={40} />
      </Field>

      <div className="field">
        <span className="field-label">¿Dónde vendes?</span>
        <div className="mode-cards">
          <button type="button" className={`mode-card ${modes.includes('anime') ? 'active' : ''}`} onClick={() => toggleMode('anime')}>
            <span className="mc-emoji">✨</span>
            <strong>Convenciones anime</strong>
            <small>Props, pelucas, prints, accesorios</small>
          </button>
          <button type="button" className={`mode-card dark ${modes.includes('adult') ? 'active' : ''}`} onClick={() => toggleMode('adult')}>
            <span className="mc-emoji">🖤</span>
            <strong>Modo oscuro +18</strong>
            <small>Erocons y contenido para adultos, con ticket discreto</small>
          </button>
        </div>
        {touched && errors.modes && <span className="field-error">{errors.modes}</span>}
      </div>

      <Field label="Tu CLABE (18 dígitos)" error={touched || clabe ? errors.clabe : null} hint={c.ok ? `✓ ${c.bankName ?? 'CLABE válida'}` : 'Donde recibirás las transferencias'}>
        <input value={clabe} onChange={(e) => setClabe(e.target.value)} inputMode="numeric" placeholder="000 000 00000000000 0" autoComplete="off" />
      </Field>
      <Field label="Titular de la cuenta" error={touched ? errors.beneficiary : null} hint="Como aparece en tu banco">
        <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} maxLength={60} />
      </Field>
      <Field label="WhatsApp (opcional)" error={errors.whatsapp} hint="Para que te manden su comprobante con un toque">
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="10 dígitos" />
      </Field>

      <button className="btn primary big" onClick={start}>
        Empezar a vender
      </button>
      <button className="btn ghost" onClick={demo}>
        Solo quiero probar (datos de demostración)
      </button>
      <p className="field-hint center">Tus datos se guardan solo en este teléfono. Puedes cambiar todo después en Ajustes.</p>
    </div>
  );
}
