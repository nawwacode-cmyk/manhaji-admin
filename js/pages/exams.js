/* =============================================================================
   الامتحانات — تجريبية ووزارية، تُركَّب من بنك الأسئلة
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  Pages.exams = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    function draw() {
      const s = Store.get();
      const group = (kind, title, note) => {
        const rows = s.exams.filter((e) => e.kind === kind);
        return C.card(title,
          C.table(['الامتحان', 'الأسئلة', 'المدة', 'حدّ النجاح', 'الحالة', ''],
            rows, (e) => [
              h('div', { style: 'font-weight:600' }, e.title),
              h('span.num', ar(e.questions.length)),
              `${ar(e.minutes)} دقيقة`,
              h('span.num', ar(e.pass) + '٪'),
              C.pubBadge(e.published),
              C.actions(
                h('button.btn.btn--sec.btn--sm', { onclick: () => edit(e) }, 'تعديل'),
                h('button.btn.btn--danger.btn--sm', {
                  onclick: () => C.confirmDialog('حذف الامتحان',
                    `سيُحذف «${e.title}». الأسئلة تبقى في البنك.`,
                    () => { Store.remove('exams', e.id); C.toast('حُذف الامتحان'); draw(); }, 'حذف'),
                }, 'حذف')),
            ], note),
          h('button.btn.btn--sec.btn--sm', { onclick: () => edit(null, kind) }, '+ إضافة'));
      };

      wrap.replaceChildren(
        h('div.grid', { style: 'gap:16px' },
          group('mock', 'امتحانات تجريبية',
            'لا امتحانات تجريبية بعد. أضف واحدًا ورتّب أسئلته من البنك.'),
          group('ministry', 'دورات وزارية',
            'لا دورات وزارية بعد. أضف دورة سابقة كما وردت.')),

        h('div.help.mt',
          'الامتحان لا يحوي أسئلة جديدة — يشير لأسئلة موجودة في البنك. '
          + 'فالسؤال يُكتب مرة ويُستعمل في التمارين والامتحان معًا، وإصلاحه يُصلحه في كل مكان.'),
      );
    }

    // =========================================================================
    function edit(exam, kind) {
      const isNew = !exam;
      exam = exam || { id: 'e' + Date.now(), kind: kind || 'mock', title: '',
                       minutes: 45, pass: 50, published: false, questions: [] };

      const fTitle = C.input({ value: exam.title, placeholder: 'الدورة الوزارية ٢٠٢٤' });
      const fKind  = C.select([['mock', 'تجريبي'], ['ministry', 'وزاري']], exam.kind);
      const fMin   = C.input({ type: 'number', value: exam.minutes, min: 5 });
      const fPass  = C.input({ type: 'number', value: exam.pass, min: 0, max: 100 });
      let published = exam.published;
      let picked = [...exam.questions];

      const pickedBox = h('div');
      const poolBox = h('div');
      let poolTopic = '';

      function drawPicked() {
        const s = Store.get();
        pickedBox.replaceChildren(
          h('div.row.mb',
            h('div.grow', { style: 'font-weight:700' }, `أسئلة الامتحان (${ar(picked.length)})`),
            picked.length > 0 && h('button.btn.btn--ghost.btn--sm', {
              onclick: () => { picked = []; drawPicked(); drawPool(); },
            }, 'إفراغ')),
          picked.length
            ? h('div', ...picked.map((id, i) => {
                const q = s.questions.find((x) => x.id === id);
                return h('div.row', {
                  style: 'padding:8px 10px;border:1px solid var(--brd);border-radius:10px;margin-bottom:6px',
                },
                  h('span.badge.badge--mute', ar(i + 1)),
                  h('div.grow.small', q ? q.stem.slice(0, 58) + (q.stem.length > 58 ? '…' : '')
                                        : h('span.badge.badge--err', 'سؤال محذوف')),
                  h('button.btn.btn--ghost.btn--sm', {
                    title: 'أعلى', disabled: i === 0,
                    onclick: () => { [picked[i - 1], picked[i]] = [picked[i], picked[i - 1]]; drawPicked(); },
                  }, '▲'),
                  h('button.btn.btn--ghost.btn--sm', {
                    title: 'أسفل', disabled: i === picked.length - 1,
                    onclick: () => { [picked[i + 1], picked[i]] = [picked[i], picked[i + 1]]; drawPicked(); },
                  }, '▼'),
                  h('button.btn.btn--ghost.btn--sm', {
                    onclick: () => { picked.splice(i, 1); drawPicked(); drawPool(); },
                  }, '✕'));
              }))
            : h('div.help', { style: 'padding:16px;text-align:center;border:1px dashed var(--brd2);border-radius:10px' },
                'لم تُضف أسئلة بعد — اخترها من البنك على اليمين.'));
      }

      function drawPool() {
        const s = Store.get();
        let list = s.questions.filter((q) => !picked.includes(q.id) && q.published !== false);
        if (poolTopic) list = list.filter((q) => q.topic === poolTopic);

        const sel = C.select([['', 'كل المواضيع'], ...SEED.topics.map((t) => [t.id, t.name])], poolTopic);
        sel.addEventListener('change', () => { poolTopic = sel.value; drawPool(); });

        poolBox.replaceChildren(
          h('div.row.mb', h('div.grow', { style: 'font-weight:700' }, 'بنك الأسئلة'), sel),
          h('div', { style: 'max-height:340px;overflow-y:auto' },
            list.length
              ? h('div', ...list.map((q) => h('div.row', {
                  style: 'padding:8px 10px;border:1px solid var(--brd);border-radius:10px;margin-bottom:6px',
                },
                  h('div.grow.small',
                    h('div', q.stem.slice(0, 52) + (q.stem.length > 52 ? '…' : '')),
                    h('div.faint', { style: 'font-size:12px' },
                      `${Store.topicName(q.topic)} · صعوبة ${ar(q.difficulty || 3)}`)),
                  h('button.btn.btn--sec.btn--sm', {
                    onclick: () => { picked.push(q.id); drawPicked(); drawPool(); },
                  }, 'إضافة'))))
              : h('div.help', { style: 'padding:14px;text-align:center' },
                  'لا أسئلة متاحة بهذا المرشّح.')));
      }

      drawPicked(); drawPool();

      C.modal({
        title: isNew ? 'امتحان جديد' : 'تعديل الامتحان',
        wide: true,
        body: h('div',
          h('div.grid.grid--2',
            C.field('عنوان الامتحان', fTitle),
            C.field('النوع', fKind, 'الوزاري يظهر بوسم مميّز للطالب')),
          h('div.grid.grid--2',
            C.field('المدة بالدقائق', fMin),
            C.field('حدّ النجاح ٪', fPass)),
          h('div.grid.grid--2', { style: 'align-items:start' }, pickedBox, poolBox),
          h('div.mt', C.checkbox('منشور للطلاب', published, (v) => { published = v; }))),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: (c) => {
              if (!fTitle.value.trim()) return C.toast('العنوان مطلوب', 'err');
              if (!picked.length) return C.toast('أضف سؤالًا واحدًا على الأقل', 'err');
              Store.upsert('exams', {
                id: exam.id, kind: fKind.value, title: fTitle.value.trim(),
                minutes: +fMin.value || 45, pass: +fPass.value || 50,
                published, questions: picked,
              });
              c(); C.toast('حُفظ الامتحان'); draw();
            } },
        ],
      });
    }

    draw();
    return page;
  };
})();
