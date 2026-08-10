/* =============================================================================
   المحتوى — كتب ← وحدات ← دروس، ومحرّر الدرس
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, fr, ar, icon } = UI;
  const { sectionLabel } = Editors;

  Pages.content = (params = {}) => {
    const page = h('div.content');
    const wrap = h('div.wrap.grid.grid--side');
    page.appendChild(wrap);

    let selected = params.lesson || Store.get().lessons[0]?.id || null;
    const treeBox = h('div');
    const editBox = h('div');
    wrap.append(editBox, treeBox);   // RTL: الشجرة على اليمين

    // =========================================================================
    // الشجرة
    // =========================================================================
    function drawTree() {
      const s = Store.get();
      const tree = h('div.tree');

      s.books.forEach((b) => {
        const bookEl = h('div.tree__book');
        bookEl.appendChild(h('div.tree__bh',
          h('div.grow', b.title),
          C.pubBadge(b.published),
          h('button.btn.btn--ghost.btn--sm', {
            title: 'تعديل الكتاب', onclick: () => editBook(b),
          }, '✎'),
          h('button.btn.btn--ghost.btn--sm', {
            title: 'إضافة وحدة', onclick: () => editUnit(null, b.id),
          }, '+ وحدة')));

        Store.unitsOf(b.id).forEach((u) => {
          const lessons = Store.lessonsOf(u.id);
          const det = h('details', { open: true });
          det.appendChild(h('summary.tree__uh',
            h('div.grow', u.title),
            h('span.faint.small', `${ar(lessons.length)} دروس`),
            h('button.btn.btn--ghost.btn--sm', {
              onclick: (e) => { e.preventDefault(); e.stopPropagation(); editUnit(u); },
            }, '✎')));

          lessons.forEach((l) => det.appendChild(h('div.tree__lesson' + (l.id === selected ? '.is-on' : ''), {
            onclick: () => { selected = l.id; drawTree(); drawEditor(); },
          },
            h('div.tree__n', ar(l.order)),
            h('div.grow', l.title),
            !l.published && h('span.badge.badge--mute', 'مسوّدة'),
            !l.video && h('span.badge.badge--warn', 'بلا فيديو'))));

          det.appendChild(h('div', { style: 'padding:8px 16px 12px 46px' },
            h('button.btn.btn--sec.btn--sm.btn--block', {
              onclick: () => newLesson(u.id),
            }, '+ درس جديد')));

          bookEl.appendChild(h('div.tree__unit', det));
        });

        tree.appendChild(bookEl);
      });

      treeBox.replaceChildren(
        C.card('بنية المنهاج', tree,
          h('button.btn.btn--sec.btn--sm', { onclick: () => editBook(null) }, '+ كتاب')),
      );
    }

    // =========================================================================
    // محرّر الدرس
    // =========================================================================
    function drawEditor() {
      const l = Store.lessonById(selected);
      if (!l) {
        editBox.replaceChildren(C.card('الدرس',
          h('div.center.muted', { style: 'padding:40px' }, 'اختر درسًا من الشجرة أو أنشئ درسًا جديدًا.')));
        return;
      }

      const s = Store.get();
      const unit = s.units.find((u) => u.id === l.unit);

      // --- بيانات الدرس ---
      // مُبسَّطة عمدًا لهذه المرحلة: الفيديو ورقم الصفحة والمواضيع الفرعية
      // للدرس عناصر غير موصولة بعد (الفيديو) أو غير مُستهلَكة فعليًا في
      // تطبيق الطالب (lesson_topics لا تُقرأ في أي شاشة حاليًا) — إعادتها
      // تنتظر إعادة بناء اللوحة لاحقًا.
      const fTitle   = C.input({ value: l.title });
      const fOrder   = C.input({ type: 'number', value: l.order, min: 1, style: 'width:90px' });
      const fMinutes = C.input({ type: 'number', value: l.minutes, min: 1, style: 'width:90px' });
      const fUnit    = C.select(s.units.map((u) => [u.id, u.title]), l.unit);

      let free = l.free, published = l.published;

      // --- محرّر النص الغني ---
      const area = h('div.editor__area', { contenteditable: 'true', html: l.body || '' });

      const cmd = (c, v) => { area.focus(); document.execCommand(c, false, v); };
      const insert = (html) => { area.focus(); document.execCommand('insertHTML', false, html); };

      /**
       * زر «فرنسي» هو أهم زر في هذا المحرّر.
       * يلفّ النص المحدّد بـ <span class="fr"> فيُعزل اتجاهيًا داخل الجملة
       * العربية. بدونه تقفز علامات الترقيم إلى الطرف الخطأ، وهو أكثر عيب
       * يتكرّر في المحتوى العربي/الفرنسي المختلط.
       */
      function wrapFrench() {
        const sel = window.getSelection();
        const text = String(sel).trim();
        if (!text) return C.toast('حدّد النص الفرنسي أولًا', 'err');
        insert(`<span class="fr">${text}</span>&nbsp;`);
      }

      const bar = h('div.editor__bar',
        h('button', { title: 'عنوان فرعي', onclick: () => cmd('formatBlock', '<h3>') }, 'عنوان'),
        h('button', { title: 'عريض', onclick: () => cmd('bold') }, h('b', 'ب')),
        h('button', { title: 'قائمة', onclick: () => cmd('insertUnorderedList') }, '• قائمة'),
        h('button', { title: 'نص فرنسي معزول اتجاهيًا', onclick: wrapFrench },
          h('span.fr', 'Fr'), ' فرنسي'),
        h('button', {
          title: 'جدول ٣ صفوف', onclick: () => insert(
            '<table><tr><th>الفرنسية</th><th>العربية</th></tr>'
            + '<tr><td>—</td><td>—</td></tr><tr><td>—</td><td>—</td></tr></table><p></p>'),
        }, 'جدول'),
        h('button', {
          title: 'تنبيه ملوّن', onclick: () => insert(
            '<div class="callout"><b>خطأ شائع:</b> اكتب التنبيه هنا…</div><p></p>'),
        }, 'تنبيه'),
        h('button', { title: 'إزالة التنسيق', onclick: () => cmd('removeFormat') }, 'تنظيف'));

      async function save(publishState) {
        if (!fTitle.value.trim()) { fTitle.classList.add('is-err'); return C.toast('العنوان مطلوب', 'err'); }
        try {
          await Store.upsert('lessons', {
            id: l.id, code: l.code, unit: fUnit.value, order: +fOrder.value || 1,
            title: fTitle.value.trim(), minutes: +fMinutes.value || 10,
            free, published: publishState !== undefined ? publishState : published,
            body: area.innerHTML,
          });
          C.toast('حُفظ الدرس');
          drawTree(); drawEditor();
        } catch (e) {
          C.toast('تعذّر حفظ الدرس: ' + (e.message || ''), 'err');
        }
      }

      /* --- فيديو الدرس ---------------------------------------------------
         حالتان فقط: مربوط أو لا. لا نجلب المكتبة كاملة هنا — المحرِّر في
         سياق درسٍ بعينه، وقائمة بعشرات الفيديوهات تُبطئ الفتح وتشتّت عن
         السؤال الوحيد: هل لهذا الدرس فيديو؟ */
      function videoRow() {
        const box = h('div');
        const refresh = async () => {
          // نقرأ من القاعدة لا من الحالة المحلّية: الرفع يكتب `video_id`
          // مباشرةً، والحالة هنا قد تكون أقدم منه.
          let vid = null;
          try {
            const [row] = await Api.from('lessons',
              { select: 'video_id', id: `eq.${l.id}` });
            if (row?.video_id) {
              const [v] = await Api.from('videos',
                { select: 'id,title,duration_s,size_bytes,quality', id: `eq.${row.video_id}` });
              vid = v || null;
            }
          } catch { /* العرض أدناه يتصرّف كأنه بلا فيديو */ }
          render(vid);
        };

        /* بنفس شكل صفّ الملفّات: عنوانٌ ومعلوماتٌ وأزرارٌ في سطرٍ مفصول.
           الفيديو والملفّات شيئان من نوعٍ واحد في ذهن المحرِّر — «ما أرفقتُه
           بالدرس» — فاختلاف شكلهما يجعله يبحث عن زرّ الحذف في أحدهما لأنه
           رآه في الآخر. */
        const render = (v) => box.replaceChildren(
          v
            ? h('div.row', {
                style: 'gap:10px;align-items:center;flex-wrap:wrap;'
                     + 'padding:8px 0;border-top:1px solid var(--brd)',
              },
                h('span.badge.badge--ok', 'مربوط'),
                h('div.grow', h('div.small', { style: 'font-weight:600' }, v.title),
                  h('div.faint.small',
                    `${v.quality} · ${v.duration_s
                      ? Math.floor(v.duration_s / 60) + ':' + String(v.duration_s % 60).padStart(2, '0')
                      : '—'} · ${ar(Math.round((v.size_bytes || 0) / 1048576))} م.ب`)),
                h('button.btn.btn--ghost.btn--sm', {
                  onclick: () => C.confirmDialog('فكّ الفيديو',
                    'يُفصل الفيديو عن هذا الدرس. الملفّ يبقى في المكتبة ويمكن ربطه بدرس آخر.',
                    async () => {
                      try {
                        await Api.update('lessons', l.id, { video_id: null });
                        C.toast('فُكّ الفيديو'); refresh();
                      } catch (e) { C.toast(e.message || 'تعذّر الفكّ', 'err'); }
                    }, 'فكّ'),
                }, 'فكّ'),
                h('button.btn.btn--sec.btn--sm', {
                  onclick: () => C.videoUploader({
                    lessonId: l.id, lessonTitle: l.title, onDone: refresh }),
                }, 'استبدال'),
                /* «فكّ» يفصله ويُبقيه في المكتبة، و«حذف» يمحوه من القاعدة ومن
                   التخزين معًا. الاثنان لازمان: الأوّل لإعادة استعماله في درسٍ
                   آخر، والثاني للتخلّص منه فعلًا — وبدونه تتراكم فيديوهاتٌ
                   بمئات الميغابايت يُدفع ثمن تخزينها بلا أن يصل إليها أحد. */
                h('button.btn.btn--ghost.btn--sm', {
                  style: 'color:var(--err)',
                  onclick: () => C.confirmDialog('حذف الفيديو نهائيًّا',
                    `سيُفصل «${v.title}» عن الدرس ثم يُحذف من القاعدة ومن التخزين `
                    + 'معًا. لا يمكن التراجع، وسيلزم رفعه من جديد.',
                    async () => {
                      try {
                        // الفكّ أوّلًا: الحذف يرفض فيديو ما زال مرتبطًا بدرس
                        await Api.update('lessons', l.id, { video_id: null });
                        await Api.invoke('admin-video', { action: 'remove', id: v.id });
                        C.toast('حُذف الفيديو'); refresh();
                      } catch (e) { C.toast(e.message || 'تعذّر الحذف', 'err'); }
                    }, 'حذف نهائي'),
                }, 'حذف'))
            /* «جارٍ القراءة» لا «بلا فيديو» حين نعرف من الحالة المحلّية أن
               للدرس فيديو: إعلانُ الغياب قبل السؤال يجعل المحرِّر يرفع نسخةً
               ثانية لفيديو موجود. */
            : h('div.row', { style: 'gap:10px;align-items:center' },
                l.video
                  ? h('span.faint.small', 'جارٍ قراءة الفيديو…')
                  : h('span.badge.badge--warn', 'بلا فيديو'),
                !l.video && h('button.btn.btn--primary.btn--sm', {
                  onclick: () => C.videoUploader({
                    lessonId: l.id, lessonTitle: l.title, onDone: refresh }),
                }, '⬆ رفع فيديو لهذا الدرس')),
        );

        render(null);   // عرضٌ فوري ثم تصحيحه بما في القاعدة
        refresh();
        return box;
      }

      /* --- ملفّات الدرس ---------------------------------------------------
         أكثر من ملفّ للدرس الواحد: شرحٌ وورقةُ تمارين ومُلحق. والمفتاح أعلاها
         يقرّر ما يراه الطالب — النصّ المكتوب أو هذه الملفّات أو كلاهما.

         الأوضاع الثلاثة. «الاثنان معًا» أُضيف لأن الخيارين لا يستبعد أحدهما
         الآخر في الواقع: شرحٌ مكتوب يقرؤه الطالب فورًا، وملفٌّ مصمَّم يفتحه
         للمراجعة أو الطباعة. وإجبارُ المحرِّر على اختيار أحدهما يعني أن يحذف
         عملًا أنجزه. */
      const MODES = [
        ['text', 'نص الدرس',      'الطالب يرى النصّ المكتوب'],
        ['pdf',  'ملفّات الدرس',   'الطالب يرى الملفّات'],
        ['both', 'الاثنان معًا',   'الطالب يرى النصّ ثم الملفّات تحته'],
      ];

      function docRow() {
        const box = h('div');
        /* من الحالة المحلّية **تزامنيًّا** لا بعد جولة شبكة.
           كان يبدأ دائمًا بـ'text' ثم يُصحَّح بعد جولتين (REST ثم دالّة Edge قد
           تكون باردة). فيحفظ المحرِّر، ينظر فورًا، يرى «نص»، ويستنتج أن اختياره
           لم يُحفظ — وهو محفوظ في القاعدة طوال الوقت. */
        let mode = l.mode || 'text';
        let docs = [];

        const refresh = async () => {
          /* محاولتان منفصلتان لا `try` واحدة: فشلُ سرد الملفّات كان يُسقط
             قراءة الوضع معه فيعود المفتاح إلى «نص» — يظنّ المحرِّر أن اختياره
             ضاع وهو محفوظ في القاعدة. */
          try {
            const [row] = await Api.from('lessons', { select: 'body_mode', id: `eq.${l.id}` });
            mode = MODES.some(([k]) => k === row?.body_mode) ? row.body_mode : 'text';
          } catch { /* يبقى ما قرأناه سابقًا */ }
          render();          // الوضع أوّلًا: لا ينتظر دالّةً قد تكون باردة
          try {
            const res = await Api.invoke('admin-doc', { action: 'list', lesson_id: l.id });
            docs = res.docs || [];
          } catch { docs = []; }
          render();
        };

        /* المفتاح: أيّهما يراه الطالب. الاثنان يبقيان محفوظين — الرفع لا يمحو
           النصّ، والعودة إلى النصّ لا تحذف ملفًّا. فيستطيع المحرِّر تجهيز
           الملفّات ومراجعتها قبل أن يقرّر عرضها. */
        const setMode = async (next) => {
          if (next === mode) return;
          if (next !== 'text' && !docs.length) return C.toast('ارفع ملفًّا أوّلًا', 'err');
          try {
            await Api.update('lessons', l.id, { body_mode: next });
            mode = next;
            C.toast('حُفظ اختيار العرض');
            render();
          } catch (e) { C.toast(e.message || 'تعذّر التبديل', 'err'); }
        };

        /* حذفٌ حقيقي: الصفّ والملفّ في التخزين معًا، ولا رجعة فيه. والرسالة
           تقول ذلك صراحةً — إخفاءُ أثر الحذف هو ما يجعل المحرِّر يضغط بلا
           تفكير ثم يكتشف أن ملفَّه ذهب. */
        const removeDoc = (d) => C.confirmDialog('حذف الملفّ نهائيًّا',
          `سيُحذف «${d.title}» من القاعدة ومن التخزين معًا. لا يمكن التراجع، `
          + 'وسيلزم رفعه من جديد.',
          async () => {
            try {
              await Api.invoke('admin-doc', { action: 'remove', id: d.id });
              C.toast('حُذف الملفّ'); refresh();
            } catch (e) { C.toast(e.message || 'تعذّر الحذف', 'err'); }
          }, 'حذف نهائي');

        const switcher = () => h('div.row', { style: 'gap:6px;margin-bottom:10px;flex-wrap:wrap' },
          ...MODES.map(([key, label]) =>
            /* لا `disabled`: زرٌّ معطَّل لا يقول **لماذا**. كان المحرِّر يضغطه
               فلا يقع شيء فيستنتج أن الحفظ معطوب — بينما السبب أنه لم يرفع
               ملفًّا بعد. النقر مسموح والرسالة تشرح. */
            h('button.btn.btn--sm' + (mode === key ? '.btn--primary' : '.btn--sec'), {
              onclick: () => setMode(key),
            }, label)),
          h('span.faint.small', { style: 'align-self:center' },
            MODES.find(([k]) => k === mode)?.[2] || ''));

        const row = (d) => h('div.row', {
          style: 'gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--brd)',
        },
          h('span.badge.badge--mute', ar(d.sort_order || 1)),
          h('div.grow',
            h('div.small', { style: 'font-weight:600' }, d.title),
            h('div.faint.small',
              (d.pages ? ar(d.pages) + ' صفحة · ' : '')
              + ar(Math.round((d.size_bytes || 0) / 1048576 * 10) / 10) + ' م.ب')),
          h('button.btn.btn--ghost.btn--sm', {
            style: 'color:var(--err)', onclick: () => removeDoc(d),
          }, 'حذف'));

        const render = () => box.replaceChildren(
          switcher(),
          ...docs.map(row),
          h('div.row', { style: 'gap:10px;align-items:center;margin-top:10px' },
            docs.length ? h('span') : h('span.badge.badge--mute', 'لا ملفّات بعد'),
            h('button.btn.btn--sec.btn--sm', {
              onclick: () => C.docUploader({
                lessonId: l.id, lessonTitle: l.title, bodyMode: mode,
                /* نصٌّ فعليّ لا وسمٌ فارغ: محرّر contenteditable يترك `<br>`
                   أو `<p></p>` بعد المسح، فطولُ `innerHTML` وحده يكذب. */
                hasText: (area.innerHTML || '').replace(/<[^>]*>|&nbsp;|\s/g, '').length > 0,
                onDone: refresh }),
            }, docs.length ? '+ أضف ملفًّا آخر' : '⬆ رفع ملفّ')),
        );

        render();
        refresh();
        return box;
      }

      const qBox = h('div');
      drawAttached();

      function drawAttached() {
        const attached = Store.questionsOf(l.id);
        qBox.replaceChildren(
          attached.length
            ? h('div.list-sep', ...attached.map((q) => h('div.row', { style: 'padding:9px 2px;gap:8px' },
                q.section
                  ? h('span.badge.badge--acc', sectionLabel(q.section))
                  : h('span.badge.badge--warn', 'غير مصنَّف'),
                h('div.grow.small', q.stem.slice(0, 90) + (q.stem.length > 90 ? '…' : '')),
                h('button.btn.btn--ghost.btn--sm', {
                  title: 'إزالة من هذا الدرس',
                  onclick: async () => {
                    try {
                      await Store.upsert('questions', { ...q, lesson: null });
                      C.toast('أُزيل من الدرس'); drawAttached();
                    } catch (e) { C.toast('تعذّر الحذف: ' + (e.message || ''), 'err'); }
                  },
                }, '✕ إزالة'))))
            : h('div.help', 'لا أسئلة مرتبطة بهذا الدرس بعد.'),
        );
      }

      /** منتقي: يضيف سؤالًا قائمًا من البنك إلى هذا الدرس دون فتح محرّره. */
      function pickFromBank() {
        let q = '', fSec = '', fUnit = '';
        const body = h('div');

        function drawList() {
          const all = Store.get().questions;
          let rows = all.filter((x) => x.lesson !== l.id);
          if (fSec === '__none') rows = rows.filter((x) => !x.section);
          else if (fSec)         rows = rows.filter((x) => x.section === fSec);
          if (fUnit)             rows = rows.filter((x) => x.unitCode === fUnit);
          if (q.trim())          rows = rows.filter((x) => x.stem.includes(q.trim()));
          // بلا سقف: بنك الأسئلة صار مئات الأسئلة، وسقف ٨٠ كان يخفي أسئلة
          // حقيقية بصمت عن المدرّس بدل أن يظهر له كل ما يطابق الفلتر.
          // الحاوية أصلًا قابلة للتمرير (max-height أدناه).

          const list = h('div.list-sep', { style: 'max-height:360px;overflow:auto' },
            ...(rows.length ? rows.map((x) => {
              const otherLesson = x.lesson && x.lesson !== l.id ? Store.lessonById(x.lesson) : null;
              return h('div.row', { style: 'padding:9px 2px;gap:8px;align-items:flex-start' },
                h('div',
                  x.section ? h('span.badge.badge--acc', sectionLabel(x.section))
                            : h('span.badge.badge--warn', 'غ.م'),
                  x.unitCode && h('div.faint', { style: 'font-size:10px;margin-top:2px' },
                    Store.unitLabel(x.section, x.unitCode))),
                h('div.grow',
                  h('div.small', x.stem.slice(0, 100) + (x.stem.length > 100 ? '…' : '')),
                  otherLesson && h('div.faint', { style: 'font-size:11px' },
                    `مرتبط حاليًا بـ «${otherLesson.title}»`)),
                h('div.row', { style: 'gap:6px;flex:none' },
                  h('button.btn.btn--ghost.btn--sm', { onclick: () => Editors.previewQuestion(x) }, 'معاينة'),
                  h('button.btn.btn--ghost.btn--sm', {
                    onclick: () => Editors.question(x, { onSaved: () => { drawAttached(); drawList(); } }),
                  }, 'تعديل'),
                  h('button.btn.btn--sec.btn--sm', {
                    onclick: async () => {
                      const attach = async () => {
                        try {
                          await Store.upsert('questions', { ...x, lesson: l.id });
                          C.toast('أُضيف السؤال إلى الدرس'); drawAttached(); drawList();
                        } catch (e) { C.toast('تعذّر الإضافة: ' + (e.message || ''), 'err'); }
                      };
                      if (otherLesson) {
                        C.confirmDialog('نقل السؤال؟',
                          `هذا السؤال مرتبط حاليًا بدرس «${otherLesson.title}». إضافته هنا تنقله من هناك — `
                          + 'سؤال واحد لا يمكن أن يتبع درسين معًا.',
                          attach, 'انقله إلى هذا الدرس');
                      } else await attach();
                    },
                  }, 'إضافة')));
            }) : [h('div.help', { style: 'padding:10px 2px' }, 'لا أسئلة مطابقة.')]));

          body.replaceChildren(
            h('div.row.row--wrap', { style: 'gap:8px;margin-bottom:10px' },
              (() => {
                const i = C.input({ placeholder: 'ابحث في نص السؤال…', value: q, style: 'flex:1;min-width:160px' });
                i.addEventListener('input', () => { q = i.value; clearTimeout(i._t); i._t = setTimeout(drawList, 250); });
                return i;
              })(),
              (() => {
                const sel = C.select([['', 'كل الأقسام'], ['__none', '⚠ غير مصنَّف'], ...Store.SECTIONS], fSec, { class: 'filter-w' });
                sel.addEventListener('change', () => { fSec = sel.value; fUnit = ''; drawList(); });
                return sel;
              })(),
              (() => {
                const opts = Store.unitOptionsFor(fSec || 'unite');
                const sel = C.select([['', 'كل الفروع'], ...opts], fUnit,
                  { class: 'filter-w', disabled: !fSec || fSec === '__none' });
                sel.addEventListener('change', () => { fUnit = sel.value; drawList(); });
                return sel;
              })()),
            list);
        }
        drawList();

        C.modal({
          title: `أضف سؤالًا إلى «${l.title}»`, wide: true, body,
          actions: [{ label: 'تم', kind: 'primary', onClick: (c) => c() }],
        });
      }

      editBox.replaceChildren(
        C.card('تحرير الدرس',
          h('div',
            h('div.grid.grid--2',
              C.field('عنوان الدرس', fTitle),
              C.field('الوحدة', fUnit)),
            h('div.row', { style: 'gap:14px;flex-wrap:wrap' },
              C.field('الترتيب', fOrder),
              C.field('الدقائق', fMinutes)),

            h('div.field',
              h('label', 'نص الدرس'),
              bar, area,
              h('div.help', 'استخدم زر «فرنسي» لكل كلمة أو جملة فرنسية — يمنع انقلاب علامات الترقيم.')),

            h('div.row', { style: 'gap:18px;margin-bottom:14px' },
              C.checkbox('درس مجاني (معاينة قبل الاشتراك)', free, (v) => { free = v; }),
              C.checkbox('منشور للطلاب', published, (v) => { published = v; })),

            /* فيديو الدرس هنا لا في صفحة منفصلة: المحرِّر يصوّر الدرس ويكتب
               نصّه في جلسة واحدة، فإرساله إلى صفحة أخرى ليربط الفيديو خطوةٌ
               تُنسى — والنتيجة درسٌ منشور بلا فيديو لا ينتبه له أحد. */
            C.field('فيديو الدرس', videoRow(),
              'يُرفع مباشرةً إلى التخزين ويُربط بهذا الدرس تلقائيًّا.'),

            C.field('ملفّات الدرس', docRow(),
              'اختر ما يراه الطالب: «نص الدرس» المكتوب أعلاه، أو ملفّات PDF يعرضها '
              + 'التطبيق تحت الفيديو — يفتحها الطالب بملء الشاشة أو ينسدلها في مكانها. '
              + 'يمكن رفع أكثر من ملفّ، والنصّ يبقى محفوظًا مهما فعلت.'),

            C.field('أسئلة هذا الدرس', h('div',
              qBox,
              h('button.btn.btn--sec.btn--sm', { style: 'margin-top:8px', onclick: pickFromBank },
                '+ أضف من البنك')),
              'يظهر السؤال في تمارين هذا الدرس تحديدًا. لإنشاء سؤال جديد كليًا استخدم بنك الأسئلة.'),

            h('div.row',
              h('button.btn.btn--primary', { onclick: () => save() }, 'حفظ'),
              !l.published && h('button.btn.btn--sec', { onclick: () => save(true) }, 'حفظ ونشر'),
              h('button.btn.btn--ghost.btn--sm', {
                onclick: () => App.go('questions', { lesson: l.id }),
              }, 'فتح في بنك الأسئلة'),
              h('div.grow'),
              h('button.btn.btn--danger.btn--sm', {
                onclick: () => C.confirmDialog('حذف الدرس',
                  `سيُحذف «${l.title}». الأسئلة المرتبطة به لن تُحذف لكنها ستصبح بلا درس.`,
                  async () => {
                    try {
                      await Store.remove('lessons', l.id);
                      selected = null; C.toast('حُذف الدرس'); drawTree(); drawEditor();
                    } catch (e) { C.toast('تعذّر الحذف: ' + (e.message || ''), 'err'); }
                  }, 'حذف'),
              }, 'حذف الدرس')),
          ),
          C.pubBadge(l.published),
          unit && h('span.badge.badge--mute', unit.title)),
      );
    }

    // =========================================================================
    // نوافذ الكتاب والوحدة والدرس الجديد
    // =========================================================================
    function editBook(book) {
      const title = C.input({ value: book?.title || '', placeholder: 'كتاب الطالب' });
      const grades = Store.get().grades;
      const grade = C.select(grades.map((g) => [g.id, g.name]), book?.grade || grades[0]?.id || '');
      let published = book?.published ?? false;

      C.modal({
        title: book ? 'تعديل كتاب' : 'كتاب جديد',
        body: h('div',
          C.field('اسم الكتاب', title),
          C.field('الصف', grade),
          C.checkbox('منشور', published, (v) => { published = v; })),
        actions: [
          book && { label: 'حذف', kind: 'danger', onClick: (c) => {
              c(); C.confirmDialog('حذف الكتاب',
                `سيُحذف «${book.title}» بكل وحداته ودروسه. لا يمكن التراجع.`,
                async () => {
                  try {
                    for (const u of Store.unitsOf(book.id)) {
                      for (const l of Store.lessonsOf(u.id)) await Store.remove('lessons', l.id);
                      await Store.remove('units', u.id);
                    }
                    await Store.remove('books', book.id);
                    if (selected && !Store.lessonById(selected)) selected = null;
                    C.toast('حُذف الكتاب'); drawTree(); drawEditor();
                  } catch (e) { C.toast('تعذّر الحذف: ' + (e.message || ''), 'err'); }
                },
                'حذف نهائيًا');
            } },
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: async (c) => {
              if (!title.value.trim()) return C.toast('الاسم مطلوب', 'err');
              try {
                await Store.upsert('books', {
                  id: book?.id || Store.newId(), code: book?.code,
                  grade: grade.value, title: title.value.trim(), published,
                });
                c(); C.toast('حُفظ الكتاب'); drawTree();
              } catch (e) { C.toast('تعذّر الحفظ: ' + (e.message || ''), 'err'); }
            } },
        ].filter(Boolean),
      });
    }

    function editUnit(unit, bookId) {
      const title = C.input({ value: unit?.title || '', placeholder: 'الوحدة الأولى: …' });
      const order = C.input({ type: 'number', value: unit?.order || (Store.unitsOf(bookId || unit.book).length + 1), min: 1 });

      C.modal({
        title: unit ? 'تعديل وحدة' : 'وحدة جديدة',
        body: h('div', C.field('عنوان الوحدة', title), C.field('الترتيب', order)),
        actions: [
          unit && { label: 'حذف', kind: 'danger', onClick: (c) => {
              c(); C.confirmDialog('حذف الوحدة',
                'ستُحذف الوحدة ودروسها معها. لا يمكن التراجع.',
                async () => {
                  try {
                    for (const l of Store.lessonsOf(unit.id)) await Store.remove('lessons', l.id);
                    await Store.remove('units', unit.id);
                    C.toast('حُذفت الوحدة'); drawTree(); drawEditor();
                  } catch (e) { C.toast('تعذّر الحذف: ' + (e.message || ''), 'err'); }
                },
                'حذف نهائيًا');
            } },
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: async (c) => {
              if (!title.value.trim()) return C.toast('العنوان مطلوب', 'err');
              try {
                await Store.upsert('units', {
                  id: unit?.id || Store.newId(), code: unit?.code,
                  book: unit?.book || bookId, order: +order.value || 1, title: title.value.trim(),
                });
                c(); C.toast('حُفظت الوحدة'); drawTree();
              } catch (e) { C.toast('تعذّر الحفظ: ' + (e.message || ''), 'err'); }
            } },
        ].filter(Boolean),
      });
    }

    async function newLesson(unitId) {
      const id = Store.newId();
      try {
        await Store.upsert('lessons', {
          id, unit: unitId, order: Store.lessonsOf(unitId).length + 1,
          title: 'درس جديد', minutes: 10, free: false, published: false,
          body: '<h3>عنوان القسم الأول</h3><p>اكتب نص الدرس هنا…</p>', video: null,
        });
        selected = id;
        drawTree(); drawEditor();
        C.toast('أُنشئ درس — املأ بياناته ثم احفظ');
      } catch (e) {
        C.toast('تعذّر إنشاء الدرس: ' + (e.message || ''), 'err');
      }
    }

    drawTree(); drawEditor();
    return page;
  };
})();
