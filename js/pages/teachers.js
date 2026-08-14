/* =============================================================================
   الأساتذة — الملف الذي يراه الطالب في «الرئيسية»

   صفّ هنا ≠ حساب دخول. الحقلان منفصلان عمدًا:
     • ملف بلا حساب  = أستاذ يُعرَض للطلاب ولا يدخل اللوحة (ضيف، أو لم يُنشأ حسابه بعد)
     • حساب بلا ملف  = مدير أو أستاذ يحرّر ولا يريد الظهور للطلاب
   الربط بينهما (profile_id) هو ما يحصر صلاحية الأستاذ بموادّه على السيرفر،
   فتركه فارغًا يعني أستاذًا لا يستطيع تحرير شيء حتى لو كان دوره teacher.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  Pages.teachers = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let rows = [];
    let staff = [];      // حسابات الطاقم المتاحة للربط
    let loadErr = null;

    async function load() {
      try {
        const [t, p] = await Promise.all([
          Api.from('teachers', { select: '*', order: 'sort_order' }),
          Api.from('profiles', { select: 'id,full_name,role' }),
        ]);
        rows = t;
        staff = p.filter((x) => x.role === 'teacher' || x.role === 'admin');
        loadErr = null;
      } catch (e) {
        loadErr = e.message || 'تعذّر تحميل الأساتذة.';
      }
      draw();
    }

    function draw() {
      if (loadErr) {
        wrap.replaceChildren(C.card('الأساتذة', h('div.badge.badge--err', loadErr)));
        return;
      }

      const linked = new Set(rows.map((r) => r.profile_id).filter(Boolean));
      const orphanStaff = staff.filter((s) => !linked.has(s.id));

      wrap.replaceChildren(
        // حساب طاقم بلا ملف أستاذ لا يظهر للطلاب ولا يملك أي محتوى — حالة
        // شائعة بعد إنشاء حساب جديد، ويسهل نسيانها فيبقى الأستاذ عاجزًا.
        orphanStaff.length > 0 && h('div.mb',
          C.card('حسابات طاقم بلا ملف أستاذ',
            C.table(['الحساب', 'الدور', ''], orphanStaff, (s) => [
              h('div', { style: 'font-weight:600' }, s.full_name || '—'),
              h('span.badge.badge--mute', Store.ROLES[s.role]?.label || s.role),
              C.actions(h('button.btn.btn--sec.btn--sm', {
                onclick: () => edit(null, s.id),
              }, 'أنشئ له ملفًا')),
            ]),
            h('span.badge.badge--warn', `${ar(orphanStaff.length)}`))),

        C.card('الأساتذة',
          C.table(['', 'الاسم', 'النبذة', 'الحساب المرتبط', 'الترتيب', 'الحالة', ''],
            rows, (t) => {
              const url = Api.publicUrl(t.photo_path);
              const acc = staff.find((s) => s.id === t.profile_id);
              return [
                url
                  ? h('img', { src: url, alt: '',
                      style: 'width:40px;height:40px;border-radius:50%;object-fit:cover' })
                  : h('div', { style: 'width:40px;height:40px;border-radius:50%;display:grid;'
                      + 'place-items:center;background:var(--acc-soft);color:var(--acc-tx);font-weight:700' },
                      (t.name || '؟')[0]),
                h('div', { style: 'font-weight:600' }, t.name),
                t.bio
                  ? h('div.faint.small', { style: 'max-width:38ch' },
                      t.bio.length > 90 ? t.bio.slice(0, 90) + '…' : t.bio)
                  : h('span.badge.badge--warn', 'بلا نبذة'),
                acc ? h('span.small', acc.full_name || '—')
                    : h('span.badge.badge--mute', 'غير مرتبط'),
                h('span.num', ar(t.sort_order)),
                t.is_active ? h('span.badge.badge--ok', 'ظاهر')
                            : h('span.badge.badge--mute', 'مخفي'),
                C.actions(
                  h('button.btn.btn--sec.btn--sm', { onclick: () => edit(t) }, 'تعديل'),
                  h('button.btn.btn--danger.btn--sm', {
                    onclick: () => C.confirmDialog('حذف ملف الأستاذ',
                      `سيُحذف ملف «${t.name}» ويختفي من التطبيق. `
                      + 'حسابه ومحتواه لا يُحذفان — استعمل «مخفي» إن أردت إخفاءه مؤقتًا فقط.',
                      async () => {
                        try {
                          await Api.deleteImage(t.photo_path);
                          await Api.remove('teachers', t.id);
                          C.toast('حُذف الملف'); load();
                        } catch (e) { C.toast(e.message || 'تعذّر الحذف', 'err'); }
                      }, 'حذف'),
                  }, 'حذف')),
              ];
            }, 'لا أساتذة بعد. أضف أول ملف ليظهر في «الرئيسية» عند الطالب.'),
          h('button.btn.btn--primary.btn--sm', { onclick: () => edit(null) }, '+ أستاذ جديد')),
      );
    }

    function edit(t, presetProfile) {
      const isNew = !t;
      const name  = C.input({ value: t?.name || '', placeholder: 'نوار بشناق' });
      const code  = C.input({ value: t?.code || '', placeholder: 'ustaz-nawar', dir: 'ltr' });
      const bio   = C.textarea({ rows: 5, value: t?.bio || '',
        placeholder: 'نبذة يقرأها الطالب في صفحة الأستاذ…' });
      const order = C.input({ type: 'number', value: t?.sort_order ?? rows.length + 1 });

      const profileSel = C.select(
        [['', '— بلا حساب —'], ...staff.map((s) => [s.id, `${s.full_name || '—'} (${Store.ROLES[s.role]?.label || s.role})`])],
        t?.profile_id || presetProfile || '');

      let active = t ? !!t.is_active : true;
      const activeBox = C.checkbox('ظاهر للطلاب', active, (v) => { active = v; });

      // --- الصورة ---
      let photoPath = t?.photo_path || null;
      let pickedFile = null;
      // المعاينة بنفس شكل العرض بالتطبيق: غلاف شاشة المادة **مربّع** (بعرض
      // الشاشة). الدائرة السابقة كانت تُظهر الصورة مقصوصة فيوافق المدير على
      // ما لن يراه الطالب — ونسبة ٣:٢ بعدها صارت تكذب للسبب نفسه بعد أن كبر
      // الغلاف وصار مربّعًا.
      const preview = h('div', { style: 'width:190px;aspect-ratio:1/1;border-radius:14px;overflow:hidden;'
        + 'background:var(--acc-soft);display:grid;place-items:center;flex:none;border:1px solid var(--brd)' });
      const drawPreview = (src) => preview.replaceChildren(src
        ? h('img', { src, alt: '', style: 'width:100%;height:100%;object-fit:contain' })
        : h('span', { style: 'color:var(--acc-tx);font-weight:700;font-size:26px' },
            (name.value || '؟')[0]));
      drawPreview(Api.publicUrl(photoPath));

      /* --- ضبط موضع الصورة ---------------------------------------------------
         الإطار **مربّع** لأنها نسبة الغلاف في شاشة المادة — وهو أكثر موضعٍ
         يُقصّ فيه. وبطاقات الأساتذة الدائرية تستعمل الموضع نفسه، والدائرة
         مربّعةٌ أيضًا، فضبطٌ واحد يخدم الاثنين بلا تنازل.

         ⚠️ مربوطٌ بـ`.chero__band` في تطبيق الطالب (`height: min(100vw, …)`).
         تغييرُ أحدهما بلا الآخر يجعل المحرِّر يضبط الوجه على إطارٍ لا وجود
         له — وحارسٌ في smoke يقرأ ملفّ التطبيق ويسقط إن انحرفا. */
      let photoPos = t?.photo_pos || '50% 50%';
      const focusBox = h('div', { style: 'margin-top:12px' });
      let focusTool = null;

      const drawFocus = (src) => {
        try { focusTool?._dispose?.(); } catch { /* لا شيء */ }
        focusTool = null;
        if (!src) { focusBox.replaceChildren(); return; }
        focusTool = C.imageFocus({
          src, ratio: '1 / 1', value: photoPos,
          onChange: (v) => { photoPos = v; },
        });
        focusBox.replaceChildren(focusTool);
      };
      drawFocus(Api.publicUrl(photoPath));

      const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/avif',
                                style: 'display:none' });
      file.addEventListener('change', () => {
        const f = file.files[0];
        if (!f) return;
        pickedFile = f;
        const url = URL.createObjectURL(f);
        drawPreview(url);   // معاينة فورية قبل الرفع
        // صورةٌ جديدة تبدأ من الوسط: موضعٌ ضُبط لأخرى لا معنى له عليها
        photoPos = '50% 50%';
        drawFocus(url);
      });

      const err = h('div');
      const fail = (m) => err.replaceChildren(
        h('div.badge.badge--err', { style: 'margin-bottom:12px' }, m));

      C.modal({
        title: isNew ? 'أستاذ جديد' : 'تعديل ملف الأستاذ',
        wide: true,
        body: h('div',
          err,
          h('div.row', { style: 'gap:16px;align-items:flex-start;margin-bottom:16px' },
            preview,
            h('div',
              h('button.btn.btn--sec.btn--sm', { onclick: () => file.click() },
                photoPath || pickedFile ? 'تبديل الصورة' : 'اختر صورة'),
              photoPath && h('button.btn.btn--ghost.btn--sm', {
                style: 'margin-inline-start:6px;color:var(--err)',
                onclick: () => { photoPath = null; pickedFile = null; drawPreview(null); drawFocus(null); },
              }, 'إزالة'),
              h('div.help', { style: 'margin-top:6px' },
                'بطاقة الأستاذ كاملة — الاسم والمادة والخبرة مرسومة داخل الصورة. '
                + 'صورة «مربّعة» (مثلًا ١٢٠٠×١٢٠٠) · PNG أو JPEG أو WebP · حتى ٥ م.ب. '
                + 'غلاف شاشة المادة مربّع، وما خرج عن المربّع يُقصّ — اضبط موضعه بالأداة أدناه.'),
              file)),
          focusBox,

          C.field('الاسم', name),
          C.field('الكود', code, 'حروف لاتينية صغيرة — معرّف ثابت لا يظهر للطالب.'),
          C.field('النبذة', bio,
            'تظهر في صفحة الأستاذ داخل التطبيق. اتركها فارغة إن لم تتوفّر بعد — '
            + 'التطبيق يخفي الفقرة كليًا بدل عرض نصّ مكانَه.'),
          C.field('الحساب المرتبط', profileSel,
            'يحدّد أي محتوى يملكه هذا الأستاذ. بلا ربط لا يستطيع تحرير أي شيء من اللوحة.'),
          C.field('الترتيب', order, 'الأصغر يظهر أولًا في صفّ «أساتذتنا».'),
          h('div.field', activeBox),
        ),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: async (close) => {
            const n = name.value.trim();
            const c = code.value.trim().toLowerCase();
            if (!n) return fail('الاسم مطلوب.');
            if (!/^[a-z0-9-]{2,40}$/.test(c)) return fail('الكود: حروف لاتينية صغيرة وأرقام وشرطات.');

            const clashCode = rows.find((x) => x.code === c && x.id !== t?.id);
            if (clashCode) return fail(`الكود «${c}» مستعمل فعلًا.`);

            // profile_id عليه فهرس فريد بالقاعدة — نمسك التصادم هنا برسالة
            // مفهومة بدل خطأ Postgres بالإنجليزية.
            const pid = profileSel.value || null;
            const clashAcc = pid && rows.find((x) => x.profile_id === pid && x.id !== t?.id);
            if (clashAcc) return fail(`هذا الحساب مرتبط فعلًا بالأستاذ «${clashAcc.name}».`);

            try {
              let path = photoPath;
              if (pickedFile) {
                path = await Api.uploadImage(pickedFile, 'teachers');
                // الصورة القديمة تُحذف بعد نجاح الرفع لا قبله — لو فشل الرفع
                // نكون قد أتلفنا الموجود بلا بديل.
                if (t?.photo_path && t.photo_path !== path) await Api.deleteImage(t.photo_path);
              } else if (t?.photo_path && !photoPath) {
                await Api.deleteImage(t.photo_path);
              }

              await Api.upsert('teachers', {
                id: t?.id || Store.newId(),
                code: c, name: n,
                bio: bio.value.trim() || null,
                photo_path: path,
                // بلا صورة لا معنى لموضع محفوظ
                photo_pos: path ? photoPos : null,
                profile_id: pid,
                sort_order: Number(order.value) || 0,
                is_active: active,
              });
              close();
              C.toast(isNew ? 'أُضيف الأستاذ' : 'حُفظت التعديلات');
              load();
            } catch (e) {
              fail(e.message || 'تعذّر الحفظ.');
            }
          } },
        ],
      });
    }

    load();
    return page;
  };
})();
