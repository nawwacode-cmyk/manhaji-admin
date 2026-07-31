/* =============================================================================
   components.js — مكوّنات اللوحة المشتركة
   ============================================================================= */
window.C = (function () {
  const { h, fr, ar, icon } = UI;

  // --- ترويسة الصفحة ----------------------------------------------------------
  const pageHead = (title, sub, ...actions) =>
    h('header.topbar',
      h('div.grow', h('h1', title), sub && h('div.sub', sub)),
      ...actions);

  // --- بطاقة ------------------------------------------------------------------
  const card = (title, body, ...actions) =>
    h('div.card',
      title && h('div.card__h', h('h2.grow', title), ...actions),
      body instanceof Node && body.classList?.contains('tbl-wrap') ? body : h('div.card__b', body));

  const kpi = (label, value, note, color) =>
    h('div.kpi',
      h('div.kpi__k', label),
      h('div.kpi__v', color ? { style: `color:${color}` } : null, value),
      note && h('div.kpi__n', note));

  // --- جدول --------------------------------------------------------------------
  /** table(['العنوان',…], rows, row => [خلية,…]) */
  function table(headers, rows, render, emptyText = 'لا توجد بيانات.') {
    const wrap = h('div.tbl-wrap');
    if (!rows.length) {
      wrap.appendChild(h('div.empty-row', emptyText));
      return wrap;
    }
    const t = h('table.tbl',
      h('thead', h('tr', ...headers.map((x) => h('th', x)))),
      h('tbody', ...rows.map((r) => h('tr', ...render(r).map((c) =>
        c instanceof Node && c.tagName === 'TD' ? c : h('td', c))))));
    wrap.appendChild(t);
    return wrap;
  }

  const td = (...kids) => h('td', ...kids);
  const actions = (...btns) => h('td', h('div.actions', ...btns));

  // --- حقول --------------------------------------------------------------------
  function field(label, control, help) {
    return h('div.field', h('label', label), control, help && h('div.help', help));
  }

  const input = (props = {}) => h('input.inp', props);
  const textarea = (props = {}) => h('textarea.inp', props);

  function select(options, value, props = {}) {
    const el = h('select.inp', props);
    options.forEach(([v, label]) => {
      const o = h('option', { value: v }, label);
      if (String(v) === String(value)) o.selected = true;
      el.appendChild(o);
    });
    return el;
  }

  function checkbox(label, checked, onchange) {
    const box = h('input', { type: 'checkbox', style: 'width:18px;height:18px;accent-color:var(--acc)' });
    box.checked = !!checked;
    box.addEventListener('change', () => onchange(box.checked));
    return h('label.row', { style: 'cursor:pointer;font-size:14px;font-weight:600' }, box, label);
  }

  // --- نافذة منبثقة --------------------------------------------------------------
  /**
   * modal({ title, body, wide, actions: [{label, kind, onClick(close)}] })
   * الإغلاق بـ Escape وبالنقر خارجها — سلوك متوقّع لا يحتاج تعليمًا.
   */
  function modal({ title, body, wide, actions: acts = [] }) {
    const scrim = h('div.scrim');
    const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    const box = h('div.modal' + (wide ? '.modal--wide' : ''),
      h('div.modal__h',
        h('h2.grow', title),
        h('button.btn.btn--ghost.btn--sm', { onclick: close }, '✕')),
      h('div.modal__b', body),
      acts.length && h('div.modal__f',
        ...acts.map((a) => h('button.btn.btn--' + (a.kind || 'sec'), {
          onclick: () => a.onClick(close),
        }, a.label))));

    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
    document.addEventListener('keydown', onKey);
    scrim.appendChild(box);
    document.body.appendChild(scrim);
    return close;
  }

  function confirmDialog(title, text, onYes, yesLabel = 'تأكيد') {
    modal({
      title, body: h('div', text),
      actions: [
        { label: 'إلغاء', onClick: (c) => c() },
        { label: yesLabel, kind: 'danger', onClick: (c) => { c(); onYes(); } },
      ],
    });
  }

  // --- تنبيه عائم ----------------------------------------------------------------
  let toastHost;
  function toast(text, kind) {
    if (!toastHost) { toastHost = h('div.toasts'); document.body.appendChild(toastHost); }
    const el = h('div.toast' + (kind === 'err' ? '.toast--err' : ''), text);
    toastHost.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // --- شارة حالة النشر -------------------------------------------------------------
  const pubBadge = (published) => published
    ? h('span.badge.badge--ok', 'منشور')
    : h('span.badge.badge--mute', 'مسوّدة');

  /** تنزيل نص كملف — للتصدير CSV بلا سيرفر */
  function download(filename, text, mime = 'text/csv;charset=utf-8') {
    // BOM يجعل Excel على ويندوز يقرأ العربية صحيحة بدل رموز مشوّهة
    const blob = new Blob(['﻿' + text], { type: mime });
    const a = h('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  return { pageHead, card, kpi, table, td, actions, field, input, textarea, select,
           checkbox, modal, confirmDialog, toast, pubBadge, download };
})();
