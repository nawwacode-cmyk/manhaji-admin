/* =============================================================================
   الطلاب — قائمة، تفاصيل، وفكّ ارتباط الجهاز
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  Pages.students = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let search = '';
    let filter = 'all';   // all | nodevice | inactive

    function draw() {
      const s = Store.get();
      let rows = s.students;
      if (search) rows = rows.filter((x) => x.username.includes(search));
      if (filter === 'nodevice') rows = rows.filter((x) => !x.device);
      if (filter === 'inactive') rows = rows.filter((x) => x.lastSeen.includes('أيام'));

      const inp = C.input({ placeholder: 'ابحث باسم المستخدم…', value: search });
      inp.addEventListener('input', () => {
        search = inp.value.trim();
        clearTimeout(inp._t); inp._t = setTimeout(draw, 250);
      });

      const chip = (id, label) => h('button.btn.btn--sm' + (filter === id ? '.btn--primary' : '.btn--sec'),
        { onclick: () => { filter = id; draw(); } }, label);

      const noDevice = s.students.filter((x) => !x.device).length;

      wrap.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('الطلاب', ar(s.students.length)),
          C.kpi('بلا جهاز مرتبط', ar(noDevice),
                noDevice ? 'لا يستطيعون الدخول' : 'الجميع يستطيع الدخول',
                noDevice ? 'var(--err)' : undefined),
          C.kpi('متوسط التقدّم',
                ar(Math.round(s.students.reduce((a, x) => a + x.progress, 0) / (s.students.length || 1))) + '٪')),

        h('div.row.row--wrap.mb',
          h('div.grow', { style: 'min-width:220px' }, inp),
          chip('all', 'الكل'),
          chip('nodevice', `بلا جهاز (${ar(noDevice)})`),
          chip('inactive', 'غير نشط')),

        C.card(null,
          C.table(['الطالب', 'الصف', 'الجهاز', 'التقدّم', 'التمارين', 'أفضل امتحان', 'آخر ظهور', ''],
            rows, (x) => [
              h('div',
                h('div', { style: 'font-weight:600' }, x.username),
                h('div.faint.small', `اشترك ${x.joined} · متبقٍ ${ar(x.daysLeft)} يومًا`)),
              (SEED.grades.find((g) => g.id === x.grade) || {}).name,
              x.device
                ? h('div.small', x.device)
                : h('span.badge.badge--err', 'غير مرتبط'),
              h('div.row',
                h('div.bar', { style: 'width:64px' }, h('i', { style: `width:${x.progress}%` })),
                h('span.num.small', ar(x.progress) + '٪')),
              h('div', h('span.num', ar(x.attempts)),
                h('div.faint.small', `${ar(x.correct)}٪ صواب`)),
              x.bestExam
                ? h('span.badge.' + (x.bestExam >= 50 ? 'badge--ok' : 'badge--warn'), ar(x.bestExam) + '٪')
                : h('span.faint.small', '—'),
              h('span.faint.small', x.lastSeen),
              C.actions(h('button.btn.btn--sec.btn--sm', { onclick: () => detail(x) }, 'تفاصيل')),
            ], 'لا طلاب مطابقون.'),
          h('span.badge.badge--acc', `${ar(rows.length)} طالب`)),
      );
    }

    // =========================================================================
    function detail(x) {
      const grade = (SEED.grades.find((g) => g.id === x.grade) || {}).name;
      const batch = Store.get().batches.find((b) => b.id === x.batch);

      C.modal({
        title: x.username,
        body: h('div',
          h('div.grid.grid--3.mb',
            C.kpi('التقدّم', ar(x.progress) + '٪'),
            C.kpi('التمارين', ar(x.attempts), `${ar(x.correct)}٪ صواب`),
            C.kpi('أفضل امتحان', x.bestExam ? ar(x.bestExam) + '٪' : '—')),

          C.card('الاشتراك', h('div',
            h('div.row', { style: 'padding:6px 0' },
              h('div.grow.small', 'الصف'), h('b', grade)),
            h('div.row', { style: 'padding:6px 0;border-top:1px solid var(--brd)' },
              h('div.grow.small', 'تاريخ الاشتراك'), h('span.mono.small', x.joined)),
            h('div.row', { style: 'padding:6px 0;border-top:1px solid var(--brd)' },
              h('div.grow.small', 'المتبقي'), h('b', `${ar(x.daysLeft)} يومًا`)),
            h('div.row', { style: 'padding:6px 0;border-top:1px solid var(--brd)' },
              h('div.grow.small', 'الدفعة'),
              h('span.small', batch ? `${batch.label} — ${batch.distributor || ''}` : '—')))),

          // --- الجهاز: أهم قسم في هذه النافذة -----------------------------
          // بلا بريد ولا كلمة سر، هذا الزر هو مسار الاسترداد الوحيد للطالب
          // الذي انكسر هاتفه. بدونه يبقى مقفلًا خارج اشتراكه المدفوع.
          h('div.mt',
            C.card('الجهاز المرتبط', h('div',
              x.device
                ? h('div',
                    h('div.row.mb',
                      h('div.grow',
                        h('div', { style: 'font-weight:600' }, x.device),
                        h('div.faint.small', `آخر ظهور: ${x.lastSeen}`)),
                      h('span.badge.badge--ok', 'مرتبط')),
                    h('div.help.mb',
                      'فكّ الارتباط يسمح للطالب بالدخول من جهاز جديد بنفس الكود. '
                      + 'استعمله حين ينكسر هاتفه أو يعيد ضبطه.'),
                    h('button.btn.btn--danger', {
                      onclick: () => C.confirmDialog('فكّ ارتباط الجهاز',
                        `سيتمكّن «${x.username}» من الدخول بكوده على جهاز جديد، `
                        + 'وسيخرج من الجهاز الحالي فورًا. متابعة؟',
                        () => {
                          Store.upsert('students', { id: x.id, device: null });
                          C.toast('فُكّ ارتباط الجهاز'); draw();
                          document.querySelector('.scrim')?.remove();
                        }, 'فكّ الارتباط'),
                    }, 'فكّ ارتباط الجهاز'))
                : h('div',
                    h('div.badge.badge--warn.mb', 'لا جهاز مرتبط'),
                    h('div.help',
                      'الطالب لم يدخل بعد، أو فُكّ ارتباط جهازه. سيرتبط الجهاز '
                      + 'تلقائيًا عند أول دخول بالكود.'))))),
        ),
        actions: [{ label: 'إغلاق', onClick: (c) => c() }],
      });
    }

    draw();
    return page;
  };
})();
