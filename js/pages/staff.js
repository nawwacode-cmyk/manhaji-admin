/* =============================================================================
   الطاقم — حسابات الأساتذة والمديرين

   كل ما هنا يمرّ بـ Edge Function `admin-staff`: إنشاء مستخدم في Supabase Auth
   يتطلّب Auth Admin API أي مفتاح service_role، وذاك المفتاح يتجاوز RLS كليًا
   فلا يجوز أن يصل المتصفح بأي حال.

   والدور نفسه غير قابل للكتابة من هنا مهما حاولنا: المنح على مستوى العمود
   يمنعه، ومُشغّل guard_profile_role يردّه. الدالة هي المسار الشرعي الوحيد.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const ROLE_LABEL = { admin: 'مدير', teacher: 'أستاذ' };

  /** مولّد كلمة مرور يستوفي شروط السيرفر — أضمن من ابتكار واحدة يدويًا. */
  function strongPassword() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', a = 'abcdefghijkmnopqrstuvwxyz';
    const n = '23456789', s = '!@#%^*-_=+';
    const all = A + a + n + s;
    const pick = (set, k = 1) => {
      const b = crypto.getRandomValues(new Uint32Array(k));
      return Array.from({ length: k }, (_, i) => set[b[i] % set.length]).join('');
    };
    // نضمن صنفًا من كل نوع ثم نخلط — التوليد العشوائي البحت قد يخرج بلا رقم
    const base = (pick(A, 2) + pick(a, 6) + pick(n, 3) + pick(s, 2) + pick(all, 5)).split('');
    const ord = crypto.getRandomValues(new Uint32Array(base.length));
    return base.map((c, i) => [ord[i], c]).sort((x, y) => x[0] - y[0]).map((x) => x[1]).join('');
  }

  Pages.staff = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let rows = [], loadErr = null;

    async function load() {
      try {
        rows = (await Api.invoke('admin-staff', { action: 'list' })).staff || [];
        loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل الطاقم.'; }
      draw();
    }

    async function act(body, okMsg) {
      try {
        await Api.invoke('admin-staff', body);
        C.toast(okMsg); load();
      } catch (e) { C.toast(e.message || 'تعذّرت العملية', 'err'); }
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('الطاقم', h('div.badge.badge--err', loadErr))); return; }
      const admins = rows.filter((s) => s.role === 'admin' && !s.disabled).length;

      wrap.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('حسابات الطاقم', ar(rows.length)),
          C.kpi('مديرون', ar(admins),
                admins === 1 ? 'مدير واحد — لا يمكن تنزيله أو تعطيله' : undefined),
          C.kpi('معطَّلة', ar(rows.filter((s) => s.disabled).length))),

        C.card('الطاقم',
          C.table(['الاسم', 'البريد', 'الدور', 'الحالة', ''], rows, (s) => [
            h('div', { style: 'font-weight:600' }, s.name || '—'),
            h('span.mono.small', { style: 'direction:ltr;unicode-bidi:isolate' }, s.email),
            h('span.badge.badge--' + (s.role === 'admin' ? 'ok' : 'mute'), ROLE_LABEL[s.role] || s.role),
            s.disabled ? h('span.badge.badge--err', 'معطَّل') : h('span.badge.badge--ok', 'فعّال'),
            C.actions(
              h('button.btn.btn--sec.btn--sm', {
                onclick: () => C.confirmDialog(
                  s.role === 'admin' ? 'تنزيل إلى أستاذ' : 'ترقية إلى مدير',
                  s.role === 'admin'
                    ? `سيفقد «${s.name}» إدارة الأكواد والطلاب والحسابات، ويبقى يحرّر محتوى موادّه.`
                    : `سيحصل «${s.name}» على كل الصلاحيات: الأكواد وبيانات الطلاب وإنشاء الحسابات.`,
                  () => act({ action: 'set_role', user_id: s.id,
                              role: s.role === 'admin' ? 'teacher' : 'admin' }, 'حُدّث الدور'),
                  'تأكيد'),
              }, s.role === 'admin' ? 'اجعله أستاذًا' : 'اجعله مديرًا'),
              h('button.btn.btn--sec.btn--sm', { onclick: () => resetPassword(s) }, 'كلمة المرور'),
              h('button.btn.btn--' + (s.disabled ? 'sec' : 'danger') + '.btn--sm', {
                onclick: () => s.disabled
                  ? act({ action: 'enable', user_id: s.id }, 'أُعيد تفعيل الحساب')
                  : C.confirmDialog('تعطيل الحساب',
                      `لن يستطيع «${s.name}» الدخول. محتواه وسجلّاته تبقى كما هي، `
                      + 'والتعطيل قابل للتراجع — لذلك لا نحذف الحسابات.',
                      () => act({ action: 'disable', user_id: s.id }, 'عُطِّل الحساب'), 'تعطيل'),
              }, s.disabled ? 'تفعيل' : 'تعطيل')),
          ], 'لا حسابات طاقم.'),
          h('button.btn.btn--primary.btn--sm', { onclick: () => create() }, '+ حساب جديد')),
      );
    }

    /** يعرض كلمة المرور مرة واحدة مع زرّ نسخ — لا تُخزَّن ولا تُعرض ثانيةً. */
    function showSecret(title, note, secret) {
      const box = C.input({ value: secret, readonly: true, dir: 'ltr',
        style: 'font-family:var(--mono);font-weight:700' });
      C.modal({
        title,
        body: h('div',
          h('div.badge.badge--warn', { style: 'margin-bottom:12px' },
            'هذه هي المرة الوحيدة التي تظهر فيها — انسخها الآن.'),
          h('div.muted.small', { style: 'margin-bottom:12px' }, note),
          box),
        actions: [
          { label: 'نسخ', onClick: () => {
            box.select();
            navigator.clipboard?.writeText(secret).then(
              () => C.toast('نُسخت'), () => C.toast('انسخها يدويًا', 'err'));
          } },
          { label: 'تمّ', kind: 'primary', onClick: (c) => c() },
        ],
      });
    }

    function resetPassword(s) {
      const pw = strongPassword();
      C.confirmDialog('تعيين كلمة مرور جديدة',
        `ستُستبدل كلمة مرور «${s.name}» بأخرى مولَّدة. جلساته الحالية تبقى `
        + 'فعّالة حتى تنتهي — التعطيل هو ما يقطع الوصول فورًا.',
        async () => {
          try {
            await Api.invoke('admin-staff', {
              action: 'create', email: s.email, password: pw, name: s.name, role: s.role });
            showSecret('كلمة المرور الجديدة', `الحساب: ${s.email}`, pw);
            load();
          } catch (e) { C.toast(e.message || 'تعذّرت العملية', 'err'); }
        }, 'توليد');
    }

    function create() {
      const email = C.input({ type: 'email', dir: 'ltr', placeholder: 'name@example.com' });
      const name  = C.input({ placeholder: 'نوار بشناق' });
      const roleS = C.select([['teacher', 'أستاذ — يحرّر محتوى موادّه'],
                              ['admin', 'مدير — كل الصلاحيات']], 'teacher');
      let pw = strongPassword();
      const pwBox = C.input({ value: pw, dir: 'ltr', style: 'font-family:var(--mono)' });

      const err = h('div');
      const fail = (m) => err.replaceChildren(h('div.badge.badge--err', { style: 'margin-bottom:12px' }, m));

      C.modal({
        title: 'حساب طاقم جديد',
        body: h('div',
          err,
          C.field('البريد', email,
            'يُستعمل للدخول فقط — لا يُرسل إليه شيء. لا حاجة لأن يكون بريدًا حقيقيًا، '
            + 'لكن إن لم يكن كذلك فلا استرداد ذاتي لكلمة المرور.'),
          C.field('الاسم', name, 'يظهر باللوحة وفي سجلّ النشاط.'),
          C.field('الدور', roleS),
          C.field('كلمة المرور', h('div.row', { style: 'gap:8px' },
            pwBox,
            h('button.btn.btn--sec.btn--sm', {
              onclick: () => { pw = strongPassword(); pwBox.value = pw; },
            }, 'ولّد غيرها')),
            '١٢ محرفًا على الأقل، بحرف كبير وصغير ورقم — يفرضها السيرفر لا هذه الشاشة.'),
        ),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'إنشاء', kind: 'primary', onClick: async (close) => {
            const e = email.value.trim().toLowerCase();
            const n = name.value.trim();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return fail('بريد غير صالح.');
            if (!n) return fail('الاسم مطلوب.');
            try {
              const res = await Api.invoke('admin-staff', {
                action: 'create', email: e, password: pwBox.value, name: n, role: roleS.value });
              close();
              showSecret(res.created ? 'أُنشئ الحساب' : 'حُدّث الحساب',
                `البريد: ${e} · الدور: ${ROLE_LABEL[roleS.value]}`, pwBox.value);
              load();
            } catch (e2) { fail(e2.message || 'تعذّر الإنشاء.'); }
          } },
        ],
      });
    }

    load();
    return page;
  };
})();
