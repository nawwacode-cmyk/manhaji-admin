/* =============================================================================
   أكواد التفعيل — توليد دفعات وتصدير CSV للموزّعين
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  // أبجدية بلا أحرف ملتبسة: لا 0/O ولا 1/I/L ولا 5/S.
  // السبب عملي بحت — هذه الأكواد تُطبع على ورق ويُدخلها طالب مستعجل.
  const ALPHA = 'ACDEFGHJKMNPQRTUVWXY2346789';
  const rand = (n) => Array.from({ length: n }, () =>
    ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

  const prefixOf = (grade) => (grade === 'g12' ? 'F12' : 'FR9');

  Pages.codes = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    function draw() {
      const s = Store.get();
      const total = s.batches.reduce((a, b) => a + b.qty, 0);
      const used = s.batches.reduce((a, b) => a + b.used, 0);

      wrap.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('أكواد مولَّدة', ar(total)),
          C.kpi('مستعمَلة', ar(used), `${ar(total - used)} متاح`),
          C.kpi('الدفعات', ar(s.batches.length))),

        C.card('دفعات الأكواد',
          C.table(['الدفعة', 'الموزّع', 'الصف', 'العدد', 'المستعمَل', 'المدة', 'التاريخ', ''],
            s.batches, (b) => [
              h('div', { style: 'font-weight:600' }, b.label),
              h('div', b.distributor || '—',
                b.phone && h('div.faint.small.mono', b.phone)),
              (SEED.grades.find((g) => g.id === b.grade) || {}).name || 'الكل',
              h('span.num', ar(b.qty)),
              h('div.row',
                h('div.bar', { style: 'width:70px' },
                  h('i', { style: `width:${Math.round((b.used / b.qty) * 100)}%` })),
                h('span.num.small', ar(b.used))),
              `${ar(b.days)} يوم`,
              h('span.faint.small.mono', b.created),
              C.actions(
                h('button.btn.btn--sec.btn--sm', { onclick: () => exportCsv(b) }, 'تصدير CSV'),
                h('button.btn.btn--danger.btn--sm', {
                  onclick: () => C.confirmDialog('حذف الدفعة',
                    `ستُحذف «${b.label}» و${ar(b.qty)} كودًا معها. الأكواد المستعملة `
                    + 'تفقد ارتباطها بالدفعة. لا يمكن التراجع.',
                    () => { Store.remove('batches', b.id); C.toast('حُذفت الدفعة'); draw(); }, 'حذف'),
                }, 'حذف')),
            ], 'لا دفعات بعد. ولّد دفعتك الأولى لتبيعها عبر موزّع.'),
          h('button.btn.btn--primary.btn--sm', { onclick: generate }, '+ توليد دفعة')),

        h('div.help.mt',
          'الأكواد تُخزَّن في قاعدة البيانات **مجزَّأة (hashed)** لا بنصّها الصريح — '
          + 'تسريب قاعدة البيانات لا يعطي كودًا صالحًا واحدًا. لذلك ملف CSV الذي '
          + 'تصدّره هنا هو النسخة الوحيدة من الأكواد: سلّمه للموزّع ثم احذفه.'),
      );
    }

    // =========================================================================
    function generate() {
      const fLabel = C.input({ placeholder: 'مكتبة النور — أيلول ٢٠٢٦' });
      const fDist  = C.input({ placeholder: 'أبو أحمد' });
      const fPhone = C.input({ placeholder: '0933000000', dir: 'ltr' });
      const fQty   = C.input({ type: 'number', value: 50, min: 1, max: 5000 });
      const fGrade = C.select(SEED.grades.map((g) => [g.id, g.name]), 'g9');
      const fDays  = C.input({ type: 'number', value: 365, min: 30 });

      C.modal({
        title: 'توليد دفعة أكواد',
        body: h('div',
          C.field('اسم الدفعة', fLabel, 'يظهر لك فقط — للتمييز بين الموزّعين'),
          h('div.grid.grid--2',
            C.field('اسم الموزّع', fDist),
            C.field('هاتف الموزّع', fPhone)),
          h('div.grid.grid--3',
            C.field('عدد الأكواد', fQty),
            C.field('الصف', fGrade),
            C.field('مدة الاشتراك (يوم)', fDays)),
          h('div.help',
            'الكود يفتح على جهاز واحد. الأحرف الملتبسة (0/O و1/I) مستبعدة من '
            + 'الأبجدية أصلًا حتى لا يخطئ الطالب في قراءتها من البطاقة.')),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'توليد وتصدير', kind: 'primary', onClick: (c) => {
              const qty = +fQty.value;
              if (!fLabel.value.trim()) return C.toast('اسم الدفعة مطلوب', 'err');
              if (!qty || qty < 1 || qty > 5000) return C.toast('العدد بين ١ و ٥٠٠٠', 'err');

              const batch = {
                id: 'b' + Date.now(), label: fLabel.value.trim(),
                distributor: fDist.value.trim(), phone: fPhone.value.trim(),
                qty, used: 0, grade: fGrade.value, days: +fDays.value || 365,
                created: new Date().toISOString().slice(0, 10),
              };
              Store.upsert('batches', batch);
              c();
              exportCsv(batch, true);
              C.toast(`وُلّد ${ar(qty)} كود`);
              draw();
            } },
        ],
      });
    }

    /**
     * تصدير الأكواد. في النسخة الحقيقية تُولَّد على السيرفر وتُخزَّن تجزئتها
     * فقط؛ هنا نولّدها في المتصفح لأن اللوحة ما زالت بلا Supabase.
     */
    function exportCsv(batch, isNew) {
      const gradeName = (SEED.grades.find((g) => g.id === batch.grade) || {}).name || '';
      const p = prefixOf(batch.grade);
      const seen = new Set();
      const codes = [];
      while (codes.length < batch.qty) {
        const code = `${p}-${rand(4)}-${rand(4)}`;
        if (seen.has(code)) continue;
        seen.add(code); codes.push(code);
      }
      const rows = ['الكود,الصف,المدة بالأيام,الدفعة,الموزّع',
        ...codes.map((c) => `${c},${gradeName},${batch.days},"${batch.label}","${batch.distributor || ''}"`)];
      C.download(`codes-${batch.id}.csv`, rows.join('\n'));

      if (isNew) {
        C.modal({
          title: 'احفظ ملف الأكواد الآن',
          body: h('div',
            h('div.badge.badge--warn', { style: 'margin-bottom:12px' }, 'تنبيه مهم'),
            h('p', 'نُزّل ملف CSV يحتوي الأكواد الصريحة. هذه ',
              h('b', 'النسخة الوحيدة'), ' — قاعدة البيانات تخزّن تجزئتها فقط ولا يمكن '
              + 'استعادتها منها.'),
            h('p.muted.small', 'سلّم الملف للموزّع، ثم احذفه من جهازك بعد التسليم.')),
          actions: [{ label: 'فهمت', kind: 'primary', onClick: (c) => c() }],
        });
      }
    }

    draw();
    return page;
  };
})();
