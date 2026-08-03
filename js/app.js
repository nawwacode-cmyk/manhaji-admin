/* =============================================================================
   app.js — الهيكل والتوجيه والصلاحيات
   ============================================================================= */
window.App = (function () {
  const { h, ar, icon } = UI;

  // مرحلة حالية مقصودة: مفردات هذا المشروع الآن هي إنهاء محتوى الفرنسي —
  // الدروس وبنك الأسئلة فقط، متّصلان فعليًا بقاعدة بيانات حقيقية. باقي
  // الأقسام (امتحانات مركَّبة، فيديو، أكواد، طلاب) لا تزال على بيانات وهمية
  // ولا علاقة لها بهذه المرحلة، فأُخفيت من القائمة بدل أن تبدو جاهزة وهي
  // ليست كذلك. صفحاتها موجودة كما هي بالكامل — أعد هذه الأسطر عند وصلها.
  const NAV = [
    { sec: 'الرئيسية' },
    { id: 'dashboard', label: 'لوحة المعلومات', ico: () => icon.grid(19) },
    { sec: 'المحتوى' },
    { id: 'content',   label: 'الدروس',      ico: () => icon.book(19) },
    { id: 'questions', label: 'بنك الأسئلة', ico: () => icon.help(19) },
    // { id: 'exams',     label: 'الامتحانات',    ico: () => icon.exam(19) },
    // { id: 'videos',    label: 'الفيديوهات',    ico: () => icon.video(19) },
    // { sec: 'الإدارة' },
    // { id: 'codes',     label: 'أكواد التفعيل', ico: () => icon.key(19) },
    // { id: 'students',  label: 'الطلاب',        ico: () => icon.users(19) },
  ];

  const TITLES = {
    dashboard: ['لوحة المعلومات', 'نظرة سريعة على المحتوى والطلاب'],
    content:   ['الدروس', 'الكتب والوحدات والدروس'],
    questions: ['بنك الأسئلة', 'كل الأسئلة، مرتبطة بدروسها ومواضيعها'],
    exams:     ['الامتحانات', 'تجريبية ووزارية، تُركَّب من بنك الأسئلة'],
    videos:    ['الفيديوهات', 'المكتبة والرفع والربط بالدروس'],
    codes:     ['أكواد التفعيل', 'توليد الدفعات وتصديرها للموزّعين'],
    students:  ['الطلاب', 'الاشتراكات والتقدّم وفكّ ارتباط الأجهزة'],
  };

  let current = 'dashboard';
  let params = {};
  let rail, main;

  function shell() {
    const root = document.getElementById('app');
    rail = h('aside.rail');
    main = h('div.main');
    root.replaceChildren(rail, main);
  }

  function drawRail() {
    const s = Store.get();
    const role = Store.ROLES[s.role];

    rail.replaceChildren(
      h('div.rail__brand',
        h('img', { src: 'assets/icon-192.png', alt: '', width: 40, height: 40,
                   style: 'border-radius:11px' }),
        h('div',
          h('div.rail__name', 'لوحة منهاجي'),
          h('div.rail__tag', 'إدارة المحتوى والاشتراكات'))),

      ...NAV.flatMap((it) => {
        if (it.sec) {
          // لا نعرض عنوان قسم لا يملك المستخدم أي صفحة تحته
          const after = NAV.slice(NAV.indexOf(it) + 1);
          const upto = after.slice(0, after.findIndex((x) => x.sec) === -1
            ? after.length : after.findIndex((x) => x.sec));
          return upto.some((x) => Store.can(x.id)) ? [h('div.rail__sec', it.sec)] : [];
        }
        if (!Store.can(it.id)) return [];
        return [h('button', {
          class: current === it.id ? 'is-on' : '',
          onclick: () => go(it.id),
        }, it.ico(), it.label)];
      }),

      h('div.rail__spacer'),

      h('div.rail__user',
        h('div.row', { style: 'margin-bottom:8px' },
          h('div.grow',
            h('div', { style: 'font-weight:700;font-size:14px' }, s.user || '—'),
            h('div.faint', { style: 'font-size:12px' }, role ? role.label : '')),
          h('button.btn.btn--ghost.btn--sm', {
            title: 'الوضع الليلي',
            onclick: () => { Store.setTheme(s.theme === 'dark' ? 'light' : 'dark'); render(); },
          }, s.theme === 'dark' ? '☀' : '☾')),
        h('button.btn.btn--ghost.btn--sm.btn--block', {
          onclick: () => { Store.signOut(); render(); },
        }, 'خروج')),
    );
  }

  function render() {
    const s = Store.get();
    document.documentElement.setAttribute('data-theme', s.theme);

    if (!s.role) {
      document.getElementById('app').replaceChildren(Pages.login());
      return;
    }

    shell();

    // حارس الصلاحيات: المدرّس الذي يصل لصفحة إدارية عبر رابط قديم يُعاد
    // إلى لوحته بدل أن يرى صفحة فارغة أو بيانات لا تخصّه.
    if (!Store.can(current)) current = 'dashboard';

    const [title, sub] = TITLES[current] || ['', ''];
    const page = (Pages[current] || Pages.dashboard)(params);

    main.replaceChildren(C.pageHead(title, sub), page);
    drawRail();
  }

  function go(id, p = {}) {
    current = id; params = p;
    render();
    main?.querySelector('.content')?.scrollTo(0, 0);
  }

  function boot() {
    const s = Store.get();
    document.documentElement.setAttribute('data-theme', s.theme);
    render();
  }

  return { go, render, boot };
})();

document.addEventListener('DOMContentLoaded', App.boot);
