/* =============================================================================
   الطلاب — الاشتراكات والأجهزة وأدوات الدعم

   كل شيء هنا عبر RPCs (admin_students / admin_student_detail): جداول
   subscriptions و devices بلا أي منح للعميل منذ الهجرة 04، وهذه خاصية نحفظها
   عمدًا — فتحُها للمدير يعني أن ثغرة XSS واحدة في اللوحة تُفرّغ قاعدة العملاء.
   الدوال تُرجع المجمَّع والمحدود فقط، وتفحص is_admin() بنفسها.

   البحث والترقيم على السيرفر لا في المتصفح: قائمة الطلاب تنمو بلا حدّ.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const PAGE = 25;
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ar', {
    year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  /** «قبل ٣ أيام» أوضح من تاريخ مطلق حين يكون السؤال: هل ما زال يستعمله؟ */
  function ago(iso) {
    if (!iso) return 'لم يدخل بعد';
    const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    if (d <= 0) return 'اليوم';
    if (d === 1) return 'أمس';
    if (d < 30) return `قبل ${ar(d)} يومًا`;
    if (d < 365) return `قبل ${ar(Math.floor(d / 30))} أشهر`;
    return `قبل ${ar(Math.floor(d / 365))} سنة`;
  }

  Pages.students = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let rows = [], total = 0, offset = 0, search = '', loadErr = null, busy = false;
    let timer = null;

    async function load() {
      busy = true;
      try {
        const r = await Api.rpc('admin_students',
          { p_search: search || null, p_limit: PAGE, p_offset: offset });
        rows = r.rows || []; total = r.total || 0; loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل الطلاب.'; }
      busy = false;
      draw();
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('الطلاب', h('div.badge.badge--err', loadErr))); return; }

      const inp = C.input({ placeholder: 'ابحث باسم المستخدم أو الاسم…', value: search });
      inp.addEventListener('input', () => {
        // تأخير قصير: بلا هذا كل ضغطة مفتاح استعلامٌ للسيرفر
        clearTimeout(timer);
        timer = setTimeout(() => { search = inp.value.trim(); offset = 0; load(); }, 300);
      });

      const pages = Math.max(1, Math.ceil(total / PAGE));
      const cur = Math.floor(offset / PAGE) + 1;

      wrap.replaceChildren(
        h('div.row.mb', { style: 'gap:10px;flex-wrap:wrap' },
          h('div.filter-w', inp),
          h('span.faint.small', `${ar(total)} طالبًا`)),

        C.card('الطلاب',
          C.table(['اسم المستخدم', 'الاسم', 'الاشتراك', 'الأجهزة', 'آخر دخول', 'التسجيل', ''],
            rows, (s) => {
              const sub = s.subscription;
              const daysLeft = sub ? Math.ceil((Date.parse(sub.ends_at) - Date.now()) / 86400000) : 0;
              return [
                h('div', { style: 'font-weight:600' }, s.username || '—'),
                s.name ? h('span.small', s.name) : h('span.faint', '—'),
                sub
                  ? h('span.badge.badge--' + (daysLeft <= 14 ? 'warn' : 'ok'), `${ar(daysLeft)} يومًا`)
                  : h('span.badge.badge--mute', 'بلا اشتراك'),
                h('span.num', ar(s.devices || 0)),
                h('span.faint.small', ago(s.last_session)),
                h('span.faint.small', fmtDate(s.created_at)),
                C.actions(h('button.btn.btn--sec.btn--sm',
                  { onclick: () => detail(s.id) }, 'تفاصيل')),
              ];
            }, busy ? 'جارٍ التحميل…' : 'لا طلاب مطابقون.'),

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

    async function detail(id) {
      let d;
      try { d = await Api.rpc('admin_student_detail', { p_user: id }); }
      catch (e) { return C.toast(e.message || 'تعذّر جلب التفاصيل', 'err'); }

      const body = h('div');
      const refresh = async () => {
        d = await Api.rpc('admin_student_detail', { p_user: id });
        render();
      };

      const render = () => body.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('دروس أنهاها', ar(d.lessons_done || 0)),
          C.kpi('أجهزة نشطة', ar((d.devices || []).filter((x) => !x.revoked).length)),
          C.kpi('آخر دخول', ago(d.last_session))),

        C.card('الاشتراكات',
          C.table(['الحالة', 'من', 'إلى', ''], d.subscriptions || [], (s) => {
            const live = s.status === 'active' && Date.parse(s.ends_at) > Date.now();
            return [
              h('span.badge.badge--' + (live ? 'ok' : 'mute'),
                live ? 'فعّال' : (s.status === 'revoked' ? 'ملغى' : 'منتهٍ')),
              h('span.faint.small', fmtDate(s.starts_at)),
              h('span.faint.small', fmtDate(s.ends_at)),
              C.actions(live && h('button.btn.btn--danger.btn--sm', {
                onclick: () => C.confirmDialog('إلغاء الاشتراك',
                  'سيفقد الطالب الوصول للمحتوى المدفوع فورًا، ويحتاج كودًا جديدًا. '
                  + 'تُسجَّل العملية باسمك في سجلّ النشاط.',
                  async () => {
                    try {
                      await Api.rpc('admin_revoke_subscription', { p_sub: s.id });
                      C.toast('أُلغي الاشتراك'); await refresh(); load();
                    } catch (e) { C.toast(e.message || 'تعذّر الإلغاء', 'err'); }
                  }, 'إلغاء الاشتراك'),
              }, 'إلغاء')),
            ];
          }, 'لا اشتراكات.')),

        h('div.mt', C.card('الأجهزة',
          C.table(['الجهاز', 'أول ظهور', 'آخر ظهور', 'الحالة', ''], d.devices || [], (x) => [
            h('div.small', x.name || x.platform || 'جهاز'),
            h('span.faint.small', fmtDate(x.first_seen)),
            h('span.faint.small', ago(x.last_seen)),
            x.revoked ? h('span.badge.badge--mute', 'مفكوك') : h('span.badge.badge--ok', 'مرتبط'),
            C.actions(!x.revoked && h('button.btn.btn--sec.btn--sm', {
              onclick: async () => {
                try {
                  await Api.rpc('admin_revoke_device', { p_device: x.id });
                  C.toast('فُكّ الجهاز'); await refresh();
                } catch (e) { C.toast(e.message || 'تعذّر الفكّ', 'err'); }
              },
            }, 'فكّ الارتباط')),
          ], 'لا أجهزة.'),
          h('span.help',
            'الحماية الحقيقية بالجلسة الواحدة لا بعدد الأجهزة: أي دخول جديد يُبطل '
            + 'السابق فورًا. الفكّ هنا للدعم — حين ينكسر هاتف الطالب مثلًا — لا للحماية.'))),
      );
      render();

      C.modal({
        title: `الطالب: ${d.username || d.name || '—'}`,
        wide: true, body,
        actions: [{ label: 'إغلاق', kind: 'primary', onClick: (c) => c() }],
      });
    }

    load();
    return page;
  };
})();
