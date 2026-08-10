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

  /* ---------------------------------------------------------------------------
     رفع فيديو — مكوّن مشترك بين «الفيديوهات» و«تحرير الدرس»

     مشترك عمدًا لا مكرَّر: منطق الرفع دقيق (ترتيب التوقيع والرفع والتسجيل،
     وإلغاء الطلب، وقراءة المدّة)، ونسختان منه تنحرفان عند أوّل تعديل يُنسى
     في إحداهما.

     الملفّ **لا يمرّ عبر خوادمنا**: نطلب رابط PUT موقّعًا ثم يرفع المتصفّح
     إلى R2 مباشرةً — حدّ طلب Edge Function بضعة ميغابايت والدرس مئات.

     وبـXMLHttpRequest لا fetch: الأخيرة لا تعطي تقدّم رفع، والتقدّم ليس زينة
     — رفع ٦٠٠ م.ب على شبكة سورية دقائق، وبلا مؤشّر يظنّ المحرِّر أن التطبيق
     تعلّق فيغلق النافذة في منتصفه.
  --------------------------------------------------------------------------- */
  function videoUploader({ lessonId = null, lessonTitle = '', onDone } = {}) {
    const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');
    const mb = (b) => Math.round((b || 0) / 1048576 * 10) / 10;

    const fTitle = input({ placeholder: lessonTitle || 'مثال: الوحدة ١ — التحيات' });
    if (lessonTitle) fTitle.value = lessonTitle;
    /* الجودة: تُقرأ من الملفّ نفسه وتبقى قابلة للتعديل.
       القائمة المغلقة السابقة كانت تجبر المحرِّر على الكذب — يرفع 1440p
       فيسمّيه 1080p لأن لا خيار غيره. والقراءة الآلية تُنهي السؤال أصلًا:
       الملفّ يعرف أبعاده، فلا معنى لسؤال إنسانٍ عنها.
       والحقل حرّ لا مقفل: «شرائح + صوت» أو أي وصف آخر مقبول. */
    const fQuality = input({ placeholder: 'تُقرأ من الملفّ…', list: 'q-presets' });
    const presets = h('datalist', { id: 'q-presets' },
      ...['2160p', '1440p', '1080p', '720p', '480p', '360p', 'slides']
        .map((v) => h('option', { value: v })));

    const info = h('div');
    const progress = h('div');
    const err = h('div.badge.badge--err', { style: 'display:none' });
    const showErr = (m) => { err.textContent = m; err.style.display = ''; };
    let file = null, seconds = null, height = null, xhr = null, poster = null;

    /* لقطة من الفيديو تصير صورته.
       تُلتقط آليًّا لا تُطلب من المحرِّر: خطوةٌ يدوية إضافية لكل درس تُنسى،
       فتعود الدروس كلّها إلى الرسم النائب — تتشابه قبل فتحها ولا يميّز
       الطالب ما شاهده ممّا لم يشاهده.

       عند الثانية الثالثة لا الأولى: أوّل ثوانٍ كثيرًا ما تكون سوداء أو
       شعارًا. وWebP بعرض ٧٢٠ يكفي لملصق يُعرض بعرض ٣٦٠ على الهاتف. */
    function grabPoster(f) {
      return new Promise((resolve) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;                       // بعض المتصفّحات ترفض seek بلا كتم
        v.playsInline = true;
        const done = (blob) => { URL.revokeObjectURL(v.src); resolve(blob); };

        v.onloadedmetadata = () => { v.currentTime = Math.min(3, (v.duration || 4) / 2); };
        v.onseeked = () => {
          try {
            const w = 720;
            const cv = document.createElement('canvas');
            cv.width = w;
            cv.height = Math.round(w * (v.videoHeight / v.videoWidth || 0.5625));
            cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
            cv.toBlob((b) => done(b), 'image/webp', 0.8);
          } catch { done(null); }        // ملفّ لا يُقرأ في canvas — لا نُفشل الرفع
        };
        v.onerror = () => done(null);
        // مهلة: ملفّ لا يُفكّ ترميزه في المتصفّح يجب ألّا يعلّق الرفع
        setTimeout(() => done(null), 8000);
        v.src = URL.createObjectURL(f);
      });
    }

    const drop = h('div.drop',
      h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'اسحب ملف الفيديو هنا'),
      h('div.small', 'أو اضغط للاختيار — MP4 (H.264) موصى بها'));
    const picker = h('input', { type: 'file', accept: 'video/*', style: 'display:none' });

    drop.addEventListener('click', () => picker.click());
    ['dragover', 'dragenter'].forEach((e) => drop.addEventListener(e, (ev) => {
      ev.preventDefault(); drop.classList.add('is-over');
    }));
    ['dragleave', 'drop'].forEach((e) =>
      drop.addEventListener(e, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (ev) => { ev.preventDefault(); take(ev.dataTransfer.files[0]); });
    picker.addEventListener('change', () => take(picker.files[0]));

    function take(f) {
      if (!f) return;
      if (!f.type.startsWith('video/')) return showErr('الملفّ ليس فيديو.');
      err.style.display = 'none';
      file = f;
      if (!fTitle.value) fTitle.value = f.name.replace(/\.[^.]+$/, '');

      // المدّة تُقرأ من الملفّ لا تُطلب من المحرِّر: رقمٌ يُكتب يدويًا يُنسى
      // أو يُخطأ، وهو يظهر للطالب على بطاقة الدرس.
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        seconds = Math.round(v.duration) || null;
        // الارتفاع هو ما يسمّي الجودة عرفًا (1080p لا 1920p). ولا نطمس ما
        // كتبه المحرِّر بيده: القراءة الآلية تُعين لا تُلغي.
        height = v.videoHeight || null;
        if (height && !fQuality.value) fQuality.value = `${height}p`;
        URL.revokeObjectURL(v.src);
        showInfo();
      };
      v.onerror = () => { seconds = null; height = null; showInfo(); };
      v.src = URL.createObjectURL(f);

      // اللقطة تُلتقط بالتوازي مع اختيار البيانات: تكون جاهزة قبل أن يضغط
      // المحرِّر «رفع»، فلا تضيف انتظارًا.
      poster = null;
      grabPoster(f).then((b) => { poster = b; showInfo(); });
    }

    function showInfo() {
      const size = mb(file.size);
      const perMin = seconds ? Math.round(size / (seconds / 60) * 10) / 10 : null;
      /* الترشيح ضروري: `replaceChildren` الأصلية تحوّل `false` إلى **عقدة
         نصّية** فتظهر كلمة "false" في الواجهة — بخلاف `UI.h` التي تُسقط
         الزائف. وقع هذا فعلًا: ظهرت "false" تحت شارات حجم الملفّ. */
      info.replaceChildren(...[
        h('div.row.mt', { style: 'gap:8px;flex-wrap:wrap' },
          h('span.badge.badge--acc', `${ar(size)} م.ب`),
          seconds && h('span.badge.badge--mute', fmtDur(seconds)),
          // الأبعاد المقروءة من الملفّ: تُعرض ليرى المحرِّر أن ما في الحقل
          // يطابق ما رفعه فعلًا لا ما ظنّه.
          height && h('span.badge.badge--mute', `${ar(height)}p`),
          perMin && h('span.badge.' + (perMin > 60 ? 'badge--warn' : 'badge--ok'),
            `${ar(perMin)} م.ب/دقيقة`),
          // الصورة تُلتقط آليًّا؛ نقول إن تعذّرت كي لا يفاجأ المحرِّر بالرسم
          // النائب بعد الرفع ولا يعرف السبب.
          poster ? h('span.badge.badge--ok', 'الصورة جاهزة')
                 : h('span.badge.badge--mute', 'جارٍ التقاط الصورة…')),
        // 1080p عند CRF 22 يقع حول ٢٥–٤٥ م.ب/دقيقة، فما تجاوز الستّين غالبًا
        // لم يُضغط أصلًا — وكل ميغابايت زائد يتحمّله كل طالب.
        perMin > 60 && h('div.help', { style: 'margin-top:8px' },
          'أثقل من المتوقّع — يبدو أنه لم يُضغط. مرّره بـffmpeg أوّلًا: '
          + 'crf 22 وpreset slow وmovflags +faststart.'),
      ].filter(Boolean));
    }

    const close = modal({
      title: lessonTitle ? `رفع فيديو لـ«${lessonTitle}»` : 'رفع فيديو',
      wide: true,
      body: h('div', drop, picker, info,
        h('div.mt',
          field('العنوان', fTitle, 'يظهر في المكتبة — لا يراه الطالب.'),
          field('الجودة', fQuality,
            'تُقرأ من أبعاد الملفّ تلقائيًّا — عدّلها إن شئت أو اكتب أي وصف.')),
        presets,
        progress, err),
      actions: [
        { label: 'إلغاء', onClick: (c) => { if (xhr) xhr.abort(); c(); } },
        { label: 'رفع', kind: 'primary', onClick: () => start() },
      ],
    });

    async function start() {
      if (!file) return showErr('اختر ملفًا أوّلًا.');
      if (!fTitle.value.trim()) return showErr('العنوان مطلوب.');
      err.style.display = 'none';

      const bar = h('div.bar', h('i', { style: 'width:0%' }));
      const label = h('div.small.mb', 'جارٍ التوقيع…');
      progress.replaceChildren(h('div.mt', label, bar));

      try {
        // ١) التوقيع — يفحص الحجم والصيغة قبل رفع بايت واحد
        const sign = await Api.invoke('admin-video', {
          action: 'sign', filename: file.name,
          content_type: file.type, size_bytes: file.size,
        });

        // ٢) الرفع إلى R2 مباشرةً
        label.textContent = 'جارٍ الرفع…';
        await new Promise((resolve, reject) => {
          xhr = new XMLHttpRequest();
          xhr.open('PUT', sign.upload_url, true);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const pct = Math.round(e.loaded / e.total * 100);
            bar.firstChild.style.width = pct + '%';
            label.textContent = `جارٍ الرفع… ${ar(pct)}٪ `
              + `(${ar(mb(e.loaded))} من ${ar(mb(e.total))} م.ب)`;
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
            ? resolve() : reject(new Error(`فشل الرفع إلى التخزين (${xhr.status}).`));
          xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع.'));
          xhr.onabort = () => reject(new Error('أُلغي الرفع.'));
          xhr.send(file);
        });

        /* ٣) الصورة — بعد الفيديو وقبل التسجيل.
           فشلها **لا يُفشل الرفع**: فيديو بلا صورة يعمل ويُشاهَد، وإسقاط
           رفعٍ استغرق دقائق لأجل ملصق مقايضةٌ سيّئة. نسجّل بلا صورة ويظهر
           الرسم النائب. */
        let posterKey = null;
        if (poster && sign.poster_upload_url) {
          label.textContent = 'جارٍ رفع الصورة…';
          try {
            const pr = await fetch(sign.poster_upload_url, {
              method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: poster,
            });
            if (pr.ok) posterKey = sign.poster_key;
          } catch { /* بلا صورة — الرسم النائب */ }
        }

        // ٤) التسجيل — بعد نجاح الرفع لا قبله: لو سُجّل أوّلًا لبقي في المكتبة
        // فيديو لا وجود له في R2 يُربط بدرس فيرى الطالب مشغّلًا لا يعمل.
        label.textContent = 'جارٍ التسجيل…';
        const res = await Api.invoke('admin-video', {
          action: 'commit', r2_key: sign.r2_key, poster_key: posterKey,
          title: fTitle.value.trim(),
          quality: fQuality.value.trim() || (height ? height + 'p' : '1080p'),
          duration_s: seconds, size_bytes: file.size,
        });

        if (lessonId) await Api.update('lessons', lessonId, { video_id: res.video.id });

        toast('رُفع الفيديو');
        close();
        onDone?.(res.video);
      } catch (e) {
        xhr = null;
        progress.replaceChildren();
        showErr(e.message || 'تعذّر الرفع.');
      }
    }
  }

  /* ---------------------------------------------------------------------------
     رفع شرح الدرس (PDF)

     نفس مسار الفيديو حرفيًّا — توقيعٌ ثم رفعٌ مباشر إلى R2 ثم تسجيل — لأن
     الشرح محتوًى **مدفوع** مثله: دلوٌ خاصّ ورابطٌ موقّع، لا ملفٌّ عام يُتداول
     برابط واحد.

     وعدد الصفحات يُقرأ من الملفّ لا يُطلب من المحرِّر: رقمٌ يُكتب يدويًا
     يُنسى أو يُخطأ. القراءة تتمّ بترويسة PDF المصغَّرة بلا مكتبة — اللوحة
     ليست بحاجة لتحميل ١٫٤ م.ب لأجل رقم.
  --------------------------------------------------------------------------- */
  function docUploader({ lessonId = null, lessonTitle = '', bodyMode = 'text', hasText = false, onDone } = {}) {
    const mb = (b) => Math.round((b || 0) / 1048576 * 10) / 10;

    const fTitle = input({ placeholder: lessonTitle || 'مثال: الوحدة ١ — التحيات' });
    if (lessonTitle) fTitle.value = lessonTitle;

    const info = h('div');
    const progress = h('div');
    const err = h('div.badge.badge--err', { style: 'display:none' });
    const showErr = (m) => { err.textContent = m; err.style.display = ''; };
    let file = null, pages = null, xhr = null;

    /** عدد الصفحات من بنية الملفّ. يعود بـnull إن تعذّر — رقمٌ اختياري لا شرط. */
    async function countPages(f) {
      try {
        const txt = new TextDecoder('latin1').decode(await f.arrayBuffer());
        // `/Type /Page` (لا `/Pages`) يظهر مرّة لكل صفحة في الملفّات غير المضغوطة
        const direct = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
        if (direct > 0) return direct;
        // ملفّ مضغوط البنية: `/Count N` في شجرة الصفحات
        const counts = [...txt.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
        return counts.length ? Math.max(...counts) : null;
      } catch { return null; }
    }

    const drop = h('div.drop',
      h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'اسحب ملفّ الشرح هنا'),
      h('div.small', 'أو اضغط للاختيار — PDF فقط'));
    const picker = h('input', { type: 'file', accept: 'application/pdf,.pdf', style: 'display:none' });

    drop.addEventListener('click', () => picker.click());
    ['dragover', 'dragenter'].forEach((e) => drop.addEventListener(e, (ev) => {
      ev.preventDefault(); drop.classList.add('is-over');
    }));
    ['dragleave', 'drop'].forEach((e) =>
      drop.addEventListener(e, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (ev) => { ev.preventDefault(); take(ev.dataTransfer.files[0]); });
    picker.addEventListener('change', () => take(picker.files[0]));

    async function take(f) {
      if (!f) return;
      if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
        return showErr('الملفّ ليس PDF.');
      }
      err.style.display = 'none';
      file = f;
      if (!fTitle.value) fTitle.value = f.name.replace(/\.[^.]+$/, '');
      pages = null;
      showInfo();
      pages = await countPages(f);
      showInfo();
    }

    function showInfo() {
      const size = mb(file.size);
      /* الترشيح ضروري: `replaceChildren` الأصلية تحوّل `false` إلى عقدة نصّية
         فتظهر الكلمة في الواجهة — بخلاف `UI.h` التي تُسقط الزائف. */
      info.replaceChildren(...[
        h('div.row.mt', { style: 'gap:8px;flex-wrap:wrap' },
          h('span.badge.badge--acc', `${ar(size)} م.ب`),
          pages ? h('span.badge.badge--mute', `${ar(pages)} صفحة`)
                : h('span.badge.badge--mute', 'جارٍ قراءة الصفحات…')),
        /* كل ميغابايت يتحمّله كل طالب في كل فتحة، وعلى بيانات الهاتف. شرحٌ
           مصمَّم يقع عادةً تحت ٨ م.ب؛ ما تجاوزها غالبًا صورٌ لم تُضغط. */
        size > 8 && h('div.help', { style: 'margin-top:8px' },
          'أثقل من المتوقّع لشرحٍ مصمَّم. صغِّر الصور داخل الملفّ قبل التصدير — '
          + 'كل ميغابايت يتحمّله كل طالب في كل مرّة يفتح الدرس.'),
      ].filter(Boolean));
    }

    const close = modal({
      title: lessonTitle ? `رفع شرح لـ«${lessonTitle}»` : 'رفع شرح PDF',
      wide: true,
      body: h('div', drop, picker, info,
        h('div.mt', field('العنوان', fTitle, 'يظهر في المكتبة — لا يراه الطالب.')),
        progress, err),
      actions: [
        { label: 'إلغاء', onClick: (c) => { if (xhr) xhr.abort(); c(); } },
        { label: 'رفع', kind: 'primary', onClick: () => start() },
      ],
    });

    async function start() {
      if (!file) return showErr('اختر ملفًا أوّلًا.');
      if (!fTitle.value.trim()) return showErr('العنوان مطلوب.');
      err.style.display = 'none';

      const bar = h('div.bar', h('i', { style: 'width:0%' }));
      const label = h('div.small.mb', 'جارٍ التوقيع…');
      progress.replaceChildren(h('div.mt', label, bar));

      try {
        const sign = await Api.invoke('admin-doc', {
          action: 'sign', filename: file.name,
          content_type: 'application/pdf', size_bytes: file.size,
        });

        label.textContent = 'جارٍ الرفع…';
        await new Promise((resolve, reject) => {
          xhr = new XMLHttpRequest();
          xhr.open('PUT', sign.upload_url, true);
          xhr.setRequestHeader('Content-Type', 'application/pdf');
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const pct = Math.round(e.loaded / e.total * 100);
            bar.firstChild.style.width = pct + '%';
            label.textContent = `جارٍ الرفع… ${ar(pct)}٪`;
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
            ? resolve() : reject(new Error(`فشل الرفع إلى التخزين (${xhr.status}).`));
          xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع.'));
          xhr.onabort = () => reject(new Error('أُلغي الرفع.'));
          xhr.send(file);
        });

        // التسجيل بعد نجاح الرفع لا قبله — وإلّا بقي في المكتبة ملفٌّ لا وجود
        // له في R2، يُربط بدرس فيرى الطالب عارضًا فارغًا.
        label.textContent = 'جارٍ التسجيل…';
        /* `lesson_id` يُرسل مع التسجيل — وهذا ما كان ناقصًا.
           كان الملفّ يُسجَّل بلا درس ثم يُربط بكتابة `lessons.doc_id`، وهو
           العمود **المهجور** بعد أن صار الربط في `lesson_docs.lesson_id`.
           فكل ملفٍّ جديد يولد يتيمًا: يظهر في سجلّ النشاط مرفوعًا ولا تراه
           قائمة الدرس أبدًا — وهو بعينه «لا أستطيع رفع أكثر من ملفّ». */
        const res = await Api.invoke('admin-doc', {
          action: 'commit', r2_key: sign.r2_key, lesson_id: lessonId || null,
          title: fTitle.value.trim(), pages, size_bytes: file.size,
        });

        /* الربط تمّ في `commit` أعلاه. ما يبقى هنا قرار العرض وحده:

           أوّلُ ملفٍّ يُرفع لدرسٍ نصّي ينقله إلى «الاثنان معًا» لا إلى
           «الملفّات» — فلا يختفي نصٌّ كتبه المحرِّر بلا أن يطلب ذلك. ودرسٌ
           بلا نصّ يصير «ملفّات». وما كان وضعه مضبوطًا سلفًا لا يُلمس:
           إضافةُ ملفٍّ ثانٍ ليست قرار عرضٍ جديدًا. */
        if (lessonId && bodyMode === 'text') {
          await Api.update('lessons', lessonId,
            { body_mode: hasText ? 'both' : 'pdf' });
        }

        toast('رُفع الملفّ');
        close();
        onDone?.(res.doc);
      } catch (e) {
        xhr = null;
        progress.replaceChildren();
        showErr(e.message || 'تعذّر الرفع.');
      }
    }
  }

  return { pageHead, card, kpi, table, td, actions, field, input, textarea, select,
           checkbox, modal, confirmDialog, toast, pubBadge, download, videoUploader,
           docUploader };
})();
