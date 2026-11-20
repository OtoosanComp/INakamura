import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useApp, useBlobUrl } from '../state';
import { Field, Sheet, Toggle } from '../components/ui';
import { centsToInput, parseToCents } from '../lib/money';
import { deleteProduct, saveProduct, uid } from '../lib/db';
import { resizeImage } from '../lib/image';
import { MODE_LABEL, type Mode, type Product } from '../lib/types';

export function ProductForm() {
  const { editProduct, openProductForm, mode, settings, products, reload, toast } = useApp();
  const existing = editProduct !== 'new' && editProduct ? editProduct : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [price, setPrice] = useState(existing ? centsToInput(existing.priceCents) : '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [stock, setStock] = useState(existing?.stock === null || !existing ? '' : String(existing.stock));
  const [pMode, setPMode] = useState<Mode>(existing?.mode ?? mode);
  const [active, setActive] = useState(existing?.active ?? true);
  const [photo, setPhoto] = useState<Blob | undefined>(existing?.photo);
  const [touched, setTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const photoUrl = useBlobUrl(photo);

  const cents = parseToCents(price);
  const stockNum = stock.trim() === '' ? null : Number(stock);
  const errors = {
    name: !name.trim() ? 'Escribe el nombre' : null,
    price: cents === null ? 'Escribe un precio válido, por ejemplo 150 o 99.50' : cents <= 0 ? 'El precio debe ser mayor a $0' : null,
    stock: stockNum !== null && (!Number.isInteger(stockNum) || stockNum < 0 || stockNum > 99999) ? 'Escribe un número entero (o déjalo vacío)' : null
  };
  const valid = !errors.name && !errors.price && !errors.stock;
  const categories = [...new Set(products.filter((p) => p.mode === pMode).map((p) => p.category).filter(Boolean))];
  const close = () => openProductForm(null);

  const save = async (another: boolean) => {
    setTouched(true);
    if (!valid) return;
    const now = Date.now();
    const p: Product = {
      id: existing?.id ?? uid(),
      mode: pMode,
      name: name.trim().slice(0, 60),
      priceCents: cents!,
      category: category.trim().slice(0, 30),
      stock: stockNum,
      active,
      photo,
      demo: existing?.demo,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    await saveProduct(p);
    await reload();
    toast(existing ? 'Producto actualizado' : `"${p.name}" agregado`);
    if (another) {
      setName('');
      setPrice('');
      setStock('');
      setPhoto(undefined);
      setTouched(false);
      nameRef.current?.focus();
    } else close();
  };

  const remove = async () => {
    if (!existing || !confirm(`¿Eliminar "${existing.name}"? Las ventas anteriores no cambian.`)) return;
    await deleteProduct(existing.id);
    await reload();
    toast('Producto eliminado');
    close();
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await resizeImage(file));
    } catch {
      toast('No se pudo usar esa imagen', 'error');
    }
  };

  return (
    <Sheet
      title={existing ? 'Editar producto' : 'Nuevo producto'}
      onClose={close}
      footer={
        <div className="row">
          {!existing && (
            <button className="btn secondary" onClick={() => save(true)}>
              Guardar y otro
            </button>
          )}
          <button className="btn primary" onClick={() => save(false)}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="photo-row">
        <button className="photo-pick" onClick={() => fileRef.current?.click()} type="button">
          {photoUrl ? <img src={photoUrl} alt="Foto del producto" /> : <Camera size={28} />}
        </button>
        <div>
          <strong>Foto (opcional)</strong>
          <p className="field-hint">Toca para tomar o elegir una foto.</p>
          {photo && (
            <button className="link-btn" onClick={() => setPhoto(undefined)}>
              Quitar foto
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
      </div>

      <Field label="Nombre" error={touched ? errors.name : null}>
        <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ej. Peluca rosa larga" autoFocus={!existing} />
      </Field>
      <Field label="Precio" error={touched || price ? errors.price : null}>
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="$0.00" />
      </Field>
      <Field label="Categoría (opcional)" hint="Agrupa y filtra: Pelucas, Props, Prints…">
        <input value={category} onChange={(e) => setCategory(e.target.value)} list="cats" maxLength={30} placeholder="Ej. Accesorios" />
        <datalist id="cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Existencias (opcional)" hint="Déjalo vacío si no quieres llevar la cuenta. Se descuentan solas al vender." error={errors.stock}>
        <input value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Sin límite" />
      </Field>
      {settings.enabledModes.length > 1 && (
        <Field label="¿Dónde se vende?">
          <div className="segmented">
            {(['anime', 'adult'] as Mode[]).map((m) => (
              <button type="button" key={m} className={pMode === m ? 'active' : ''} onClick={() => setPMode(m)}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Toggle checked={active} onChange={setActive} label="Visible en la venta" hint="Apágalo para ocultarlo sin borrarlo." />
      {existing && (
        <button className="btn ghost danger" onClick={remove}>
          <Trash2 size={18} /> Eliminar producto
        </button>
      )}
    </Sheet>
  );
}
