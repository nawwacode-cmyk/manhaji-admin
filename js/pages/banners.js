/* =============================================================================
   البانرات — شرائح «الرئيسية» عند الطالب

   الجدولة يفرضها السيرفر لا هذه الصفحة (سياسة read_active_banners). ما نعرضه
   هنا هو **حالة** كل بانر بحسب وقته، حتى يرى المدير بعينه ما يراه الطالب
   فعلًا الآن: بانر انتهى أمس لم يعد يظهر لأحد حتى لو بقي is_active.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const TARGETS = [
    ['none',    'بلا وجهة (إعلامي فقط)'],
    ['subject', 'مادة'],
    ['teacher', 'أستاذ'],
    ['url',     'رابط خارجي'],
  ];

  /** الحالة كما يراها الطالب الآن — لا كما نيّتها. */
  function statusOf(b) {
    const now = Date.now();
    if (!b.is_active) return ['مخفي', 'mute'];
    if (b.starts_at && now < Date.parse(b.starts_at)) return ['مجدول', 'warn'];
    if (b.ends_at   && now > Date.parse(b.ends_at))   return ['منتهٍ', 'mute'];
    return ['ظاهر الآن', 'ok'];
  }

  // input[type=datetime-local] يتكلّم بالتوقيت المحلي بلا منطقة، وقاعدة
  // البيانات timestamptz. التحويل صريح في الاتجاهين وإلّا انزاح كل موعد
  // بمقدار فرق المنطقة بصمت.
  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ar', {
    year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  Pages.banners = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let rows = [], teachers = [], loadErr = null;

    async function load() {
      try {
        const [b, t] = await Promise.all([
          Api.from('banners',  { select: '*', order: 'sort_order' }),
          Api.from('teachers', { select: 'id,code,name' }).catch(() => []),
        ]);
        rows = b; teachers = t; loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل البانرات.'; }
      draw();
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('البانرات', h('div.badge.badge--err', loadErr))); return; }
      const live = rows.filter((b) => statusOf(b)[0] === 'ظاهر الآن').length;

      wrap.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('كل البانرات', ar(rows.length)),
          C.kpi('ظاهرة الآن للطلاب', ar(live), live === 0 ? 'لا يرى الطالب أي بانر' : undefined,
                live === 0 ? 'var(--warn)' : undefined),
          C.kpi('مجدولة', ar(rows.filter((b) => statusOf(b)[0] === 'مجدول').length))),

        C.card('البانرات',
          C.table(['', 'العنوان', 'الوجهة', 'من', 'إلى', 'الترتيب', 'الحالة', ''],
            rows, (b) => {
              const url = Api.publicUrl(b.image_path);
              const [label, kind] = statusOf(b);
              return [
                url ? h('img', { src: url, alt: '',
                        style: 'width:64px;height:36px;border-radius:7px;object-fit:cover' })
                    : h('div', { style: 'width:64px;height:36px;border-radius:7px;background:var(--acc-soft)' }),
                h('div',
                  h('div', { style: 'font-weight:600' }, b.title_ar),
                  b.subtitle_ar && h('div.faint.small', b.subtitle_ar)),
                b.target_type === 'none'
                  ? h('span.faint.small', '—')
                  : h('span.badge.badge--mute',
                      `${TARGETS.find((x) => x[0] === b.target_type)?.[1]}: ${b.target_value}`),
                h('span.faint.small', fmtDate(b.starts_at)),
                h('span.faint.small', fmtDate(b.ends_at)),
                h('span.num', ar(b.sort_order)),
                h('span.badge.badge--' + kind, label),
                C.actions(
                  h('button.btn.btn--sec.btn--sm', { onclick: () => edit(b) }, 'تعديل'),
                  h('button.btn.btn--danger.btn--sm', {
                    onclick: () => C.confirmDialog('حذف البانر',
                      `سيُحذف «${b.title_ar}» نهائيًا.`,
                      async () => {
                        try {
                          await Api.deleteImage(b.image_path);
                          await Api.remove('banners', b.id);
                          C.toast('حُذف البانر'); load();
                        } catch (e) { C.toast(e.message || 'تعذّر الحذف', 'err'); }
                      }, 'حذف'),
                  }, 'حذف')),
              ];
            }, 'لا بانرات بعد. الطالب يرى «الرئيسية» بلا شرائح.'),
          h('button.btn.btn--primary.btn--sm', { onclick: () => edit(null) }, '+ بانر جديد')),
      );
    }

    function edit(b) {
      const isNew = !b;
      const title = C.input({ value: b?.title_ar || '', placeholder: 'اشتراك سنوي بخصم ٢٠٪' });
      const sub   = C.input({ value: b?.subtitle_ar || '', placeholder: 'لغاية نهاية الشهر' });
      const order = C.input({ type: 'number', value: b?.sort_order ?? rows.length + 1 });
      const from  = C.input({ type: 'datetime-local', value: toLocalInput(b?.starts_at) });
      const to    = C.input({ type: 'datetime-local', value: toLocalInput(b?.ends_at) });

      let active = b ? !!b.is_active : true;
      const activeBox = C.checkbox('مفعَّل', active, (v) => { active = v; });

      /* --- حقول قسم «آخر الأخبار» -------------------------------------------
         الجدول بُني بانرًا، وصار يخدم قسم أخبارٍ يُفتح قصدًا. أخطر ما كان
         ينقصه تاريخُ النشر: خبرٌ بلا تاريخ لا يُعرف أجديدٌ هو أم من العام
         الماضي.

         و`published_at` **غير** `starts_at`: الأولى تاريخُ عرضٍ يقرؤه الطالب،
         والثانية شرطُ وصولٍ تفرضه RLS. خلطُهما يعني أن تأجيل الظهور يكذب على
         الطالب في تاريخ الخبر. */
      const body = C.textarea({ value: b?.body_ar || '', rows: 6,
                                placeholder: 'نصّ الخبر كاملًا — يظهر عند فتح الخبر.' });
      const pubAt = C.input({ type: 'datetime-local',
                              value: toLocalInput(b?.published_at) || toLocalInput(new Date().toISOString()) });
      const catSel = C.select([['announcement', 'إعلان'], ['content', 'محتوى جديد'],
                               ['update', 'تحديث']], b?.category || 'announcement');

      let pinned = b ? !!b.pinned : false;
      const pinBox = C.checkbox('مثبَّت في أعلى القسم', pinned, (v) => { pinned = v; });
      let onHome = b ? b.show_on_home !== false : true;
      const homeBox = C.checkbox('يظهر في مقتطف الرئيسية', onHome, (v) => { onHome = v; });

      const targetVal = C.input({ value: b?.target_value || '', dir: 'ltr' });
      const valField = h('div');
      const targetSel = C.select(TARGETS, b?.target_type || 'none');

      function drawTarget() {
        const t = targetSel.value;
        if (t === 'none') { valField.replaceChildren(); return; }
        if (t === 'subject') {
          const sel = C.select(Store.get().subjects.map((s) => [s.code, s.name]), targetVal.value);
          sel.addEventListener('change', () => { targetVal.value = sel.value; });
          targetVal.value = targetVal.value || sel.value;
          valField.replaceChildren(C.field('المادة', sel));
        } else if (t === 'teacher') {
          const sel = C.select(teachers.map((x) => [x.code, x.name]), targetVal.value);
          sel.addEventListener('change', () => { targetVal.value = sel.value; });
          targetVal.value = targetVal.value || sel.value;
          valField.replaceChildren(C.field('الأستاذ', sel));
        } else {
          valField.replaceChildren(C.field('الرابط', targetVal, 'يُفتح خارج التطبيق.'));
        }
      }
      targetSel.addEventListener('change', drawTarget);
      drawTarget();

      let imagePath = b?.image_path || null;
      let picked = null;
      const preview = h('div', { style: 'width:180px;height:100px;border-radius:12px;overflow:hidden;'
        + 'background:var(--acc-soft);display:grid;place-items:center;flex:none' });
      const drawPreview = (src) => preview.replaceChildren(src
        ? h('img', { src, alt: '', style: 'width:100%;height:100%;object-fit:cover' })
        : h('span.faint.small', 'بلا صورة'));
      drawPreview(Api.publicUrl(imagePath));

      const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/avif',
                                style: 'display:none' });
      file.addEventListener('change', () => {
        const f = file.files[0]; if (!f) return;
        picked = f; drawPreview(URL.createObjectURL(f));
      });

      const err = h('div');
      const fail = (m) => err.replaceChildren(h('div.badge.badge--err', { style: 'margin-bottom:12px' }, m));

      C.modal({
        title: isNew ? 'بانر جديد' : 'تعديل البانر',
        wide: true,
        body: h('div',
          err,
          h('div.row', { style: 'gap:16px;align-items:flex-start;margin-bottom:16px' },
            preview,
            h('div',
              h('button.btn.btn--sec.btn--sm', { onclick: () => file.click() },
                imagePath || picked ? 'تبديل الصورة' : 'اختر صورة'),
              imagePath && h('button.btn.btn--ghost.btn--sm', {
                style: 'margin-inline-start:6px;color:var(--err)',
                onclick: () => { imagePath = null; picked = null; drawPreview(null); },
              }, 'إزالة'),
              h('div.help', { style: 'margin-top:6px' },
                'عريضة يُفضَّل (نحو ٢:١) · حتى ٥ م.ب. بلا صورة يُعرض تدرّج لوني.'),
              file)),

          C.field('العنوان', title),
          C.field('الوصف', sub, 'سطر صغير تحت العنوان. اتركه فارغًا إن لم يلزم.'),
          C.field('نصّ الخبر', body,
            'اختياري. بلا نصّ يعرض الخبر عنوانه ووصفه فقط.'),
          h('div.grid.grid--2',
            C.field('التصنيف', catSel, 'يُنتج شرائح التصفية في التطبيق.'),
            C.field('تاريخ النشر', pubAt,
              'هذا ما يقرؤه الطالب («منذ ٣ ساعات») — غير «يبدأ» أدناه.')),
          C.field('عند النقر', targetSel),
          valField,
          h('div.grid.grid--2',
            C.field('يبدأ', from, 'اتركه فارغًا ليبدأ فورًا.'),
            C.field('ينتهي', to, 'اتركه فارغًا ليبقى بلا انتهاء.')),
          C.field('الترتيب', order),
          h('div.field', activeBox),
          h('div.field', pinBox),
          h('div.field', homeBox),
          h('div.help',
            'الجدولة يفرضها السيرفر: خارج هذه النافذة لا يصل البانر لجهاز الطالب أصلًا، '
            + 'فلا حاجة لتذكّر إخفائه يدويًا. '
            + 'و«تاريخ النشر» تاريخُ عرضٍ فقط: تأجيل الظهور يكون بـ«يبدأ» لا به — '
            + 'وإلّا كذب التطبيق على الطالب في عمر الخبر.'),
        ),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: async (close) => {
            const t = title.value.trim();
            if (!t) return fail('العنوان مطلوب.');
            const type = targetSel.value;
            const val = targetVal.value.trim();
            if (type !== 'none' && !val) return fail('اختر وجهة أو اجعله «بلا وجهة».');
            if (type === 'url' && !/^https?:\/\//i.test(val)) return fail('الرابط يجب أن يبدأ بـ http:// أو https://');

            const s = fromLocalInput(from.value);
            const e = fromLocalInput(to.value);
            if (s && e && Date.parse(e) <= Date.parse(s)) return fail('تاريخ الانتهاء يجب أن يلي تاريخ البدء.');

            try {
              let path = imagePath;
              if (picked) {
                path = await Api.uploadImage(picked, 'banners');
                if (b?.image_path && b.image_path !== path) await Api.deleteImage(b.image_path);
              } else if (b?.image_path && !imagePath) {
                await Api.deleteImage(b.image_path);
              }

              await Api.upsert('banners', {
                id: b?.id || Store.newId(),
                title_ar: t,
                subtitle_ar: sub.value.trim() || null,
                image_path: path,
                target_type: type,
                target_value: type === 'none' ? null : val,
                starts_at: s, ends_at: e,
                is_active: active,
                sort_order: Number(order.value) || 0,
                // حقول قسم «آخر الأخبار»
                body_ar: body.value.trim() || null,
                category: catSel.value,
                published_at: fromLocalInput(pubAt.value) || new Date().toISOString(),
                pinned,
                show_on_home: onHome,
              });
              close();
              C.toast(isNew ? 'أُضيف البانر' : 'حُفظت التعديلات');
              load();
            } catch (err2) { fail(err2.message || 'تعذّر الحفظ.'); }
          } },
        ],
      });
    }

    load();
    return page;
  };
})();
