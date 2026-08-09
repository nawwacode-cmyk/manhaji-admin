/* =============================================================================
   أكواد التفعيل — كودٌ واحد لطالب واحد

   التوليد الجماعي أُلغي عمدًا. الكود لم يعد ورقةً مجهولة تُطبع بالمئات
   وتُوزَّع، بل يحمل اسم طالب ورقمه وموسمه قبل أن يُباع. الفرق ليس شكليًّا:
   هو الفرق بين «بعنا ٣٠٠ كود» و«نعرف من اشترى كلَّ كود ونستطيع مراسلته
   وتجديد اشتراكه وتعويضه إن اقتضى الأمر».

   الكود الصريح يظهر **مرّة واحدة** بعد الإصدار ولا يُخزَّن إلا مجزَّأً، فلا
   سبيل لاستعادته لاحقًا. لذلك نسخُه إلزامي في اللحظة، والنافذة تقول ذلك.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const PAGE = 25;
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ar', {
    year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  const STATUS = {
    available: ['badge--mute', 'لم يُستعمل'],
    redeemed:  ['badge--ok',   'مستعمَل'],
    revoked:   ['badge--err',  'مُبطَل'],
  };

  Pages.codes = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let rows = [], total = 0, offset = 0, search = '', status = '', provider = '';
    let providers = [], seasons = [], packages = [];
    let loadErr = null, busy = true, timer = null;

    async function loadRefs() {
      try {
        const [p, s, pk] = await Promise.all([
          Api.rpc('admin_providers'),
          Api.rpc('admin_season_stats'),
          Api.from('packages', { select: 'code,title,is_active', is_active: 'eq.true',
                                 order: 'sort_order.asc' }),
        ]);
        providers = p.rows || []; seasons = s.rows || []; packages = pk || [];
      } catch (e) { loadErr = e.message || 'تعذّر تحميل البيانات المرجعية.'; }
    }

    async function load() {
      busy = true;
      try {
        const r = await Api.rpc('admin_codes_report', {
          p_search: search || null,
          p_status: status || null,
          p_provider: provider || null,
          p_limit: PAGE, p_offset: offset,
        });
        rows = r.rows || []; total = r.total || 0; loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل الأكواد.'; }
      busy = false;
      draw();
    }

    /** الكود الصريح — يظهر مرّة ولا يعود. */
    function showIssued(res) {
      const codeBox = h('div.code-out', res.code);
      const body = h('div',
        h('div.badge.badge--warn.mb',
          'انسخ الكود الآن — لا يُخزَّن صريحًا ولا يمكن استعادته لاحقًا.'),
        codeBox,
        h('div.mt',
          h('div', h('b', 'الطالب: '), res.student.full_name),
          h('div', h('b', 'الرقم: '), res.student.phone),
          h('div', h('b', 'الباقة: '), res.package.title),
          h('div', h('b', 'الموسم: '), res.season.title),
          h('div', h('b', 'ينتهي: '), fmtDate(res.season.ends_at))),
        res.provider && h('div.mt.faint.small',
          `رصيدك المتبقّي: ${ar(res.provider.remaining)}`));

      C.modal({
        title: 'صدر الكود',
        body,
        actions: [
          { label: 'نسخ الكود', onClick: async () => {
            try {
              await navigator.clipboard.writeText(res.code);
              C.toast('نُسخ الكود');
            } catch { C.toast('تعذّر النسخ — حدّده يدويًا', 'err'); }
          } },
          { label: 'تمّ', kind: 'primary', onClick: (c) => c() },
        ],
      });
    }

    function issuer() {
      const current = seasons.find((s) => s.is_current);
      if (!current) {
        return C.modal({
          title: 'لا موسم حالي',
          body: h('div',
            h('div.mb', 'لا يمكن إصدار أكواد بلا موسم دراسي حالي.'),
            h('span.help', 'افتح صفحة «المواسم» وحدّد الموسم الحالي أوّلًا.')),
          actions: [{ label: 'حسنًا', kind: 'primary', onClick: (c) => c() }],
        });
      }

      const name  = C.input({ placeholder: 'الاسم الثلاثي كاملًا' });
      const phone = C.input({ placeholder: '09XXXXXXXX', inputmode: 'tel' });
      const city  = C.input({ placeholder: 'اختياري' });
      const pkg   = C.select(packages.map((p) => [p.code, p.title]), packages[0]?.code || '');
      // المواسم المنتهية محذوفة من القائمة: كودها يُرفض عند التفعيل، فعرضُها
      // يعني السماح ببيع كودٍ ميت واكتشاف ذلك على يد طالب دفع ثمنه.
      const live = seasons.filter((s) => Date.parse(s.ends_at) > Date.now());
      const season = C.select(live.map((s) => [s.id, s.title + (s.is_current ? ' (الحالي)' : '')]),
                              current.id);
      const err = h('div.badge.badge--err', { style: 'display:none' });
      const show = (m) => { err.textContent = m; err.style.display = ''; };

      const body = h('div',
        C.field('اسم الطالب', name, 'كما سيظهر في حسابه وفي كل التقارير.'),
        C.field('رقم الموبايل', phone,
          'المُعرِّف الحقيقي للطالب. أي صيغة تُقبل وتُوحَّد تلقائيًا — '
          + 'ونفس الرقم يعني نفس الطالب لا سجلًّا جديدًا.'),
        C.field('المدينة', city),
        C.field('الباقة', pkg),
        C.field('الموسم', season, 'الاشتراك ينتهي بنهاية هذا الموسم مهما كان تاريخ التفعيل.'),
        err);

      C.modal({
        title: 'إصدار كود لطالب',
        body,
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'إصدار', kind: 'primary', onClick: async (close) => {
            if (!name.value.trim() || !phone.value.trim()) {
              return show('اسم الطالب ورقمه مطلوبان.');
            }
            try {
              const res = await Api.invoke('issue-code', {
                full_name: name.value, phone: phone.value,
                city: city.value, package: pkg.value, season_id: season.value,
              });
              close(); showIssued(res); load();
            } catch (e) { show(e.message || 'تعذّر إصدار الكود.'); }
          } },
        ],
      });
    }

    function exportCsv() {
      // ما يُصدَّر هو ما يُعرض بعد الترشيح لا كل شيء: تصديرٌ يتجاهل المرشِّحات
      // يعطي ملفًّا لا يطابق الشاشة فيُقرأ خطأً.
      const head = ['الطالب', 'الرقم', 'الكود', 'الباقة', 'الموسم', 'المزوّد',
                    'الحالة', 'تاريخ البيع', 'ينتهي'];
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [head.join(',')].concat(rows.map((r) => [
        r.student_name, r.student_phone, r.code_prefix + '…', r.package_title,
        r.season_title, r.provider_name || 'الإدارة',
        (STATUS[r.status] || ['', r.status])[1],
        fmtDate(r.sold_at), fmtDate(r.ends_at),
      ].map(esc).join(',')));
      // BOM حتى يفتح Excel العربية بلا تشويه — بدونه يقرأ الملف بترميز محلّي
      C.download(`codes-${new Date().toISOString().slice(0, 10)}.csv`,
                 '﻿' + lines.join('\n'));
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('الأكواد', h('div.badge.badge--err', loadErr))); return; }

      const inp = C.input({ placeholder: 'ابحث باسم الطالب أو رقمه أو بادئة الكود…', value: search });
      inp.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { search = inp.value.trim(); offset = 0; load(); }, 300);
      });

      const stSel = C.select([['', 'كل الحالات'], ['available', 'لم يُستعمل'],
                              ['redeemed', 'مستعمَل'], ['revoked', 'مُبطَل']], status);
      stSel.addEventListener('change', () => { status = stSel.value; offset = 0; load(); });

      const pvSel = C.select([['', 'كل المصادر'],
                              ...providers.map((p) => [p.id, p.name])], provider);
      pvSel.addEventListener('change', () => { provider = pvSel.value; offset = 0; load(); });

      const pages = Math.max(1, Math.ceil(total / PAGE));
      const cur = Math.floor(offset / PAGE) + 1;

      wrap.replaceChildren(
        h('div.row.mb', { style: 'gap:10px;flex-wrap:wrap' },
          h('div.filter-w', inp), stSel, pvSel,
          h('span.grow'),
          h('span.faint.small', `${ar(total)} كودًا`),
          h('button.btn.btn--sec.btn--sm',
            { onclick: exportCsv, disabled: !rows.length }, 'تصدير CSV'),
          h('button.btn.btn--primary.btn--sm', { onclick: issuer }, 'إصدار كود')),

        C.card('الأكواد',
          C.table(
            ['الطالب', 'الرقم', 'الكود', 'الباقة', 'الموسم', 'المصدر', 'الحالة', 'ينتهي'],
            rows, (r) => {
              const [cls, label] = STATUS[r.status] || ['badge--mute', r.status];
              return [
                r.student_name
                  ? h('div', { style: 'font-weight:600' }, r.student_name)
                  : h('span.faint', '— كود قديم بلا طالب'),
                h('span.small', { dir: 'ltr' }, r.student_phone || '—'),
                // البادئة وحدها ما نملكه: الباقي تجزئة لا تُعكس.
                h('span.small', { dir: 'ltr', style: 'font-family:monospace' },
                  (r.code_prefix || '????') + '…'),
                h('span.faint.small', r.package_title || '—'),
                h('span.faint.small', r.season_title || '—'),
                h('span.faint.small', r.provider_name || 'الإدارة'),
                h('span.badge.' + cls, label),
                h('span.faint.small', fmtDate(r.ends_at)),
              ];
            }, busy ? 'جارٍ التحميل…' : 'لا أكواد مطابقة.'),

          pages > 1 && h('div.row', { style: 'gap:8px' },
            h('button.btn.btn--ghost.btn--sm', {
              disabled: offset === 0,
              onclick: () => { offset = Math.max(0, offset - PAGE); load(); },
            }, 'السابق'),
            h('span.faint.small', `${ar(cur)} من ${ar(pages)}`),
            h('button.btn.btn--ghost.btn--sm', {
              disabled: cur >= pages,
              onclick: () => { offset += PAGE; load(); },
            }, 'التالي'))),
      );
    }

    (async () => { await loadRefs(); await load(); })();
    return page;
  };
})();
