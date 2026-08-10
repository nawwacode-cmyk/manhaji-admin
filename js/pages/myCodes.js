/* =============================================================================
   لوحة المزوّد — صفحته الوحيدة

   لا يرى محتوًى ولا طلابًا ولا مزوّدين آخرين. `provider_dashboard` تحصر
   النتيجة بـ`my_provider_id()` **داخل SQL**، فلا وسيط يمرّره ولا مرشِّح
   يعطّله: إخفاء الأقسام هنا لتجربةٍ نظيفة لا حمايةً — الحماية هناك.

   الرصيد يُفحص على السيرفر عند كل إصدار. عرضُه هنا ليعرف المزوّد أين هو،
   لا ليقرّر البرنامج بناءً عليه.
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

  Pages.myCodes = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let me = null, rows = [], total = 0, offset = 0, search = '';
    let seasons = [], packages = [];
    let loadErr = null, busy = true, timer = null;

    async function loadRefs() {
      try {
        // المزوّد يقرأ المواسم مباشرةً (سياسة القراءة عامّة — تواريخ لا أسرار)
        // والباقات كذلك. أمّا الأكواد فعبر الدالّة وحدها.
        const [s, pk] = await Promise.all([
          Api.from('seasons', { select: 'id,title,ends_at,is_current', order: 'starts_at.desc' }),
          // `eq` لا `is_active:` — وإلّا جُلبت الباقات المعطَّلة معها
          Api.from('packages', { select: 'code,title', eq: { is_active: true }, order: 'sort_order.asc' }),
        ]);
        seasons = s || []; packages = pk || [];
      } catch (e) { loadErr = e.message || 'تعذّر تحميل البيانات المرجعية.'; }
    }

    async function load() {
      busy = true;
      try {
        const r = await Api.rpc('provider_dashboard',
          { p_search: search || null, p_limit: PAGE, p_offset: offset });
        me = r.provider; rows = r.rows || []; total = r.total || 0; loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل أكوادك.'; }
      busy = false;
      draw();
    }

    function showIssued(res) {
      C.modal({
        title: 'صدر الكود',
        body: h('div',
          h('div.badge.badge--warn.mb',
            'انسخ الكود الآن وسلّمه للطالب — لا يمكن استعادته لاحقًا.'),
          h('div.code-out', res.code),
          h('div.mt',
            h('div', h('b', 'الطالب: '), res.student.full_name),
            h('div', h('b', 'الرقم: '), res.student.phone),
            h('div', h('b', 'ينتهي: '), fmtDate(res.season.ends_at))),
          h('div.mt.faint.small', `رصيدك المتبقّي: ${ar(res.provider?.remaining ?? 0)}`)),
        actions: [
          { label: 'نسخ الكود', onClick: async () => {
            try { await navigator.clipboard.writeText(res.code); C.toast('نُسخ الكود'); }
            catch { C.toast('تعذّر النسخ — حدّده يدويًا', 'err'); }
          } },
          { label: 'تمّ', kind: 'primary', onClick: (c) => c() },
        ],
      });
    }

    function issuer() {
      const live = seasons.filter((s) => Date.parse(s.ends_at) > Date.now());
      const current = live.find((s) => s.is_current) || live[0];
      if (!current) {
        return C.modal({
          title: 'لا موسم متاح',
          body: h('div', 'لا يوجد موسم دراسي فعّال حاليًا. راجع الإدارة.'),
          actions: [{ label: 'حسنًا', kind: 'primary', onClick: (c) => c() }],
        });
      }

      const name  = C.input({ placeholder: 'الاسم الثلاثي كاملًا' });
      const phone = C.input({ placeholder: '09XXXXXXXX', inputmode: 'tel' });
      const city  = C.input({ placeholder: 'اختياري' });
      const pkg   = C.select(packages.map((p) => [p.code, p.title]), packages[0]?.code || '');
      const season = C.select(live.map((s) => [s.id, s.title + (s.is_current ? ' (الحالي)' : '')]),
                              current.id);
      const err = h('div.badge.badge--err', { style: 'display:none' });
      const show = (m) => { err.textContent = m; err.style.display = ''; };

      C.modal({
        title: 'بيع كود لطالب',
        body: h('div',
          C.field('اسم الطالب', name, 'الاسم الثلاثي كما يعطيك إيّاه.'),
          C.field('رقم الموبايل', phone,
            'أي صيغة تُقبل وتُوحَّد تلقائيًا. نفس الرقم = نفس الطالب.'),
          C.field('المدينة', city),
          C.field('الباقة', pkg),
          C.field('الموسم', season),
          err),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'إصدار الكود', kind: 'primary', onClick: async (close) => {
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

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('أكوادي', h('div.badge.badge--err', loadErr))); return; }

      const inp = C.input({ placeholder: 'ابحث باسم الطالب أو رقمه…', value: search });
      inp.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { search = inp.value.trim(); offset = 0; load(); }, 300);
      });

      const out = (me?.remaining ?? 0) === 0;
      const pages = Math.max(1, Math.ceil(total / PAGE));
      const cur = Math.floor(offset / PAGE) + 1;

      wrap.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('رصيدك المتبقّي', ar(me?.remaining ?? 0),
                `من ${ar(me?.quota ?? 0)}`, out ? 'var(--err)' : null),
          C.kpi('أكواد بعتها', ar(me?.issued ?? 0)),
          C.kpi('فعّلها الطلاب', ar(me?.redeemed ?? 0),
                me?.issued ? `${ar(Math.round((me.redeemed / me.issued) * 100))}٪` : null)),

        out && h('div.badge.badge--warn.mb',
          'نفد رصيدك — لا تستطيع إصدار أكواد جديدة حتى تزيده الإدارة.'),

        h('div.row.mb', { style: 'gap:10px;flex-wrap:wrap' },
          h('div.filter-w', inp),
          h('span.grow'),
          h('span.faint.small', `${ar(total)} كودًا`),
          h('button.btn.btn--primary.btn--sm',
            { onclick: issuer, disabled: out }, 'بيع كود لطالب')),

        C.card('أكوادي',
          C.table(['الطالب', 'الرقم', 'الكود', 'الباقة', 'الموسم', 'الحالة', 'تاريخ البيع', 'ينتهي'],
            rows, (r) => {
              const [cls, label] = STATUS[r.status] || ['badge--mute', r.status];
              return [
                h('div', { style: 'font-weight:600' }, r.student_name || '—'),
                h('span.small', { dir: 'ltr' }, r.student_phone || '—'),
                h('span.small', { dir: 'ltr', style: 'font-family:monospace' },
                  (r.code_prefix || '????') + '…'),
                h('span.faint.small', r.package_title || '—'),
                h('span.faint.small', r.season_title || '—'),
                h('span.badge.' + cls, label),
                h('span.faint.small', fmtDate(r.sold_at)),
                h('span.faint.small', fmtDate(r.ends_at)),
              ];
            }, busy ? 'جارٍ التحميل…' : 'لم تبع أي كود بعد.'),

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
