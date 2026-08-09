/* =============================================================================
   المواسم الدراسية

   الاشتراك ينتهي بنهاية موسمه لا بعد مدّة ثابتة من تاريخه: طالبٌ اشترك في
   منتصف السنة ينتهي مع زملائه، فيصير التجديد موسمًا واحدًا للجميع بدل مئات
   التواريخ المتفرّقة التي لا يمكن تنظيم حملة حولها.

   «الموسم الحالي» هو ما تُنسب إليه الأكواد الجديدة تلقائيًا. واحد فقط —
   يفرضه فهرس فريد في القاعدة لا هذه الصفحة، فلا يمكن الالتفاف عليه.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ar', {
    year: 'numeric', month: 'long', day: 'numeric' }) : '—');

  /** يوم واحد بصيغة input[type=date] — القاعدة تخزّن timestamptz. */
  const toDay = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

  Pages.seasons = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let rows = [], loadErr = null, busy = true;

    async function load() {
      busy = true;
      try {
        const r = await Api.rpc('admin_season_stats');
        rows = r.rows || []; loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل المواسم.'; }
      busy = false;
      draw();
    }

    /**
     * تعيين «الموسم الحالي».
     *
     * الفهرس الفريد في القاعدة يرفض موسمين حاليّين، فلا بدّ من إنزال العلم
     * عن السابق **قبل** رفعه على الجديد. لو عكسنا الترتيب لفشلت العملية
     * وبقي الموسم القديم حاليًّا بينما تقول الواجهة إنه تغيّر.
     */
    async function setCurrent(id) {
      try {
        const prev = rows.find((r) => r.is_current && r.id !== id);
        if (prev) await Api.upsert('seasons', { id: prev.id, is_current: false });
        await Api.upsert('seasons', { id, is_current: true });
        C.toast('تغيّر الموسم الحالي');
        load();
      } catch (e) { C.toast(e.message || 'تعذّر التغيير', 'err'); }
    }

    function editor(season) {
      const isNew = !season;
      const s = season || { code: '', title: '', starts_at: '', ends_at: '' };

      const code  = C.input({ value: s.code, placeholder: '2026-2027' });
      const title = C.input({ value: s.title, placeholder: 'الموسم الدراسي ٢٠٢٦–٢٠٢٧' });
      const from  = C.input({ type: 'date', value: toDay(s.starts_at) });
      const to    = C.input({ type: 'date', value: toDay(s.ends_at) });
      const err   = h('div.badge.badge--err', { style: 'display:none' });

      const body = h('div',
        C.field('رمز الموسم', code, 'مختصر وفريد — يظهر في التقارير لا للطالب.'),
        C.field('الاسم', title, 'ما يراه الطالب في تفاصيل اشتراكه.'),
        C.field('يبدأ في', from),
        C.field('ينتهي في', to,
          'كل اشتراك يُفعَّل بكود هذا الموسم ينتهي في هذا التاريخ مهما كان تاريخ تفعيله.'),
        err);

      const show = (m) => { err.textContent = m; err.style.display = ''; };

      C.modal({
        title: isNew ? 'موسم جديد' : `تعديل: ${s.title}`,
        body,
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          // النافذة تبقى مفتوحة ما لم تُستدعَ close() — فالخطأ يُعرض داخلها
          // بدل أن تُغلق ويظنّ المستخدم أن الحفظ نجح.
          { label: isNew ? 'إنشاء' : 'حفظ', kind: 'primary', onClick: async (close) => {
            const v = {
              code: code.value.trim(), title: title.value.trim(),
              starts_at: from.value, ends_at: to.value,
            };
            if (!v.code || !v.title) return show('الرمز والاسم مطلوبان.');
            if (!v.starts_at || !v.ends_at) return show('حدّد تاريخَي البداية والنهاية.');
            // نفحصه هنا أيضًا رغم وجود القيد في القاعدة: رسالة عربية واضحة
            // أفضل من نصّ خطأ Postgres الذي لا يعني شيئًا للمستخدم.
            if (new Date(v.ends_at) <= new Date(v.starts_at)) {
              return show('تاريخ النهاية يجب أن يكون بعد البداية.');
            }
            try {
              await Api.upsert('seasons', isNew ? v : { id: s.id, ...v });
              C.toast(isNew ? 'أُنشئ الموسم' : 'حُفظ');
              close(); load();
            } catch (e) { show(e.message || 'تعذّر الحفظ.'); }
          } },
        ],
      });
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('المواسم', h('div.badge.badge--err', loadErr))); return; }

      const current = rows.find((r) => r.is_current);

      wrap.replaceChildren(
        !current && !busy && h('div.badge.badge--warn.mb',
          'لا يوجد موسم حالي — لن تستطيع إصدار أي كود حتى تحدّد واحدًا.'),

        C.card('المواسم',
          C.table(
            ['الموسم', 'المدّة', 'أُصدر', 'فُعِّل', 'مشتركون فعّالون', 'الحالة', ''],
            rows, (r) => {
              const ended = Date.parse(r.ends_at) <= Date.now();
              return [
                h('div',
                  h('div', { style: 'font-weight:600' }, r.title),
                  h('div.faint.small', r.code)),
                h('span.faint.small', `${fmtDate(r.starts_at)} ← ${fmtDate(r.ends_at)}`),
                h('span.num', ar(r.issued || 0)),
                h('span.num', ar(r.redeemed || 0)),
                h('span.num', ar(r.active_subs || 0)),
                r.is_current
                  ? h('span.badge.badge--ok', 'الحالي')
                  : ended ? h('span.badge.badge--mute', 'منتهٍ')
                          : h('span.badge.badge--mute', 'قادم'),
                C.actions(
                  // موسم منتهٍ لا يصلح حاليًّا: كوده يُرفض عند التفعيل، فلا
                  // معنى لعرض زرّ يُنتج أكوادًا ميتة.
                  !r.is_current && !ended && h('button.btn.btn--sec.btn--sm',
                    { onclick: () => setCurrent(r.id) }, 'اجعله الحالي'),
                  h('button.btn.btn--ghost.btn--sm', { onclick: () => editor(r) }, 'تعديل')),
              ];
            }, busy ? 'جارٍ التحميل…' : 'لا مواسم بعد — أنشئ الموسم الأول.'),

          h('button.btn.btn--primary.btn--sm', { onclick: () => editor(null) }, 'موسم جديد')),

        h('div.mt', C.card('لماذا المواسم',
          h('span.help',
            'قبل هذا كان الاشتراك ينتهي بعد عدد أيام من تاريخ تفعيله، فطالبٌ فعّل '
            + 'في تشرين ينتهي في تشرين وآخرُ فعّل في شباط ينتهي في شباط — مئات '
            + 'التواريخ المتفرّقة لا يمكن تنظيم حملة تجديد حولها. الآن ينتهي '
            + 'الجميع مع نهاية الموسم، فالتجديد موعد واحد.'))),
      );
    }

    load();
    return page;
  };
})();
