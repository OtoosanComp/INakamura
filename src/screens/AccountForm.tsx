import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Field, Sheet, Toggle } from '../components/ui';
import { bankFromClabe, onlyDigits, validateAccountNumber, validateCard, validateClabe, validatePhone10 } from '../lib/bankdata';
import type { BankAccount } from '../lib/types';
import { deleteAccount, saveAccount, uid } from '../lib/db';
import { useApp } from '../state';

export function AccountForm({ account, onClose }: { account: BankAccount | null; onClose: () => void }) {
  const { reload, toast } = useApp();
  const [v, setV] = useState({
    alias: account?.alias ?? '',
    clabe: account?.clabe ?? '',
    bankName: account?.bankName ?? '',
    beneficiary: account?.beneficiary ?? '',
    card: account?.card ?? '',
    accountNumber: account?.accountNumber ?? '',
    dimoPhone: account?.dimoPhone ?? '',
    active: account?.active ?? true
  });
  const [touched, setTouched] = useState(false);
  const set = (k: keyof typeof v) => (val: string | boolean) => setV((o) => ({ ...o, [k]: val }));

  const clabe = validateClabe(v.clabe);
  const errors = {
    clabe: clabe.ok ? null : clabe.error,
    beneficiary: v.beneficiary.trim().length < 3 ? 'Escribe el nombre del titular tal como aparece en el banco' : null,
    bankName: !v.bankName.trim() ? 'Escribe el banco' : null,
    card: v.card ? validateCard(v.card) : null,
    accountNumber: v.accountNumber ? validateAccountNumber(v.accountNumber) : null,
    dimoPhone: v.dimoPhone ? validatePhone10(v.dimoPhone) : null
  };
  const valid = Object.values(errors).every((e) => !e);

  const onClabe = (val: string) => {
    const detected = bankFromClabe(val);
    setV((o) => ({ ...o, clabe: val, bankName: detected && (!o.bankName || o.bankName === bankFromClabe(o.clabe)) ? detected : o.bankName }));
  };

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    await saveAccount({
      id: account?.id ?? uid(),
      alias: v.alias.trim() || v.bankName.trim(),
      bankName: v.bankName.trim(),
      beneficiary: v.beneficiary.trim(),
      clabe: onlyDigits(v.clabe),
      card: onlyDigits(v.card) || undefined,
      accountNumber: onlyDigits(v.accountNumber) || undefined,
      dimoPhone: onlyDigits(v.dimoPhone) || undefined,
      active: v.active,
      demo: account?.demo
    });
    await reload();
    toast('Cuenta guardada');
    onClose();
  };

  const remove = async () => {
    if (!account || !confirm('¿Eliminar esta cuenta? Las ventas anteriores conservan sus datos.')) return;
    await deleteAccount(account.id);
    await reload();
    onClose();
  };

  const show = (k: keyof typeof errors) => (touched || (v[k as keyof typeof v] as string)?.length > 0 ? errors[k] : null);

  return (
    <Sheet
      title={account ? 'Editar cuenta' : 'Nueva cuenta bancaria'}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={save}>
          Guardar cuenta
        </button>
      }
    >
      <Field label="CLABE interbancaria (18 dígitos)" error={show('clabe')} hint={clabe.ok ? `✓ CLABE válida${clabe.bankName ? ` · ${clabe.bankName}` : ''}` : undefined}>
        <input value={v.clabe} onChange={(e) => onClabe(e.target.value)} inputMode="numeric" placeholder="000 000 00000000000 0" autoComplete="off" />
      </Field>
      <Field label="Banco" error={touched ? errors.bankName : null} hint="Se llena solo con la CLABE; puedes corregirlo.">
        <input value={v.bankName} onChange={(e) => set('bankName')(e.target.value)} maxLength={40} />
      </Field>
      <Field label="Beneficiario (titular)" error={show('beneficiary')} hint="Tal cual lo muestra el banco, para que el cliente lo verifique.">
        <input value={v.beneficiary} onChange={(e) => set('beneficiary')(e.target.value)} maxLength={60} autoComplete="name" />
      </Field>
      <Field label="Alias (opcional)" hint="Solo lo ves tú. Ej. Cuenta convenciones">
        <input value={v.alias} onChange={(e) => set('alias')(e.target.value)} maxLength={30} />
      </Field>
      <details className="more">
        <summary>Datos opcionales (tarjeta, cuenta, celular DiMo)</summary>
        <Field label="Número de tarjeta de débito" error={errors.card}>
          <input value={v.card} onChange={(e) => set('card')(e.target.value)} inputMode="numeric" autoComplete="off" />
        </Field>
        <Field label="Número de cuenta" error={errors.accountNumber}>
          <input value={v.accountNumber} onChange={(e) => set('accountNumber')(e.target.value)} inputMode="numeric" autoComplete="off" />
        </Field>
        <Field label="Celular para DiMo" error={errors.dimoPhone} hint="Si tu banco tiene DiMo, el cliente puede transferirte solo con tu número.">
          <input value={v.dimoPhone} onChange={(e) => set('dimoPhone')(e.target.value)} inputMode="tel" autoComplete="off" />
        </Field>
      </details>
      <Toggle checked={v.active} onChange={set('active')} label="Cuenta activa" />
      <p className="field-hint">🔒 Solo se guarda en este teléfono. Nunca pongas contraseñas, NIP ni códigos de seguridad.</p>
      {account && (
        <button className="btn ghost danger" onClick={remove}>
          <Trash2 size={18} /> Eliminar cuenta
        </button>
      )}
    </Sheet>
  );
}
