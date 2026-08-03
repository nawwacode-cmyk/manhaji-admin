/* =============================================================================
   editors.js — محرّر السؤال ومعاينته، مشتركان بين بنك الأسئلة ومنتقي الدرس

   كانا في الأصل داخل js/pages/questions.js فقط. لمّا صار منتقي الأسئلة في
   محرّر الدرس (content.js) يحتاج فتح نفس المحرّر ومعاينة سريعة بلا الخروج
   من الدرس، استُخرجا إلى هنا بدل تكرار ~١٧٠ سطرًا في مكانين يجب أن يتزامنا
   يدويًا مع كل تعديل مستقبلي.
   ============================================================================= */
window.Editors = (function () {
  const { h, ar } = UI;

  const TYPES = [
    ['mcq',   'اختيار من متعدد (إجابة واحدة)'],
    ['multi', 'اختيار من متعدد (عدة إجابات)'],
    ['blank', 'ملء الفراغ'],
    ['order', 'ترتيب كلمات'],
    ['match', 'مطابقة'],
    ['text',  'إجابة قصيرة'],
  ];
  const typeName = (t) => (TYPES.find((x) => x[0] === t) || [, t])[1];
  const sectionLabel = (v) => (Store.SECTIONS.find((s) => s[0] === v) || [, 'غير مصنَّف'])[1];

  /**
   * محرّر السؤال الكامل. q=null لسؤال جديد. defaults تُستعمل فقط حين q=null
   * (مثلًا: فتحه من درس معيّن يملأ حقل الدرس مسبقًا). onSaved(row) يُستدعى
   * بعد نجاح الحفظ فعليًا في قاعدة البيانات، ليحدّث المستدعي عرضه هو.
   */
  function question(q, { defaults = {}, onSaved } = {}) {
    const isNew = !q;
    q = q || { id: Store.newId(), type: 'mcq', difficulty: 3, published: true,
               lesson: defaults.lesson ?? null, section: defaults.section ?? null,
               options: [{ k: 'أ', t: '' }, { k: 'ب', t: '' }] };

    const paths = Store.lessonPaths();
    const fStem   = C.textarea({ rows: 3, value: q.stem || '', placeholder: 'نص السؤال…' });
    const fLes    = C.select([['', '— بلا درس —'], ...paths.map((l) => [l.id, l.title])], q.lesson || '');
    const fType   = C.select(TYPES, q.type);
    const fDiff   = C.select([1, 2, 3, 4, 5].map((n) => [n, ar(n)]), q.difficulty || 3);
    const fSource = C.input({ value: q.source || '', placeholder: 'كتاب الأنشطة ص ٩' });
    const fWhy    = C.textarea({ rows: 2, value: q.why || '',
                                 placeholder: 'لماذا هذه الإجابة صحيحة؟ يُعرض دائمًا بعد الإجابة.' });
    const fSec    = C.select([['', '⚠ غير مصنَّف — لن يظهر لأي طالب'], ...Store.SECTIONS], q.section || '');
    let published = q.published !== false;

    // تفريع الوحدة يتبع القسم المختار — تسميته تتغيّر (اسم موضوع الوحدة أو
    // اسم قاعدتها) رغم أن القيمة المخزَّنة نفسها (u1..u6/annexe). لذا يُعاد
    // بناؤه كلّما تغيّر القسم، لا يكفي بناؤه مرّة واحدة عند فتح المحرّر.
    const unitBox = h('div');
    function drawUnit() {
      const opts = Store.unitOptionsFor(fSec.value);
      const fUnit = C.select([['', '— بلا تفريع —'], ...opts],
        opts.some(([v]) => v === q.unitCode) ? q.unitCode : '');
      unitBox.replaceChildren(fUnit);
    }
    fSec.addEventListener('change', drawUnit);
    drawUnit();

    const answerBox = h('div');
    let state = structuredClone(q);

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
          'هذا النوع لم يُبنَ محرّره بعد في اللوحة. استخدم ملف JSON مؤقتًا، أو أخبرني لأضيفه.'));
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
          C.field('القسم', fSec,
            'تبويب «تمارين» عند الطالب. بلا قسم = السؤال مخزَّن في البنك لكن لا يراه أحد.'),
          C.field('الفرع (الوحدة)', unitBox, 'تفريع اختياري داخل القسم — يعتمد على القسم المختار أعلاه')),
        C.field('الدرس', fLes, 'اختياري — لربط السؤال بتمارين درس محدَّد بعينه'),
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
        { label: 'حفظ', kind: 'primary', onClick: async (c) => {
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
              id: q.id, lesson: fLes.value || null,
              section: fSec.value || null,
              unitCode: unitBox.querySelector('select')?.value || null,
              type, difficulty: +fDiff.value, source: fSource.value.trim() || null,
              stem: fStem.value.trim(), why: fWhy.value.trim(), published,
            };
            if (type === 'mcq' || type === 'multi') row.options = state.options;
            if (type === 'order') row.answer = state.answer;
            if (type === 'blank') { row.parts = state.parts; row.blanks = state.blanks; }

            try {
              await Store.upsert('questions', row);
              c(); C.toast(isNew ? 'أُضيف السؤال' : 'حُفظ السؤال');
              onSaved && onSaved(row);
            } catch (e) {
              C.toast('تعذّر الحفظ: ' + (e.message || ''), 'err');
            }
          } },
      ],
    });
  }

  /** معاينة سريعة للقراءة فقط — بلا فتح المحرّر الكامل ولا خطر تعديل بالخطأ. */
  function previewQuestion(q) {
    const l = Store.lessonById(q.lesson);
    let answerView;
    if (q.type === 'mcq' || q.type === 'multi') {
      answerView = h('div', ...(q.options || []).map((o) =>
        h('div.row', { style: 'gap:8px;padding:4px 0' },
          h('span', o.correct ? '✅' : '▫️'), h('span', o.t))));
    } else if (q.type === 'order') {
      answerView = h('div.mono', { dir: 'ltr', style: 'line-height:1.8' }, (q.answer || []).join(' ← '));
    } else if (q.type === 'blank') {
      answerView = h('div', (q.blanks || []).map((b, i) =>
        h('div', `فراغ ${ar(i + 1)}: ${b.accept.join(' / ')}`)));
    } else {
      answerView = h('div.help', 'لا معاينة جاهزة لهذا النوع بعد.');
    }

    C.modal({
      title: 'معاينة السؤال', wide: true,
      body: h('div',
        h('div.row.row--wrap', { style: 'gap:8px;margin-bottom:14px' },
          q.section ? h('span.badge.badge--acc', sectionLabel(q.section))
                    : h('span.badge.badge--warn', 'غير مصنَّف'),
          q.unitCode && h('span.badge.badge--mute', Store.unitLabel(q.section, q.unitCode)),
          h('span.badge.badge--mute', typeName(q.type)),
          h('span.badge.badge--mute', `الصعوبة ${ar(q.difficulty || 3)}/٥`),
          C.pubBadge(q.published !== false),
          l && h('span.badge.badge--mute', l.title)),
        h('div', { style: 'font-weight:600;font-size:16px;white-space:pre-wrap;margin-bottom:14px' }, q.stem),
        h('div.field', h('label', 'الإجابة'), answerView),
        q.why && h('div.field', { style: 'margin-top:14px' },
          h('label', 'الشرح'), h('div.muted', { style: 'white-space:pre-wrap' }, q.why))),
      actions: [{ label: 'إغلاق', kind: 'primary', onClick: (c) => c() }],
    });
  }

  return { TYPES, typeName, sectionLabel, question, previewQuestion };
})();
