/* =============================================================================
   أعطال التطبيق — ما يراه الطالب ولا يخبرك به

   قبل هذه الصفحة كان العطل يُعرف من شكوى طالب، إن اشتكى. أغلب الطلاب لا
   يشتكون — يغلقون التطبيق.

   **مجمَّعة بالرسالة لا مسرودة زمنيًّا**: قائمةٌ خام تُظهر مئة صفّ لعطل واحد
   فيبدو الأمر كارثة، أو تُهمَل كضجيج. ما يُتَّخذ القرار بناءً عليه هو «هذا
   العطل أصاب ٤٠ طالبًا في نسخة v40» — لا «وقع عطل الساعة ٣:١٤».
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const WINDOWS = [[24, 'آخر ٢٤ ساعة'], [168, 'آخر أسبوع'], [720, 'آخر شهر']];

  function ago(iso) {
    if (!iso) return '—';
    const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'الآن';
    if (m < 60) return `قبل ${ar(m)} دقيقة`;
    const hrs = Math.floor(m / 60);
    if (hrs < 24) return `قبل ${ar(hrs)} ساعة`;
    return `قبل ${ar(Math.floor(hrs / 24))} يومًا`;
  }

  Pages.errors = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let rows = [], total = 0, users = 0, hours = 168, loadErr = null, busy = true;

    async function load() {
      busy = true;
      try {
        const r = await Api.rpc('admin_client_errors', { p_since_hours: hours, p_limit: 100 });
        rows = r.rows || []; total = r.total || 0; users = r.users || 0; loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل الأعطال.'; }
      busy = false;
      draw();
    }

    function detail(r) {
      C.modal({
        title: 'تفصيل العطل',
        wide: true,
        body: h('div',
          h('div.mb', h('b', 'الرسالة: '), r.message),
          h('div.mb',
            h('div', h('b', 'الإصابات: '), `${ar(r.hits)} · ${ar(r.users)} مستخدمًا`),
            h('div', h('b', 'النسخ: '), (r.versions || []).filter(Boolean).join('، ') || '—'),
            h('div', h('b', 'الشاشات: '), (r.screens || []).filter(Boolean).join('، ') || '—'),
            h('div', h('b', 'أوّل ظهور: '), ago(r.first_at)),
            h('div', h('b', 'آخر ظهور: '), ago(r.last_at))),
          r.last_ua && h('div.mb', h('b', 'الجهاز: '), h('span.small', r.last_ua)),
          r.last_stack
            ? h('div', h('b', 'المكدَّس (آخر إصابة):'),
                h('pre.stack', r.last_stack))
            : h('span.help', 'بلا مكدَّس — عطلٌ بُلّغ من catch صريحة لا من استثناء غير ملتقَط.')),
        actions: [{ label: 'إغلاق', kind: 'primary', onClick: (c) => c() }],
      });
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('الأعطال', h('div.badge.badge--err', loadErr))); return; }

      const sel = C.select(WINDOWS.map(([v, l]) => [v, l]), hours);
      sel.addEventListener('change', () => { hours = Number(sel.value); load(); });

      wrap.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('تقارير', ar(total), null, total ? 'var(--err)' : null),
          C.kpi('طلاب متأثّرون', ar(users)),
          C.kpi('أعطال مختلفة', ar(rows.length))),

        // الصمت هنا خبر جيّد ويستحقّ أن يُقال صراحةً: صفحةٌ فارغة بلا تفسير
        // تُقرأ «معطّلة» لا «لا أعطال».
        !busy && !rows.length && h('div.badge.badge--ok.mb',
          'لا أعطال في هذه المدّة — التطبيق يعمل عند الطلاب.'),

        h('div.row.mb', { style: 'gap:10px;flex-wrap:wrap' },
          sel,
          h('span.grow'),
          h('button.btn.btn--sec.btn--sm', { onclick: load }, 'تحديث')),

        C.card('الأعطال (مجمَّعة بالرسالة)',
          C.table(['العطل', 'إصابات', 'طلاب', 'النسخ', 'الشاشات', 'آخر ظهور', ''],
            rows, (r) => [
              h('div', { style: 'font-weight:600;max-width:420px' }, r.message),
              // العدد الكبير يُبرَز: ما أصاب أربعين طالبًا لا يُقرأ كما يُقرأ
              // ما أصاب واحدًا.
              h('span.badge.badge--' + (r.hits >= 10 ? 'err' : 'mute'), ar(r.hits)),
              h('span.num', ar(r.users)),
              h('span.faint.small', (r.versions || []).filter(Boolean).join('، ') || '—'),
              h('span.faint.small', (r.screens || []).filter(Boolean).join('، ') || '—'),
              h('span.faint.small', ago(r.last_at)),
              C.actions(h('button.btn.btn--ghost.btn--sm',
                { onclick: () => detail(r) }, 'تفصيل')),
            ], busy ? 'جارٍ التحميل…' : 'لا أعطال.')),

        h('div.mt', C.card('ماذا يصل هنا',
          h('span.help',
            'الأخطاء غير الملتقَطة في تطبيق الطالب، وأعطال الإقلاع الثلاثة '
            + '(فشل الرسم الأول، فشل بدء المزامنة، فشل الرسم بعدها) — وكانت '
            + 'تُبتلع صامتةً قبل اليوم. لكل طالب حدّ عشرة تقارير في الساعة كي '
            + 'لا يُغرق عطلٌ في حلقة رسم الجدول، والتقرير لا يُرسَل بلا إنترنت.'))),
      );
    }

    load();
    return page;
  };
})();
