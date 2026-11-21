import { useMemo, useState } from 'react';
import { PackagePlus, Plus, Search } from 'lucide-react';
import { useApp } from '../state';
import { Empty, ProductThumb } from '../components/ui';
import { formatMXN } from '../lib/money';
import { saveProduct } from '../lib/db';
import { MODE_LABEL, type Mode } from '../lib/types';

export function ProductsScreen() {
  const { products, mode, settings, openProductForm, reload } = useApp();
  const [viewMode, setViewMode] = useState<Mode>(mode);
  const [q, setQ] = useState('');
  const list = useMemo(
    () => products.filter((p) => p.mode === viewMode && (!q || `${p.name} ${p.category}`.toLowerCase().includes(q.toLowerCase()))),
    [products, viewMode, q]
  );
  const grouped = useMemo(() => {
    const m = new Map<string, typeof list>();
    for (const p of list) {
      const k = p.category || 'Sin categoría';
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [list]);

  return (
    <div className="products">
      <button className="btn primary big" onClick={() => openProductForm('new')}>
        <Plus size={22} /> Agregar producto
      </button>
      {settings.enabledModes.length > 1 && (
        <div className="segmented">
          {(['anime', 'adult'] as Mode[]).map((m) => (
            <button key={m} className={viewMode === m ? 'active' : ''} onClick={() => setViewMode(m)}>
              {MODE_LABEL[m]} ({products.filter((p) => p.mode === m).length})
            </button>
          ))}
        </div>
      )}
      {products.some((p) => p.mode === viewMode) && (
        <div className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" inputMode="search" />
        </div>
      )}
      {list.length === 0 ? (
        <Empty icon={<PackagePlus size={40} />} title={q ? 'Sin resultados' : 'Tu catálogo está vacío'} text={q ? undefined : 'Agrega tus productos con nombre y precio. La foto es opcional.'} />
      ) : (
        grouped.map(([cat, items]) => (
          <section key={cat}>
            <h3 className="section-title">{cat}</h3>
            <ul className="product-list">
              {items.map((p) => (
                <li key={p.id} className={p.active ? '' : 'inactive'}>
                  <button className="product-row" onClick={() => openProductForm(p)}>
                    <ProductThumb product={p} size={48} />
                    <span className="pr-info">
                      <strong>{p.name}</strong>
                      <span className="muted">
                        {p.stock === null ? 'Sin control de existencias' : p.stock <= 0 ? 'Agotado' : `${p.stock} en existencia`}
                        {!p.active && ' · Oculto'}
                        {p.demo && ' · DEMO'}
                      </span>
                    </span>
                    <span className="pr-price">{formatMXN(p.priceCents)}</span>
                  </button>
                  <input
                    type="checkbox"
                    className="switch"
                    checked={p.active}
                    aria-label={p.active ? 'Ocultar de la venta' : 'Mostrar en la venta'}
                    onChange={async (e) => {
                      await saveProduct({ ...p, active: e.target.checked });
                      await reload();
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
