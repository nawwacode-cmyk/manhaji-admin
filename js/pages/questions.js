/* =============================================================================
   بنك الأسئلة — جدول + محرّر يدعم الأنواع الستة
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, fr, ar } = UI;

  const TYPES = [
    ['mcq',   'اختيار من متعدد (إجابة واحدة)'],
    ['multi', 'اختيار من متعدد (عدة إجابات)'],
    ['blank', 'ملء الفراغ'],
    ['order', 'ترتيب كلمات'],
    ['match', 'مطابقة'],
    ['text',  'إجابة قصيرة'],
  ];
  const typeName = (t) => (TYPES.find((x) => x[0] === t) || [, t])[1];

  Pages.questions = (params = {}) => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let fLesson = params.lesson || '';
    let fTopic = '';
    let search = '';

    function draw() {
      const s = Store.get();
      const paths = Store.lessonPaths();

      let rows = s.questions;
      if (fLesson) rows = rows.filter((q) => q.lesson === fLesson);
      if (fTopic)  rows = rows.filter((q) => q.topic === fTopic);
      if (search)  rows = rows.filter((q) => q.stem.includes(search));

      const selLesson = C.select([['', 'كل الدروس'], ...paths.map((l) => [l.id, `${l.title}`])], fLesson);
      selLesson.addEventListener('change', () => { fLesson = selLesson.value; draw(); });

      const selTopic = C.select([['', 'كل المواضيع'], ...SEED.topics.map((t) => [t.id, t.name])], fTopic);
      selTopic.addEventListener('change', () => { fTopic = selTopic.value; draw(); });

      const inpSearch = C.input({ placeholder: 'ابحث في نص السؤال…', value: search });
      inpSearch.addEventListener('input', () => {
        search = inpSearch.value.trim();
        clearTimeout(inpSearch._t);
        inpSearch._t = setTimeout(draw, 250);
      });

      wrap.replaceChildren(
        h('div.row.row--wrap.mb',
          h('div', { style: 'width:230px' }, selLesson),
          h('div', { style: 'width:190px' }, selTopic),
          h('div.grow', { style: 'min-width:200px' }, inpSearch),
          h('button.btn.btn--primary', { onclick: () => edit(null) }, '+ سؤال جديد')),

        C.card(null,
          C.table(['السؤال', 'الدرس', 'الموضوع', 'النوع', 'الصعوبة', 'الحالة', ''],
            rows, (q) => {
              const l = Store.lessonById(q.lesson);
              return [
                h('div', { style: 'max-width:380px' },
                  h('div', { style: 'font-weight:600' }, q.stem.slice(0, 70) + (q.stem.length > 70 ? '…' : '')),
                  q.source && h('div.faint.small', q.source)),
                l ? l.title : h('span.badge.badge--warn', 'بلا درس'),
                Store.topicName(q.topic),
                h('span.badge.badge--mute', typeName(q.type).split(' ')[0]),
                h('span.num', ar(q.difficulty || 3) + '/٥'),
                C.pubBadge(q.published !== false),
                C.actions(
                  h('button.btn.btn--sec.btn--sm', { onclick: () => edit(q) }, 'تعديل'),
                  h('button.btn.btn--danger.btn--sm', {
                    onclick: () => C.confirmDialog('حذف السؤال',
                      'سيُحذف السؤال من البنك ومن أي امتحان يستخدمه.',
                      () => { Store.remove('questions', q.id); C.toast('حُذف السؤال'); draw(); }, 'حذف'),
                  }, 'حذف')),
              ];
            }, 'لا أسئلة مطابقة. جرّب تغيير المرشّحات أو أضف سؤالًا جديدًا.'),
          h('span.badge.badge--acc', `${ar(rows.length)} سؤال`)),
      );
    }

    // =========================================================================
    // محرّر السؤال
    // =========================================================================
    function edit(q) {
      const isNew = !q;
      q = q || { id: 'q' + Date.now(), type: 'mcq', difficulty: 3, published: true,
                 options: [{ k: 'أ', t: '' }, { k: 'ب', t: '' }] };

      const paths = Store.lessonPaths();
      const fStem   = C.textarea({ rows: 3, value: q.stem || '', placeholder: 'نص السؤال…' });
      const fLes    = C.select([['', '— بلا درس —'], ...paths.map((l) => [l.id, l.title])], q.lesson || '');
      const fTop    = C.select(SEED.topics.map((t) => [t.id, t.name]), q.topic || 'salutations');
      const fType   = C.select(TYPES, q.type);
      const fDiff   = C.select([1, 2, 3, 4, 5].map((n) => [n, ar(n)]), q.difficulty || 3);
      const fSource = C.input({ value: q.source || '', placeholder: 'كتاب الأنشطة ص ٩' });
      const fWhy    = C.textarea({ rows: 2, value: q.why || '',
                                   placeholder: 'لماذا هذه الإجابة صحيحة؟ يُعرض دائمًا بعد الإجابة.' });
      let published = q.published !== false;

      const answerBox = h('div');
      let state = structuredClone(q);

      // --- محرّر الإجابة حسب النوع ---
      function drawAnswer() {
        const type = fType.value;
        answerBox.replaceChildren();

        if (type === 'mcq' || type === 'multi') {
          state.options = state.options?.length ? state.options : [{ k: 'أ', t: '' }, { k: 'ب', t: '' }];
          const list = h('div');
          state.options.forEach((o, i) => {
            const t = C.input({ value: o.t, placeholder: `الخيار ${o.k}`, style: 'flex:1' });
            t.addEventListener('input', () => { state.options[i].t = t.value; });
            const mark = h('button.btn.btn--sm' + (o.correct ? '.btn--primary' : '.btn--sec'),
              { title: 'علّم كإجابة صحيحة' }, o.correct ? '✓ صحيح' : 'صحيح؟');
            mark.addEventListener('click', () => {
              if (type === 'mcq') state.options.forEach((x, j) => { x.correct = j === i; });
              else state.options[i].correct = !state.options[i].correct;
              drawAnswer();
            });
            list.appendChild(h('div.row', { style: 'margin-bottom:8px' },
              h('span.badge.badge--mute', o.k), t, mark,
              state.options.length > 2 && h('button.btn.btn--ghost.btn--sm', {
                onclick: () => { state.options.splice(i, 1); drawAnswer(); },
              }, '✕')));
          });
          answerBox.append(list,
            h('button.btn.btn--sec.btn--sm', {
              onclick: () => {
                const ks = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
                state.options.push({ k: ks[state.options.length] || String(state.options.length + 1), t: '' });
                drawAnswer();
              },
            }, '+ خيار'),
            h('div.help', { style: 'margin-top:8px' },
              type === 'mcq' ? 'إجابة صحيحة واحدة فقط.' : 'يمكن تعليم أكثر من إجابة صحيحة.'));

        } else if (type === 'order') {
          const words = C.input({ value: (state.answer || []).join(' '),
                                  placeholder: 'Je ne suis pas professeur', dir: 'ltr' });
          words.addEventListener('input', () => {
            state.answer = words.value.trim().split(/\s+/).filter(Boolean);
          });
          answerBox.append(C.field('الجملة بترتيبها الصحيح', words,
            'يُقسّمها التطبيق كلمات ويخلطها على الطالب ليعيد ترتيبها.'));

        } else if (type === 'blank') {
          const tpl = C.input({
            value: state._tpl || partsToTemplate(state.parts),
            placeholder: 'Je ___ étudiant et tu ___ professeur.', dir: 'ltr',
          });
          const answers = C.input({
            value: (state.blanks || []).map((b) => b.accept.join('|')).join(' , '),
            placeholder: 'suis , es', dir: 'ltr',
          });
          const sync = () => {
            state._tpl = tpl.value;
            state.parts = templateToParts(tpl.value);
            state.blanks = answers.value.split(',').map((x) => ({
              accept: x.split('|').map((y) => y.trim()).filter(Boolean),
              choices: x.split('|').map((y) => y.trim()).filter(Boolean),
            })).filter((b) => b.accept.length);
          };
          tpl.addEventListener('input', sync);
          answers.addEventListener('input', sync);
          answerBox.append(
            C.field('الجملة مع فراغات', tpl, 'اكتب ___ (ثلاث شرطات) مكان كل فراغ.'),
            C.field('الإجابات بالترتيب', answers,
              'افصل بين الفراغات بفاصلة، وبين بدائل الفراغ الواحد بـ | — مثل: a|à , est'));

        } else {
          answerBox.append(h('div.help',
            'هذا النوع لم يُبنَ محرّره بعد في اللوحة. استخدم ملف JSON مؤقتًا، '
            + 'أو أخبرني لأضيفه.'));
        }
      }

      const partsToTemplate = (parts) => !parts ? ''
        : parts.map((p) => (typeof p === 'string' ? p : '___')).join('');
      const templateToParts = (tpl) => {
        const out = []; let i = 0;
        tpl.split('___').forEach((chunk, n, arr) => {
          if (chunk) out.push(chunk);
          if (n < arr.length - 1) out.push({ blank: i++ });
        });
        return out;
      };

      fType.addEventListener('change', drawAnswer);
      drawAnswer();

      C.modal({
        title: isNew ? 'سؤال جديد' : 'تعديل السؤال',
        wide: true,
        body: h('div',
          h('div.grid.grid--2',
            C.field('الدرس', fLes, 'يظهر السؤال في «تمارين هذا الدرس»'),
            C.field('الموضوع', fTop, 'يغذّي خريطة الإتقان — إلزامي')),
          h('div.grid.grid--3',
            C.field('النوع', fType),
            C.field('الصعوبة', fDiff),
            C.field('المصدر', fSource, 'اختياري')),
          C.field('نص السؤال', fStem),
          C.field('الإجابة', answerBox),
          C.field('الشرح', fWhy,
            'يُعرض بعد الإجابة — عند الخطأ وعند الصواب معًا. الطالب الذي خمّن صحيحًا يحتاجه أيضًا.'),
          C.checkbox('منشور', published, (v) => { published = v; })),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: (c) => {
              if (!fStem.value.trim()) return C.toast('نص السؤال مطلوب', 'err');
              const type = fType.value;
              if ((type === 'mcq' || type === 'multi')) {
                if (state.options.some((o) => !o.t.trim())) return C.toast('املأ نص كل الخيارات', 'err');
                if (!state.options.some((o) => o.correct)) return C.toast('علّم الإجابة الصحيحة', 'err');
                if (type === 'mcq' && state.options.filter((o) => o.correct).length > 1)
                  return C.toast('نوع «إجابة واحدة» يقبل خيارًا صحيحًا واحدًا', 'err');
              }
              if (type === 'blank' && !(state.blanks || []).length)
                return C.toast('أدخل إجابات الفراغات', 'err');
              if (type === 'order' && !(state.answer || []).length)
                return C.toast('أدخل الجملة الصحيحة', 'err');

              const row = {
                id: q.id, lesson: fLes.value || null, topic: fTop.value,
                type, difficulty: +fDiff.value, source: fSource.value.trim() || null,
                stem: fStem.value.trim(), why: fWhy.value.trim(), published,
              };
              if (type === 'mcq' || type === 'multi') row.options = state.options;
              if (type === 'order') row.answer = state.answer;
              if (type === 'blank') { row.parts = state.parts; row.blanks = state.blanks; }

              Store.upsert('questions', row);
              c(); C.toast(isNew ? 'أُضيف السؤال' : 'حُفظ السؤال'); draw();
            } },
        ],
      });
    }

    draw();
    return page;
  };
})();
