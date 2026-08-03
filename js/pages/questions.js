/* =============================================================================
   بنك الأسئلة — جدول + محرّر يدعم الأنواع الستة
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, fr, ar } = UI;
  const { typeName, sectionLabel } = Editors;

  Pages.questions = (params = {}) => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let fLesson = params.lesson || '';
    let fSection = params.section !== undefined ? params.section : '';
    let fUnit = '';
    let search = '';

    function draw() {
      const s = Store.get();
      const paths = Store.lessonPaths();

      let rows = s.questions;
      if (fLesson)  rows = rows.filter((q) => q.lesson === fLesson);
      if (fSection === '__none') rows = rows.filter((q) => !q.section);
      else if (fSection) rows = rows.filter((q) => q.section === fSection);
      if (fUnit)    rows = rows.filter((q) => q.unitCode === fUnit);
      if (search)   rows = rows.filter((q) => q.stem.includes(search));

      const selLesson = C.select([['', 'كل الدروس'], ...paths.map((l) => [l.id, `${l.title}`])], fLesson);
      selLesson.addEventListener('change', () => { fLesson = selLesson.value; draw(); });

      // القسم هو محور تصفّح الطالب الآن (مفردات/قاعدة/ترتيب حوار/مواضيع الوحدة) —
      // «غير مصنَّف» أهمّ خيار هنا عمليًا: هو قائمة عمل المدرّس لتصنيف ما تبقّى.
      const selSection = C.select([
        ['', 'كل الأقسام'], ['__none', '⚠ غير مصنَّف'], ...Store.SECTIONS,
      ], fSection);
      selSection.addEventListener('change', () => { fSection = selSection.value; fUnit = ''; draw(); });

      // الفرع تابع للقسم: تسميته تتغيّر معه (اسم موضوع الوحدة أو قاعدتها)
      // رغم أن القيمة المخزَّنة نفسها (u1..u6). لا معنى له بلا قسم محدَّد.
      const unitOpts = Store.unitOptionsFor(fSection || 'unite');
      const selUnit = C.select([['', 'كل الفروع'], ...unitOpts], fUnit,
        { disabled: !fSection || fSection === '__none' });
      selUnit.addEventListener('change', () => { fUnit = selUnit.value; draw(); });

      const inpSearch = C.input({ placeholder: 'ابحث في نص السؤال…', value: search });
      inpSearch.addEventListener('input', () => {
        search = inpSearch.value.trim();
        clearTimeout(inpSearch._t);
        inpSearch._t = setTimeout(draw, 250);
      });

      const unclassifiedCount = s.questions.filter((q) => !q.section).length;

      wrap.replaceChildren(
        unclassifiedCount > 0 && h('div.callout', { style: 'margin-bottom:14px' },
          h('div.callout__t', `${ar(unclassifiedCount)} سؤال غير مصنَّف بعد`),
          'هذه الأسئلة لا تظهر لأي طالب في تمارينه حتى تُصنَّف. ',
          h('button.btn.btn--sec.btn--sm', {
            style: 'margin-top:8px',
            onclick: () => { fSection = '__none'; fLesson = ''; draw(); },
          }, 'اعرضها الآن')),

        h('div.row.row--wrap.mb',
          h('div.filter-w', selLesson),
          h('div.filter-w', selSection),
          h('div.filter-w', selUnit),
          h('div.grow', { style: 'min-width:200px' }, inpSearch),
          h('button.btn.btn--primary', {
            onclick: () => Editors.question(null, {
              defaults: { lesson: fLesson || null, section: fSection && fSection !== '__none' ? fSection : null },
              onSaved: draw,
            }),
          }, '+ سؤال جديد')),

        C.card(null,
          C.table(['السؤال', 'القسم', 'الدرس', 'النوع', 'الصعوبة', 'الحالة', ''],
            rows, (q) => {
              const l = Store.lessonById(q.lesson);
              return [
                h('div', { style: 'max-width:380px' },
                  h('div', { style: 'font-weight:600' }, q.stem.slice(0, 70) + (q.stem.length > 70 ? '…' : '')),
                  q.source && h('div.faint.small', q.source)),
                h('div',
                  q.section
                    ? h('span.badge.badge--acc', sectionLabel(q.section))
                    : h('span.badge.badge--warn', 'غير مصنَّف'),
                  q.unitCode && h('div.faint', { style: 'font-size:11px;margin-top:3px' },
                    Store.unitLabel(q.section, q.unitCode))),
                l ? l.title : h('span.faint', '—'),
                h('span.badge.badge--mute', typeName(q.type).split(' ')[0]),
                h('span.num', ar(q.difficulty || 3) + '/٥'),
                C.pubBadge(q.published !== false),
                C.actions(
                  h('button.btn.btn--ghost.btn--sm', { onclick: () => Editors.previewQuestion(q) }, 'معاينة'),
                  h('button.btn.btn--sec.btn--sm', { onclick: () => Editors.question(q, { onSaved: draw }) }, 'تعديل'),
                  h('button.btn.btn--danger.btn--sm', {
                    onclick: () => C.confirmDialog('حذف السؤال',
                      'سيُحذف السؤال من البنك ومن أي امتحان يستخدمه.',
                      async () => {
                        try { await Store.remove('questions', q.id); C.toast('حُذف السؤال'); draw(); }
                        catch (e) { C.toast('تعذّر الحذف: ' + (e.message || ''), 'err'); }
                      }, 'حذف'),
                  }, 'حذف')),
              ];
            }, 'لا أسئلة مطابقة. جرّب تغيير المرشّحات أو أضف سؤالًا جديدًا.'),
          h('span.badge.badge--acc', `${ar(rows.length)} سؤال`)),
      );
    }


    draw();
    return page;
  };
})();
