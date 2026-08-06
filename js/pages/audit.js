/* =============================================================================
   سجلّ النشاط — من فعل ماذا ومتى

   الجدول append-only على مستوى الصلاحيات: لا منح insert/update/delete لأي دور
   عميل إطلاقًا. الكتابة تتم حصرًا من دوال SECURITY DEFINER و Edge Functions.
   سجلٌّ يمكن لأحد تعديله ليس سجلًّا.

   لماذا يهمّ؟ كلمة مرور طاقم مسرَّبة تعطي وصولًا **صامتًا** ومستمرًّا — الطالب
   على الأقل يلاحظ أنه طُرد بسبب الجلسة الواحدة. هذا السجلّ هو ما يجعل ذلك
   الوصول غير صامت.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  // وصف عربي لكل فعل + تصنيف خطورته. الفعل غير المعروف يُعرض برمزه الخام
  // بدل إخفائه — سجلّ يُخفي ما لا يفهمه أسوأ من سجلّ خام.
  const ACTIONS = {
    'staff.create':        ['أنشأ حساب طاقم', 'warn'],
    'staff.update':        ['حدّث حساب طاقم', 'mute'],
    'staff.set_role':      ['غيّر دور حساب', 'warn'],
    'staff.disable':       ['عطّل حسابًا', 'err'],
    'staff.enable':        ['أعاد تفعيل حساب', 'ok'],
    'staff.login':         ['دخل إلى اللوحة', 'mute'],
    'codes.generate':      ['ولّد أكوادًا', 'warn'],
    'codes.revoke_batch':  ['أبطل دفعة أكواد', 'err'],
    'device.revoke':       ['فكّ ارتباط جهاز', 'mute'],
    'subscription.revoke': ['ألغى اشتراكًا', 'err'],
  };

  const PAGE = 50;

  Pages.audit = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let rows = [], offset = 0, filter = '', loadErr = null;

    async function load() {
      try {
        const q = { select: '*', order: 'at.desc' };
        let path = `audit_log?select=*&order=at.desc&limit=${PAGE}&offset=${offset}`;
        if (filter) path += `&action=like.${encodeURIComponent(filter + '%')}`;
        rows = await Api.request(`/rest/v1/${path}`);
        loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل السجلّ.'; }
      draw();
    }

    const fmt = (iso) => new Date(iso).toLocaleString('ar', {
      dateStyle: 'medium', timeStyle: 'short' });

    /** تفصيل مقروء لمحتوى meta — لا JSON خام في وجه المستخدم. */
    function describe(r) {
      const m = r.meta || {};
      const bits = [];
      if (m.email) bits.push(m.email);
      if (m.name) bits.push(m.name);
      if (m.role) bits.push(`الدور: ${m.role === 'admin' ? 'مدير' : 'أستاذ'}`);
      if (m.qty) bits.push(`${ar(m.qty)} كودًا`);
      if (m.package) bits.push(`باقة: ${m.package}`);
      if (m.days) bits.push(`${ar(m.days)} يومًا`);
      if (m.label) bits.push(m.label);
      if (m.revoked !== undefined) bits.push(`أُبطل ${ar(m.revoked)}`);
      return bits.join(' · ');
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('سجلّ النشاط', h('div.badge.badge--err', loadErr))); return; }

      const sel = C.select([
        ['', 'كل الأفعال'],
        ['staff', 'الحسابات'],
        ['codes', 'الأكواد'],
        ['subscription', 'الاشتراكات'],
        ['device', 'الأجهزة'],
      ], filter);
      sel.addEventListener('change', () => { filter = sel.value; offset = 0; load(); });

      wrap.replaceChildren(
        h('div.row.mb', { style: 'gap:10px;flex-wrap:wrap' },
          h('div.filter-w', sel)),

        C.card('سجلّ النشاط',
          C.table(['الوقت', 'من', 'الفعل', 'التفصيل'], rows, (r) => {
            const [label, kind] = ACTIONS[r.action] || [r.action, 'mute'];
            return [
              h('span.faint.small', { style: 'white-space:nowrap' }, fmt(r.at)),
              h('div.small', { style: 'font-weight:600' }, r.actor_label || '—'),
              h('span.badge.badge--' + kind, label),
              h('div.faint.small', describe(r)),
            ];
          }, 'لا نشاط مسجَّل بعد.'),

          h('div.row', { style: 'gap:8px' },
            h('button.btn.btn--ghost.btn--sm', {
              disabled: offset === 0,
              onclick: () => { offset = Math.max(0, offset - PAGE); load(); },
            }, 'الأحدث'),
            h('button.btn.btn--ghost.btn--sm', {
              disabled: rows.length < PAGE,
              onclick: () => { offset += PAGE; load(); },
            }, 'الأقدم'))),

        h('div.help.mt',
          'السجلّ لا يُعدَّل ولا يُحذف من اللوحة — لا صلاحية insert أو update أو '
          + 'delete لأي حساب عميل، حتى المدير. الكتابة من السيرفر وحده.'),
      );
    }

    load();
    return page;
  };
})();
