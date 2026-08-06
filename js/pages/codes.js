/* =============================================================================
   أكواد التفعيل — توليد دفعات وتصدير CSV للموزّعين

   ⚠️ عقد جوهري: الأكواد الصريحة تصل من السيرفر **مرة واحدة** في استجابة
   التوليد، ولا تُخزَّن في أي مكان — القاعدة تعرف sha256(code+pepper) فقط.
   من أغلق النافذة قبل التنزيل فقد الأكواد إلى الأبد، ولذلك يُنزَّل الملف
   تلقائيًا فور التوليد ولا نكتفي بزرّ قد لا يُضغط.

   وهذا مقصود لا نقص: يعني أن تسريب قاعدة البيانات لا يعطي أحدًا كودًا صالحًا.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ar', {
    year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  Pages.codes = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let batches = [], packages = [], loadErr = null;

    async function load() {
      try {
        const [b, p] = await Promise.all([
          Api.invoke('admin-codes', { action: 'batches' }),
          Api.invoke('admin-codes', { action: 'packages' }),
        ]);
        batches = b.batches || []; packages = p.packages || []; loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل الأكواد.'; }
      draw();
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('الأكواد', h('div.badge.badge--err', loadErr))); return; }
      const sum = (k) => batches.reduce((a, b) => a + (b[k] || 0), 0);
      const total = sum('redeemed') + sum('available') + sum('revoked');

      wrap.replaceChildren(
        h('div.grid.grid--4.mb',
          C.kpi('أكواد مولَّدة', ar(total)),
          C.kpi('مستهلَكة', ar(sum('redeemed'))),
          C.kpi('متاحة للبيع', ar(sum('available'))),
          C.kpi('مُبطَلة', ar(sum('revoked')))),

        C.card('الدفعات',
          C.table(['الدفعة', 'الموزّع', 'العدد', 'مستهلَك', 'متاح', 'التاريخ', ''],
            batches, (b) => [
              h('div',
                h('div', { style: 'font-weight:600' }, b.label),
                b.notes && h('div.faint.small', b.notes)),
              b.distributor_name
                ? h('div',
                    h('div.small', b.distributor_name),
                    b.distributor_phone && h('div.faint.small.mono',
                      { style: 'direction:ltr;unicode-bidi:isolate' }, b.distributor_phone))
                : h('span.faint', '—'),
              h('span.num', ar(b.qty)),
              h('span.num', ar(b.redeemed)),
              h('span.num' + (b.available === 0 ? '.faint' : ''), ar(b.available)),
              h('span.faint.small', fmtDate(b.created_at)),
              C.actions(
                b.available > 0 && h('button.btn.btn--danger.btn--sm', {
                  onclick: () => C.confirmDialog('إبطال المتاح من الدفعة',
                    `سيُبطَل ${ar(b.available)} كودًا لم يُستهلك بعد، فلا يعود أي منها يعمل. `
                    + `الأكواد المستهلَكة (${ar(b.redeemed)}) لا تُمسّ — إبطالها يقطع اشتراكات مدفوعة.`,
                    async () => {
                      try {
                        const r = await Api.invoke('admin-codes',
                          { action: 'revoke_batch', batch_id: b.id });
                        C.toast(`أُبطل ${ar(r.revoked)} كودًا`); load();
                      } catch (e) { C.toast(e.message || 'تعذّر الإبطال', 'err'); }
                    }, 'إبطال'),
                }, 'إبطال المتاح')),
            ], 'لا دفعات بعد. ولّد أول دفعة لتبيعها عبر موزّع.'),
          h('button.btn.btn--primary.btn--sm', { onclick: () => generate() }, '+ توليد دفعة')),

        h('div.mt', C.card('الباقات المتاحة',
          C.table(['الرمز', 'الباقة', 'ما تفتحه', 'الحالة'], packages, (p) => [
            h('span.mono.small', p.code),
            h('div', { style: 'font-weight:600' }, p.title),
            h('div.faint.small', (p.grants || []).join(' + ') || '—'),
            p.is_active ? h('span.badge.badge--ok', 'فعّالة') : h('span.badge.badge--mute', 'معطّلة'),
          ], 'لا باقات.'))),

        h('div.help.mt',
          'الأكواد تُخزَّن مجزَّأة (hashed) لا بنصّها الصريح — تسريب قاعدة البيانات '
          + 'لا يعطي كودًا صالحًا واحدًا. لذلك ملف CSV الذي يُنزَّل عند التوليد هو '
          + 'النسخة الوحيدة: سلّمه للموزّع ثم احذفه من جهازك.'),
      );
    }

    // =========================================================================
    function generate() {
      const active = packages.filter((p) => p.is_active);
      if (!active.length) {
        return C.modal({ title: 'لا باقات فعّالة',
          body: h('div', 'الكود يفتح باقة، ولا توجد باقة فعّالة الآن. فعّل باقة أولًا.'),
          actions: [{ label: 'حسنًا', kind: 'primary', onClick: (c) => c() }] });
      }

      const qty   = C.input({ type: 'number', value: 50, min: 1, max: 2000 });
      const pkgS  = C.select(active.map((p) => [p.code, `${p.title} (${p.code})`]), active[0].code);
      const label = C.input({ placeholder: 'مكتبة النور — آب ٢٠٢٦' });
      const dist  = C.input({ placeholder: 'أبو أحمد' });
      const phone = C.input({ dir: 'ltr', placeholder: '09xxxxxxxx' });
      const days  = C.input({ type: 'number', value: 365, min: 1, max: 3650 });
      const notes = C.input({ placeholder: 'ملاحظة داخلية (اختياري)' });

      const scope = h('div.help');
      const drawScope = () => {
        const p = active.find((x) => x.code === pkgS.value);
        scope.textContent = 'يفتح: ' + ((p?.grants || []).join(' + ') || '—');
      };
      pkgS.addEventListener('change', drawScope); drawScope();

      const err = h('div');
      const say = (m, cls) => err.replaceChildren(
        h('div.badge.badge--' + cls, { style: 'margin-bottom:12px' }, m));

      C.modal({
        title: 'توليد دفعة أكواد',
        body: h('div',
          err,
          h('div.badge.badge--warn', { style: 'margin-bottom:14px' },
            'الأكواد تظهر مرة واحدة فقط ويُنزَّل ملفها تلقائيًا. لا يمكن استعادتها لاحقًا.'),
          C.field('الباقة', pkgS), scope,
          C.field('العدد', qty),
          C.field('مدّة الاشتراك (أيام)', days),
          C.field('اسم الدفعة', label, 'يظهر بالقائمة وبملف الموزّع.'),
          h('div.grid.grid--2',
            C.field('الموزّع', dist),
            C.field('هاتفه', phone)),
          C.field('ملاحظات', notes),
        ),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'ولّد ونزّل', kind: 'primary', onClick: async (close) => {
            const n = Number(qty.value);
            if (!Number.isInteger(n) || n < 1 || n > 2000) return say('العدد بين ١ و٢٠٠٠.', 'err');
            const d = Number(days.value);
            if (!Number.isInteger(d) || d < 1 || d > 3650) return say('المدّة بين يوم و٣٦٥٠ يومًا.', 'err');

            say('جارٍ التوليد… لا تغلق النافذة.', 'warn');
            try {
              const res = await Api.invoke('admin-codes', {
                action: 'generate', qty: n, package: pkgS.value, days: d,
                label: label.value.trim(), distributor: dist.value.trim(),
                phone: phone.value.trim(), notes: notes.value.trim(),
              });

              // التنزيل أولًا قبل أي رسم: هذه النسخة الوحيدة، وأي خطأ بعدها
              // يعني ضياعها. C.download يضيف BOM ليقرأ Excel العربية صحيحة.
              const scopeTxt = (res.package.grants || []).join(' + ');
              const csv = 'code,package,scope,days,batch\n'
                + res.codes.map((c) =>
                    `${c},"${res.package.title}","${scopeTxt}",${res.days},"${res.batch.label}"`
                  ).join('\n') + '\n';
              const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
              const file = `codes-${res.package.code}-${stamp}.csv`;
              C.download(file, csv);

              close();
              showCodes(res, csv, file);
              load();
            } catch (e) { say(e.message || 'تعذّر التوليد.', 'err'); }
          } },
        ],
      });
    }

    /** يعرض الأكواد بعد التنزيل التلقائي — لمن يريد النسخ اليدوي أو تنزيلًا ثانيًا. */
    function showCodes(res, csv, file) {
      const area = C.textarea({ rows: 10, readonly: true,
        style: 'font-family:var(--mono);direction:ltr;text-align:left' });
      area.value = res.codes.join('\n');

      C.modal({
        title: `وُلّد ${ar(res.codes.length)} كودًا`,
        wide: true,
        body: h('div',
          h('div.badge.badge--ok', { style: 'margin-bottom:12px' },
            'نُزِّل الملف تلقائيًا. هذه النسخة الوحيدة — احفظها ثم احذفها بعد التسليم.'),
          h('div.muted.small', { style: 'margin-bottom:12px' },
            `الباقة: ${res.package.title} · تفتح: ${(res.package.grants || []).join(' + ')} · `
            + `المدّة: ${ar(res.days)} يومًا · الدفعة: ${res.batch.label}`),
          area),
        actions: [
          { label: 'تنزيل مرة أخرى', onClick: () => C.download(file, csv) },
          { label: 'نسخ الكل', onClick: () => {
            area.select();
            navigator.clipboard?.writeText(res.codes.join('\n')).then(
              () => C.toast('نُسخت'), () => C.toast('انسخها يدويًا', 'err'));
          } },
          { label: 'حفظتها', kind: 'primary', onClick: (c) => c() },
        ],
      });
    }

    load();
    return page;
  };
})();
