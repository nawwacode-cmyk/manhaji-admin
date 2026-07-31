/* =============================================================================
   ui.js — أدوات بناء العناصر
   بديل خفيف عن إطار عمل. القاعدة: نبني عُقد DOM حقيقية، ولا نستخدم innerHTML
   لإعادة الرسم — لأن ذلك يمسح تركيز المؤشر وما كتبه الطالب في حقول التمارين.
   ============================================================================= */
window.UI = (function () {

  /**
   * h('div.card', { onclick }, child, child)
   * الوسم يقبل اختصار الأصناف بنقطة: 'button.btn.btn--primary'
   */
  function h(spec, props, ...children) {
    const [tag, ...classes] = String(spec).split('.');
    const el = document.createElement(tag || 'div');
    if (classes.length) el.className = classes.join(' ');

    if (props && props.constructor === Object) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class')      el.className += (el.className ? ' ' : '') + v;
        else if (k === 'style') el.setAttribute('style', v);
        else if (k === 'html')  el.innerHTML = v;      // محتوى ثابت من بياناتنا فقط
        else if (k === 'text')  el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true)    el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    } else if (props !== undefined && props !== null) {
      children.unshift(props);
    }

    add(el, children);
    return el;
  }

  function add(el, kids) {
    for (const c of kids.flat(4)) {
      if (c === null || c === undefined || c === false || c === '') continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }

  /** نص فرنسي معزول اتجاهيًا داخل جملة عربية */
  const fr = (t) => h('span.fr', { text: t });

  /** أرقام عربية شرقية — للعدّ في الواجهة العربية */
  const AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  const ar = (n) => String(n).replace(/[0-9]/g, (d) => AR[+d]);

  function svg(paths, size = 22, opts = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('width', size); el.setAttribute('height', size);
    el.setAttribute('fill', opts.fill || 'none');
    el.setAttribute('stroke', opts.stroke || 'currentColor');
    el.setAttribute('stroke-width', opts.width || 2);
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.innerHTML = paths;
    return el;
  }

  /**
   * مجموعة الأيقونات.
   * قاعدة: **الأيقونة تصف معناها لا شكل الزر.** أيقونة «صح» للرئيسية أو سهم
   * للدروس تجبر المستخدم على قراءة النص في كل مرة، فتفقد الأيقونة فائدتها.
   * كلها 24×24 بخطوط لا بمساحات مصمتة، لتتبع لون النص في الوضعين.
   */
  const icon = {
    // تنقّل
    back:     (s) => svg('<path d="m9 18 6-6-6-6"/>', s),          // RTL: يشير يمينًا
    chevron:  (s) => svg('<path d="m6 9 6 6 6-6"/>', s),

    // أقسام التطبيق
    home:     (s) => svg('<path d="M3 10.2 12 3l9 7.2"/>'
                       + '<path d="M5.6 9.4V20a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V9.4"/>'
                       + '<path d="M9.6 21v-5.6h4.8V21"/>', s),
    book:     (s) => svg('<path d="M12 7.4C10.5 5.9 8.6 5.1 5.6 5.1H3v13h2.6c3 0 4.9.8 6.4 2.3"/>'
                       + '<path d="M12 7.4c1.5-1.5 3.4-2.3 6.4-2.3H21v13h-2.6c-3 0-4.9.8-6.4 2.3"/>'
                       + '<path d="M12 7.4v13"/>', s),
    pencil:   (s) => svg('<path d="M4 20.2h4L19.4 8.8a2.7 2.7 0 0 0-3.8-3.8L4.2 16.4z"/>'
                       + '<path d="m14.6 6 3.8 3.8"/>', s),
    exam:     (s) => svg('<path d="M9.2 4.2H7a2 2 0 0 0-2 2v12.6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6.2a2 2 0 0 0-2-2h-2.2"/>'
                       + '<rect x="9.2" y="2.6" width="5.6" height="3.4" rx="1.2"/>'
                       + '<path d="m9.2 13.6 2 2 3.8-3.8"/>', s),
    chart:    (s) => svg('<path d="M4.5 20V10.5"/><path d="M12 20V4.5"/>'
                       + '<path d="M19.5 20v-6.5"/><path d="M2.5 20.5h19"/>', s),
    user:     (s) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', s),

    // حالات وأفعال
    down:     (s) => svg('<path d="M12 3v13m0 0 4-4m-4 4-4-4"/><path d="M4 21h16"/>', s),
    check:    (s) => svg('<path d="m4 12 5 5L20 6"/>', s),
    play:     (s) => svg('<path d="M8 5v14l11-7z"/>', s, { fill: 'currentColor', stroke: 'none' }),
    wifiOff:  (s) => svg('<path d="M5 12.5a7 7 0 0 1 11-1.4"/><path d="M2 8.8a11 11 0 0 1 15-1.8"/><circle cx="12" cy="18" r="1.2"/><path d="m3 3 18 18"/>', s),
    sync:     (s) => svg('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>', s),
    warn:     (s) => svg('<path d="M12 9v4"/><path d="M10.3 3.9 2.6 17.4A1.6 1.6 0 0 0 4 20h16a1.6 1.6 0 0 0 1.4-2.6L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z"/><circle cx="12" cy="17" r=".8"/>', s),
    moon:     (s) => svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>', s),
    trophy:   (s) => svg('<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>', s),

    // اللوحة
    grid:     (s) => svg('<rect x="3" y="3" width="7.6" height="7.6" rx="1.6"/>'
                       + '<rect x="13.4" y="3" width="7.6" height="7.6" rx="1.6"/>'
                       + '<rect x="3" y="13.4" width="7.6" height="7.6" rx="1.6"/>'
                       + '<rect x="13.4" y="13.4" width="7.6" height="7.6" rx="1.6"/>', s),
    help:     (s) => svg('<circle cx="12" cy="12" r="9"/>'
                       + '<path d="M9.3 9.4a2.8 2.8 0 0 1 5.5.9c0 1.9-2.8 2.3-2.8 3.9"/>'
                       + '<circle cx="12" cy="17.4" r=".7" fill="currentColor"/>', s),
    video:    (s) => svg('<rect x="2.6" y="5.6" width="13.4" height="12.8" rx="2.4"/>'
                       + '<path d="m16 10.6 5.4-3.2v9.2L16 13.4z"/>', s),
    key:      (s) => svg('<circle cx="7.6" cy="15.4" r="4"/><path d="M10.4 12.6 20.4 2.6"/>'
                       + '<path d="m17 6 2.6 2.6"/><path d="m14.4 8.6 2.6 2.6"/>', s),
    users:    (s) => svg('<circle cx="9" cy="8" r="3.4"/>'
                       + '<path d="M2.6 20c0-3.6 2.9-5.6 6.4-5.6s6.4 2 6.4 5.6"/>'
                       + '<path d="M16.4 5.2a3.4 3.4 0 0 1 0 6.4"/>'
                       + '<path d="M18 14.7c2.1.6 3.4 2.4 3.4 5.3"/>', s),
  };

  /** حلقة التقدّم — SVG بمحيط محسوب */
  function ring(percent, size = 64, stroke = 7) {
    const r = (size - stroke) / 2 - 1;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
    const box = h('div.ring', { style: `width:${size}px;height:${size}px` });
    box.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="ring__track" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"></circle>
        <circle class="ring__fill"  cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"
                stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"></circle>
      </svg>`;
    box.appendChild(h('div.ring__label', {
      style: `font-size:${Math.round(size * 0.23)}px`,
      text: ar(Math.round(percent)) + '٪',
    }));
    return box;
  }

  const bar = (pct, cls = '') =>
    h('div.bar' + (cls ? '.' + cls : ''), h('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` }));

  /** يستبدل محتوى عنصر بعقدة جديدة */
  function mount(host, node) {
    host.replaceChildren(node);
    return node;
  }

  return { h, fr, ar, icon, svg, ring, bar, mount };
})();
