/**
 * Página pública del ticket (lo que ve el cliente al escanear el QR).
 * Sin React ni servidor: lee los datos del enlace (#...) y los muestra.
 * Todo el texto se inserta con textContent (nunca innerHTML) para evitar inyección.
 */
import './ticket.css';
import { decodePayload, type TicketPayload } from '../lib/payload';
import { formatMXN, plainAmount } from '../lib/money';
import { formatClabe, formatGroups4 } from '../lib/bankdata';
import { parseLink, whatsappUrl } from '../lib/links';
import { copyText, downloadBlob, formatDateTime, shareFile } from '../lib/share';
import { renderTicketPng } from '../lib/ticketImage';

type Child = Node | string | null | undefined | false;

function h(tag: string, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

const root = document.getElementById('root')!;
let toastTimer = 0;

function toast(msg: string) {
  let t = document.getElementById('toast');
  if (!t) {
    t = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('show'), 1800);
}

function copyButton(value: string, label: string, big = false): HTMLElement {
  const idle = big ? `Copiar ${label === 'CLABE' ? label : label.toLowerCase()}` : 'Copiar';
  const btn = h('button', { class: big ? 'copy big' : 'copy', type: 'button', 'aria-label': `Copiar ${label}` }, idle);
  btn.addEventListener('click', async () => {
    const ok = await copyText(value);
    if (ok) {
      const fem = /^(CLABE|Referencia|Tarjeta)/.test(label);
      const short = label.replace(/\s*\(.*\)$/, '');
      btn.textContent = big ? `✓ ${short} ${fem ? 'copiada' : 'copiado'}` : fem ? '✓ Copiada' : '✓ Copiado';
      btn.classList.add('done');
      toast(`${short} ${fem ? 'copiada' : 'copiado'}`);
      if (navigator.vibrate) navigator.vibrate(15);
      setTimeout(() => {
        btn.textContent = idle;
        btn.classList.remove('done');
      }, 2200);
    } else {
      toast('No se pudo copiar. Mantén presionado el texto para copiarlo.');
    }
  });
  return btn;
}

function field(label: string, display: string, copyValue: string | null, opts: { big?: boolean; mono?: boolean } = {}): HTMLElement {
  return h(
    'div',
    { class: `field${opts.big ? ' big' : ''}` },
    h('div', { class: 'field-text' }, h('span', { class: 'label' }, label), h('span', { class: `value${opts.mono ? ' mono' : ''}` }, display)),
    copyValue !== null ? copyButton(copyValue, label, opts.big) : null
  );
}

function render(p: TicketPayload) {
  document.documentElement.dataset.mode = p.mode;
  document.documentElement.style.setProperty('--accent', p.accent);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.mode === 'adult' ? '#121016' : p.accent);
  document.title = `Ticket ${p.folio} · ${p.seller}`;

  const total = formatMXN(p.totalCents);
  const amount = plainAmount(p.totalCents);

  // ---- Ticket ----
  const lines = p.items
    ? h(
        'ul',
        { class: 'items' },
        ...p.items.map((it) =>
          h(
            'li',
            {},
            h('div', { class: 'item-main' }, h('span', { class: 'item-name' }, it.name), h('span', { class: 'item-sub' }, `${it.qty} × ${formatMXN(it.unitCents)}`)),
            h('span', { class: 'item-total' }, formatMXN(it.qty * it.unitCents))
          )
        )
      )
    : h('p', { class: 'items-hidden' }, `${p.itemCount} artículo${p.itemCount === 1 ? '' : 's'}`);

  const ticket = h(
    'section',
    { class: 'card ticket' },
    h('div', { class: 'ticket-head' }, h('h1', {}, p.seller), h('p', { class: 'muted' }, `Folio ${p.folio} · ${formatDateTime(p.date)}`)),
    lines,
    h('div', { class: 'total' }, h('span', {}, 'Total'), h('strong', {}, total))
  );

  const parts: Child[] = [];
  if (p.demo) parts.push(h('div', { class: 'demo' }, '⚠ DEMOSTRACIÓN — estos datos son de prueba. NO TRANSFIERAS.'));
  parts.push(ticket);

  // ---- Pago ----
  if (p.paidCash) {
    parts.push(h('section', { class: 'card paid' }, h('strong', {}, '✓ Pagado en efectivo'), h('p', {}, 'Guarda este ticket como comprobante de tu compra.')));
  } else if (p.account) {
    const a = p.account;
    const allText = [
      `Banco: ${a.bankName}`,
      `Beneficiario: ${a.beneficiary}`,
      `CLABE: ${a.clabe}`,
      a.card ? `Tarjeta: ${a.card}` : '',
      a.dimoPhone ? `Celular (DiMo): ${a.dimoPhone}` : '',
      `Importe: ${amount}`,
      `Concepto: ${p.concept}`,
      `Referencia: ${p.reference}`
    ]
      .filter(Boolean)
      .join('\n');

    const allBtn = h('button', { class: 'btn outline', type: 'button' }, 'Copiar todos los datos');
    allBtn.addEventListener('click', async () => toast((await copyText(allText)) ? 'Todos los datos copiados' : 'No se pudo copiar'));

    parts.push(
      h(
        'section',
        { class: 'card pay' },
        h('h2', {}, 'Paga por transferencia'),
        h('ol', { class: 'steps' }, h('li', {}, 'Copia la CLABE'), h('li', {}, 'Abre la app de tu banco'), h('li', {}, 'Pega la CLABE y escribe el importe')),
        field('CLABE', formatClabe(a.clabe), a.clabe, { big: true, mono: true }),
        field('Importe', total, amount, { big: true }),
        field('Beneficiario', a.beneficiary, a.beneficiary),
        field('Banco', a.bankName, null),
        field('Concepto', p.concept, p.concept),
        field('Referencia numérica', p.reference, p.reference, { mono: true }),
        a.card ? field('Tarjeta (opcional)', formatGroups4(a.card), a.card, { mono: true }) : null,
        a.accountNumber ? field('Número de cuenta', a.accountNumber, a.accountNumber, { mono: true }) : null,
        a.dimoPhone ? field('Celular DiMo (transferir con número)', a.dimoPhone, a.dimoPhone, { mono: true }) : null,
        allBtn,
        h(
          'p',
          { class: 'warning' },
          'Realiza la transferencia desde tu aplicación bancaria y verifica que el beneficiario y el importe sean correctos. Nunca compartas contraseñas, NIP ni códigos de tu banco.'
        )
      )
    );
  }

  // ---- Acciones ----
  const actions = h('section', { class: 'actions' });
  if (p.whatsapp && !p.paidCash) {
    const msg = `Hola ${p.seller}, ya pagué mi compra con folio ${p.folio} por ${total}. Te envío mi comprobante.`;
    actions.append(h('a', { class: 'btn whatsapp', href: whatsappUrl(p.whatsapp, msg), target: '_blank', rel: 'noopener noreferrer' }, 'Ya pagué · Enviar comprobante por WhatsApp'));
  }
  const save = h('button', { class: 'btn outline', type: 'button' }, 'Guardar ticket (imagen)');
  save.addEventListener('click', async () => {
    try {
      const blob = await renderTicketPng(p);
      const name = `ticket-${p.folio}.png`;
      if (!(await shareFile(blob, name, `Ticket ${p.folio}`))) downloadBlob(blob, name);
    } catch {
      toast('No se pudo crear la imagen. Toma una captura de pantalla.');
    }
  });
  actions.append(save);
  parts.push(actions);

  if (p.thanks) parts.push(h('p', { class: 'thanks' }, p.thanks));

  const links = p.links.map(parseLink).filter((l): l is NonNullable<typeof l> => l !== null);
  if (links.length) {
    parts.push(
      h('nav', { class: 'links' }, ...links.map((l) => h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, `${l.label} · @${l.handle}`)))
    );
  }

  parts.push(
    h(
      'footer',
      {},
      `El dinero va directo a la cuenta de ${p.seller}. Otoo QR POS no procesa pagos ni cobra comisiones. Este ticket no es un comprobante fiscal (CFDI).`
    )
  );

  root.replaceChildren(...(parts.filter(Boolean) as Node[]));
}

function renderError(msg: string) {
  root.replaceChildren(
    h(
      'section',
      { class: 'card error' },
      h('h1', {}, 'No se pudo abrir el ticket'),
      h('p', {}, msg),
      h('p', { class: 'muted' }, 'Pide a la vendedora que te muestre el QR de nuevo y escanéalo con la cámara de tu celular.')
    )
  );
}

function load() {
  const hash = location.hash.slice(1);
  if (!hash) return renderError('El enlace no contiene un ticket.');
  try {
    render(decodePayload(hash));
  } catch (e) {
    renderError((e as Error).message || 'El enlace está incompleto o dañado.');
  }
}

window.addEventListener('hashchange', load);
load();
