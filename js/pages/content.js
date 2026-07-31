/* =============================================================================
   المحتوى — كتب ← وحدات ← دروس، ومحرّر الدرس
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, fr, ar, icon } = UI;

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
      const fTitle   = C.input({ value: l.title });
      const fOrder   = C.input({ type: 'number', value: l.order, min: 1, style: 'width:90px' });
      const fMinutes = C.input({ type: 'number', value: l.minutes, min: 1, style: 'width:90px' });
      const fPage    = C.input({ type: 'number', value: l.page || '', min: 1, style: 'width:90px' });
      const fUnit    = C.select(s.units.map((u) => [u.id, u.title]), l.unit);
      const fVideo   = C.select([['', '— بلا فيديو —'],
                                 ...s.videos.map((v) => [v.id, v.title])], l.video || '');

      let free = l.free, published = l.published;
      const topics = new Set(l.topics || []);

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

      // --- المواضيع ---
      const topicBox = h('div.row.row--wrap');
      SEED.topics.forEach((t) => {
        const on = topics.has(t.id);
        const btn = h('button.btn.btn--sm' + (on ? '.btn--primary' : '.btn--sec'), t.name);
        btn.addEventListener('click', () => {
          topics.has(t.id) ? topics.delete(t.id) : topics.add(t.id);
          btn.className = 'btn btn--sm ' + (topics.has(t.id) ? 'btn--primary' : 'btn--sec');
        });
        topicBox.appendChild(btn);
      });

      function save(publishState) {
        if (!fTitle.value.trim()) { fTitle.classList.add('is-err'); return C.toast('العنوان مطلوب', 'err'); }
        if (!topics.size) return C.toast('اختر موضوعًا واحدًا على الأقل — بدونه لا يحرّك الدرس مؤشر التقدّم', 'err');
        Store.upsert('lessons', {
          id: l.id, unit: fUnit.value, order: +fOrder.value || 1,
          title: fTitle.value.trim(), minutes: +fMinutes.value || 10,
          page: +fPage.value || null, video: fVideo.value || null,
          free, published: publishState !== undefined ? publishState : published,
          topics: [...topics], body: area.innerHTML,
        });
        C.toast('حُفظ الدرس');
        drawTree(); drawEditor();
      }

      const qCount = Store.questionsOf(l.id).length;

      editBox.replaceChildren(
        C.card('تحرير الدرس',
          h('div',
            h('div.grid.grid--2',
              C.field('عنوان الدرس', fTitle),
              C.field('الوحدة', fUnit)),
            h('div.row', { style: 'gap:14px;flex-wrap:wrap' },
              C.field('الترتيب', fOrder),
              C.field('الدقائق', fMinutes),
              C.field('صفحة الكتاب', fPage, 'تساعد الطالب على إيجاده في الكتاب الورقي'),
              h('div.field.grow', h('label', 'الفيديو'), fVideo)),

            C.field('المواضيع', topicBox,
              'الموضوع يربط الدرس بخريطة الإتقان و«تعلّم حسب الموضوع». درس بلا موضوع لا يحرّك المؤشر.'),

            h('div.field',
              h('label', 'نص الدرس'),
              bar, area,
              h('div.help', 'استخدم زر «فرنسي» لكل كلمة أو جملة فرنسية — يمنع انقلاب علامات الترقيم.')),

            h('div.row', { style: 'gap:18px;margin-bottom:14px' },
              C.checkbox('درس مجاني (معاينة قبل الاشتراك)', free, (v) => { free = v; }),
              C.checkbox('منشور للطلاب', published, (v) => { published = v; })),

            h('div.row',
              h('button.btn.btn--primary', { onclick: () => save() }, 'حفظ'),
              !l.published && h('button.btn.btn--sec', { onclick: () => save(true) }, 'حفظ ونشر'),
              h('button.btn.btn--sec', {
                onclick: () => App.go('questions', { lesson: l.id }),
              }, `الأسئلة (${ar(qCount)})`),
              h('div.grow'),
              h('button.btn.btn--danger.btn--sm', {
                onclick: () => C.confirmDialog('حذف الدرس',
                  `سيُحذف «${l.title}». الأسئلة المرتبطة به لن تُحذف لكنها ستصبح بلا درس.`,
                  () => { Store.remove('lessons', l.id); selected = null; C.toast('حُذف الدرس');
                          drawTree(); drawEditor(); }, 'حذف'),
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
      const grade = C.select(SEED.grades.map((g) => [g.id, g.name]), book?.grade || 'g9');
      let published = book?.published ?? false;

      C.modal({
        title: book ? 'تعديل كتاب' : 'كتاب جديد',
        body: h('div',
          C.field('اسم الكتاب', title),
          C.field('الصف', grade),
          C.checkbox('منشور', published, (v) => { published = v; })),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: (c) => {
              if (!title.value.trim()) return C.toast('الاسم مطلوب', 'err');
              Store.upsert('books', {
                id: book?.id || 'b' + Date.now(), subject: 'fr',
                grade: grade.value, title: title.value.trim(), published,
              });
              c(); C.toast('حُفظ الكتاب'); drawTree();
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
                () => { Store.lessonsOf(unit.id).forEach((l) => Store.remove('lessons', l.id));
                        Store.remove('units', unit.id); C.toast('حُذفت الوحدة'); drawTree(); drawEditor(); },
                'حذف نهائيًا');
            } },
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: (c) => {
              if (!title.value.trim()) return C.toast('العنوان مطلوب', 'err');
              Store.upsert('units', {
                id: unit?.id || 'u' + Date.now(), book: unit?.book || bookId,
                order: +order.value || 1, title: title.value.trim(),
              });
              c(); C.toast('حُفظت الوحدة'); drawTree();
            } },
        ].filter(Boolean),
      });
    }

    function newLesson(unitId) {
      const id = 'l' + Date.now();
      Store.upsert('lessons', {
        id, unit: unitId, order: Store.lessonsOf(unitId).length + 1,
        title: 'درس جديد', minutes: 10, free: false, published: false,
        topics: [], body: '<h3>عنوان القسم الأول</h3><p>اكتب نص الدرس هنا…</p>', video: null,
      });
      selected = id;
      drawTree(); drawEditor();
      C.toast('أُنشئ درس — املأ بياناته ثم احفظ');
    }

    drawTree(); drawEditor();
    return page;
  };
})();
