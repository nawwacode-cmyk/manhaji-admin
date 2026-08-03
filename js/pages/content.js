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
          rows = rows.slice(0, 80);   // كفاية للتصفّح؛ البحث يضيّق أكثر

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
        ],
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
