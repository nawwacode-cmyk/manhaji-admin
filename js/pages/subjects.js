/* =============================================================================
   المواد — الكيان الجذر الذي يعلّق تحته كل المحتوى

   حذف مادة يجرف بـcascade كل كورساتها ووحداتها ودروسها وأسئلتها. لذلك الحذف
   هنا ممنوع ما دام تحتها أي شيء — لا بتحذير يمكن تجاوزه بل بزرّ معطَّل، لأن
   التأكيد النصّي لا يوقف نقرة متعجّلة على عمل شهور.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  // ألوان مقترحة تميّز المواد في واجهة الطالب. الحقل يقبل أي HEX،
  // وهذه اختصار للحالة الشائعة لا قيد.
  const SWATCHES = ['#5B4B9E', '#C98A2E', '#2E7D5B', '#C2453D', '#3A6EA5', '#8A5A1E'];

  Pages.subjects = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    function draw() {
      const s = Store.get();

      wrap.replaceChildren(
        C.card('المواد',
          C.table(['الكود', 'الاسم', 'بلغتها', 'اللون', 'الترتيب', 'المحتوى', ''],
            s.subjects, (sub) => {
              const count = s.contentCounts[sub.id] || 0;
              const active = sub.id === s.subjectId;
              return [
                h('span.mono.small', sub.code),
                h('div', { style: 'font-weight:600' }, sub.name,
                  active && h('span.badge.badge--ok', { style: 'margin-inline-start:8px' }, 'الفعّالة')),
                sub.native ? h('span.fr', sub.native) : h('span.faint', '—'),
                sub.color
                  ? h('span.row', { style: 'gap:6px' },
                      h('i', { style: `width:16px;height:16px;border-radius:5px;display:inline-block;background:${sub.color}` }),
                      h('span.mono.small', sub.color))
                  : h('span.faint', '—'),
                h('span.num', ar(sub.order)),
                count
                  ? h('span.badge.badge--mute', `${ar(count)} عنصرًا`)
                  : h('span.faint.small', 'فارغة'),
                C.actions(
                  !active && h('button.btn.btn--sec.btn--sm', {
                    onclick: async () => {
                      await Store.setActiveSubject(sub.id);
                      C.toast(`المادة الفعّالة: ${sub.name}`);
                      App.render();
                    },
                  }, 'اجعلها الفعّالة'),
                  h('button.btn.btn--sec.btn--sm', { onclick: () => edit(sub) }, 'تعديل'),
                  h('button.btn.btn--danger.btn--sm', {
                    disabled: count > 0,
                    title: count > 0
                      ? 'لا يمكن حذف مادة تحتها محتوى — انقل محتواها أو احذفه أولًا'
                      : 'حذف المادة',
                    onclick: () => C.confirmDialog('حذف المادة',
                      `ستُحذف «${sub.name}» نهائيًا. لا محتوى تحتها، فلن يضيع شيء.`,
                      async () => {
                        try {
                          await Store.remove('subjects', sub.id);
                          C.toast('حُذفت المادة'); App.render();
                        } catch (e) { C.toast(e.message || 'تعذّر الحذف', 'err'); }
                      }, 'حذف'),
                  }, 'حذف')),
              ];
            }, 'لا مواد بعد. أضف أول مادة لتبني تحتها المنهاج.'),
          h('button.btn.btn--primary.btn--sm', { onclick: () => edit(null) }, '+ مادة جديدة')),
      );
    }

    function edit(sub) {
      const isNew = !sub;
      const code   = C.input({ value: sub?.code || '', placeholder: 'fr', dir: 'ltr' });
      const name   = C.input({ value: sub?.name || '', placeholder: 'اللغة الفرنسية' });
      const native = C.input({ value: sub?.native || '', placeholder: 'Français', dir: 'ltr' });
      const order  = C.input({ type: 'number', value: sub?.order ?? Store.get().subjects.length + 1 });

      let color = sub?.color || SWATCHES[0];
      const colorInput = C.input({ value: color, dir: 'ltr', placeholder: '#5B4B9E' });
      const dot = h('i', { style: swatchStyle(color) });
      const sync = () => { dot.setAttribute('style', swatchStyle(colorInput.value.trim())); };
      colorInput.addEventListener('input', sync);

      const err = h('div');

      C.modal({
        title: isNew ? 'مادة جديدة' : 'تعديل المادة',
        body: h('div',
          err,
          C.field('الكود', code,
            'حروف لاتينية صغيرة بلا مسافات — يستعمله التطبيق وأدوات الاستيراد. '
            + 'تغييره بعد وجود محتوى يكسر الروابط، فاختره مرة واحدة.'),
          C.field('الاسم بالعربية', name),
          C.field('الاسم بلغتها', native, 'يظهر تحت الاسم العربي في التطبيق. اتركه فارغًا للمواد العربية.'),
          C.field('اللون', h('div',
            h('div.row', { style: 'gap:8px' }, dot, colorInput),
            h('div.row', { style: 'gap:6px;margin-top:8px;flex-wrap:wrap' },
              ...SWATCHES.map((c) => h('button.btn.btn--ghost.btn--sm', {
                style: `padding:0;width:28px;height:28px;border-radius:8px;background:${c}`,
                title: c,
                onclick: () => { colorInput.value = c; sync(); },
              }, ''))))),
          C.field('الترتيب', order, 'الأصغر يظهر أولًا عند الطالب.'),
        ),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: async (close) => {
            const c = code.value.trim().toLowerCase();
            const n = name.value.trim();

            const fail = (m) => err.replaceChildren(
              h('div.badge.badge--err', { style: 'margin-bottom:12px' }, m));

            if (!/^[a-z0-9-]{2,20}$/.test(c)) return fail('الكود: حروف لاتينية صغيرة وأرقام وشرطات، ٢–٢٠ محرفًا.');
            if (!n) return fail('الاسم بالعربية مطلوب.');
            // التصادم يرفضه القيد الفريد بالقاعدة على أي حال، لكن رسالته
            // بالإنجليزية وغير مفهومة — نمسكه هنا برسالة تقول ما العمل.
            const clash = Store.get().subjects.find((x) => x.code === c && x.id !== sub?.id);
            if (clash) return fail(`الكود «${c}» مستعمل فعلًا في مادة «${clash.name}».`);

            try {
              await Store.upsert('subjects', {
                id: sub?.id || Store.newId(),
                code: c, name: n,
                native: native.value.trim(),
                color: colorInput.value.trim(),
                order: Number(order.value) || 0,
              });
              close();
              C.toast(isNew ? 'أُضيفت المادة' : 'حُفظت التعديلات');
              App.render();
            } catch (e) {
              fail(e.message || 'تعذّر الحفظ.');
            }
          } },
        ],
      });
    }

    const swatchStyle = (c) =>
      `width:32px;height:32px;border-radius:9px;display:inline-block;flex:none;`
      + `border:1px solid var(--brd);background:${/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : 'transparent'}`;

    draw();
    return page;
  };
})();
