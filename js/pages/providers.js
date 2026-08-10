/* =============================================================================
   المزوّدون — من يبيع الأكواد نيابةً عنّا

   الرصيد تراكمي لا رصيدًا متغيّرًا: `quota` مجموع ما مُنح على الإطلاق،
   والمستهلك يُحسب من عدد أكواده فعليًا، والمتبقّي فرقهما. لذلك «إضافة رصيد»
   هنا تزيد المجموع ولا تكتب رقمًا جديدًا فوق القديم — الأول يترك أثرًا
   قابلًا للمراجعة، والثاني يمحو تاريخ ما مُنح.

   الفرق بين «أُصدر» و«فُعِّل» مهم تجاريًّا: كودٌ بيع ولم يُفعَّل قد يعني
   طالبًا لم يستلمه، وهو سؤال يستحقّ أن يُطرح لا أن يُتجاهل.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ar', {
    year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  Pages.providers = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let rows = [], loadErr = null, busy = true;

    async function load() {
      busy = true;
      try {
        const r = await Api.rpc('admin_providers');
        rows = r.rows || []; loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل المزوّدين.'; }
      busy = false;
      draw();
    }

    function editor(p) {
      const isNew = !p;
      const v = p || { name: '', location: '', quota: 0, is_active: true };

      const name  = C.input({ value: v.name, placeholder: 'مكتبة النور' });
      const loc   = C.input({ value: v.location, placeholder: 'حلب — الفرقان' });
      const quota = C.input({ type: 'number', min: '0', value: String(v.quota ?? 0) });
      const err   = h('div.badge.badge--err', { style: 'display:none' });
      const show  = (m) => { err.textContent = m; err.style.display = ''; };

      const body = h('div',
        C.field('اسم المزوّد', name),
        C.field('الموقع', loc, 'المدينة أو الحي — لمعرفة تغطيتنا الجغرافية.'),
        C.field('الرصيد الكلّي', quota,
          isNew ? 'عدد الأكواد التي يستطيع إصدارها.'
                : `المُصدَر حتى الآن: ${ar(p.issued || 0)}. `
                  + 'ارفع الرقم لتزيد رصيده — المتبقّي = الرصيد ناقص المُصدَر.'),
        err);

      C.modal({
        title: isNew ? 'مزوّد جديد' : `تعديل: ${v.name}`,
        body,
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: isNew ? 'إنشاء' : 'حفظ', kind: 'primary', onClick: async (close) => {
            const row = {
              name: name.value.trim(),
              location: loc.value.trim(),
              quota: Math.max(0, parseInt(quota.value, 10) || 0),
            };
            if (!row.name || !row.location) return show('الاسم والموقع مطلوبان.');
            // خفضُ الرصيد دون ما أصدره فعلًا يجعل المتبقّي سالبًا منطقيًّا —
            // نمنعه هنا برسالة مفهومة بدل أن تُصفّره الدالّة صامتةً.
            if (!isNew && row.quota < (p.issued || 0)) {
              return show(`لا يمكن خفض الرصيد دون ما أصدره فعلًا (${ar(p.issued)}).`);
            }
            try {
              await Api.upsert('providers', isNew ? row : { id: p.id, ...row });
              C.toast(isNew ? 'أُضيف المزوّد' : 'حُفظ');
              close(); load();
            } catch (e) { show(e.message || 'تعذّر الحفظ.'); }
          } },
        ],
      });
    }

    /**
     * ربط حساب دخول بالمزوّد.
     *
     * الحساب يُنشأ من صفحة «الطاقم» بدور `provider`؛ هنا نربطه فقط. الفصل
     * مقصود: إنشاء الحسابات يمرّ بدالّة Edge تفرض شروط كلمة المرور، وتكرار
     * ذلك هنا يعني تعريفين لنفس القاعدة يمكن أن ينحرفا.
     */
    async function linkLogin(p) {
      let people = [];
      try {
        people = await Api.from('profiles',
          // `eq` لا `role:` — المفتاح الأخير مُهمَل، فكانت الصفحة تسرد **كل**
          // الحسابات (مديرين وأساتذة وطلابًا) لا المزوّدين وحدهم.
          { select: 'id,full_name,username,role', eq: { role: 'provider' }, order: 'created_at.desc' });
      } catch (e) { return C.toast(e.message || 'تعذّر جلب الحسابات', 'err'); }

      if (!people.length) {
        return C.modal({
          title: 'لا حسابات مزوّدين',
          body: h('div',
            h('div.mb', 'لا يوجد حساب بدور «مزوّد» بعد.'),
            h('span.help', 'أنشئ الحساب من صفحة «الطاقم» بدور مزوّد، ثم ارجع هنا لربطه.')),
          actions: [{ label: 'حسنًا', kind: 'primary', onClick: (c) => c() }],
        });
      }

      const sel = C.select(
        [['', '— اختر حسابًا —'], ...people.map((x) => [x.id, x.full_name || x.username || x.id])],
        p.profile_id || '');
      const err = h('div.badge.badge--err', { style: 'display:none' });

      C.modal({
        title: `ربط حساب دخول: ${p.name}`,
        body: h('div',
          C.field('الحساب', sel, 'الحسابات ذات الدور «مزوّد» فقط.'),
          err),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'ربط', kind: 'primary', onClick: async (close) => {
            if (!sel.value) { err.textContent = 'اختر حسابًا.'; err.style.display = ''; return; }
            try {
              // تعديل حقل واحد ⇒ update لا upsert (الأخيرة تشتكي من name/location
              // الإلزاميين رغم أن الصفّ موجود ولن يُدرَج شيء).
              await Api.update('providers', p.id, { profile_id: sel.value });
              C.toast('رُبط الحساب'); close(); load();
            } catch (e) { err.textContent = e.message || 'تعذّر الربط.'; err.style.display = ''; }
          } },
        ],
      });
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('المزوّدون', h('div.badge.badge--err', loadErr))); return; }

      const tot = rows.reduce((a, r) => ({
        issued: a.issued + (r.issued || 0),
        redeemed: a.redeemed + (r.redeemed || 0),
        remaining: a.remaining + (r.remaining || 0),
      }), { issued: 0, redeemed: 0, remaining: 0 });

      wrap.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('أكواد أصدرها المزوّدون', ar(tot.issued)),
          C.kpi('استعملها الطلاب', ar(tot.redeemed),
                tot.issued ? `${ar(Math.round(tot.redeemed / tot.issued * 100))}٪` : null),
          C.kpi('رصيد متبقٍّ لديهم', ar(tot.remaining))),

        C.card('المزوّدون',
          C.table(
            ['المزوّد', 'الموقع', 'الرصيد', 'أصدر', 'استُعمل', 'لم يُستعمل', 'متبقٍّ', 'الدخول', ''],
            rows, (r) => [
              h('div', { style: 'font-weight:600' }, r.name),
              h('span.faint.small', r.location),
              h('span.num', ar(r.quota || 0)),
              h('span.num', ar(r.issued || 0)),
              h('span.num', ar(r.redeemed || 0)),
              h('span.num', ar(r.unused || 0)),
              // نفاد الرصيد يوقف بيعه تمامًا — تمييزه بصريًّا يجعله ملحوظًا
              // قبل أن يتّصل شاكيًا لا بعده.
              (r.remaining || 0) === 0
                ? h('span.badge.badge--warn', 'نفد')
                : h('span.num', ar(r.remaining)),
              r.has_login
                ? h('span.badge.badge--ok', 'مربوط')
                : h('span.badge.badge--mute', 'بلا حساب'),
              C.actions(
                h('button.btn.btn--ghost.btn--sm', { onclick: () => editor(r) }, 'تعديل'),
                h('button.btn.btn--sec.btn--sm',
                  { onclick: () => linkLogin(r) }, r.has_login ? 'تغيير الحساب' : 'ربط حساب')),
            ], busy ? 'جارٍ التحميل…' : 'لا مزوّدين بعد.'),

          h('button.btn.btn--primary.btn--sm', { onclick: () => editor(null) }, 'مزوّد جديد')),

        h('div.mt', C.card('كيف يعمل الرصيد',
          h('span.help',
            'المزوّد يصدر كودًا واحدًا لكل طالب من رصيده، ويسجّل معه اسم الطالب '
            + 'ورقمه. حين ينفد رصيده يتوقّف عن الإصدار حتى تزيده — يعني أن دَينك '
            + 'عليه محدود دائمًا بما منحته، وأن حسابًا مخترَقًا لا يستطيع توليد '
            + 'أكواد بلا سقف. الفحص على السيرفر لا في هذه الصفحة.'))),
      );
    }

    load();
    return page;
  };
})();
