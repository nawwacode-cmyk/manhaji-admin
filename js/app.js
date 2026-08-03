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
        h('div.rail__uname', s.user || '—'),
        h('div.faint', { style: 'font-size:12px;margin-bottom:10px' }, role ? role.label : ''),
        h('button.btn.btn--ghost.btn--sm.btn--block', {
          style: 'color:var(--err)',
          onclick: () => { Store.signOut(); render(); },
        }, 'خروج')),
    );
  }

  /** مفتاح الوضع الليلي — بزاوية الترويسة العلوية اليسارية، بشكل on/off
   *  بين أيقونتَي شمس/قمر (بدل زر نصّي كان مدفونًا أسفل الشريط الجانبي). */
  function themeToggle() {
    const s = Store.get();
    const isDark = s.theme === 'dark';
    const setTheme = (dark) => { Store.setTheme(dark ? 'dark' : 'light'); render(); };

    const input = h('input', { type: 'checkbox', checked: isDark });
    input.addEventListener('change', () => setTheme(input.checked));

    const sun  = h('span.theme-ic' + (isDark ? '' : '.is-on'),
      { onclick: () => setTheme(false) }, icon.sun(16));
    const moon = h('span.theme-ic' + (isDark ? '.is-on' : ''),
      { onclick: () => setTheme(true) }, icon.moon(16));

    return h('div.switch-wrap', { title: 'الوضع الليلي' },
      sun,
      h('label.switch', input, h('span.switch__track', h('span.switch__thumb'))),
      moon);
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

    main.replaceChildren(C.pageHead(title, sub, themeToggle()), page);
    drawRail();
  }

  function go(id, p = {}) {
    current = id; params = p;
    render();
    main?.querySelector('.content')?.scrollTo(0, 0);
  }

  // قلم يكتب بحلقة لا نهائية — طابع "تعليمي" بدل مؤشر تحميل عام. SVG ثابت
  // بمحتوى معروف من عندنا، فاستخدام html هنا آمن (لا نصّ طالب يُمسَح).
  const PENCIL_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" class="pencil">
      <defs><clipPath id="pencil-eraser"><rect height="30" width="30" ry="5" rx="5"></rect></clipPath></defs>
      <circle transform="rotate(-113,100,100)" stroke-linecap="round" stroke-dashoffset="439.82" stroke-dasharray="439.82 439.82" stroke-width="2" stroke="currentColor" fill="none" r="70" class="pencil__stroke"></circle>
      <g transform="translate(100,100)" class="pencil__rotate">
        <g fill="none">
          <circle transform="rotate(-90)" stroke-dashoffset="402" stroke-dasharray="402.12 402.12" stroke-width="30" stroke="hsl(223,90%,50%)" r="64" class="pencil__body1"></circle>
          <circle transform="rotate(-90)" stroke-dashoffset="465" stroke-dasharray="464.96 464.96" stroke-width="10" stroke="hsl(223,90%,60%)" r="74" class="pencil__body2"></circle>
          <circle transform="rotate(-90)" stroke-dashoffset="339" stroke-dasharray="339.29 339.29" stroke-width="10" stroke="hsl(223,90%,40%)" r="54" class="pencil__body3"></circle>
        </g>
        <g transform="rotate(-90) translate(49,0)" class="pencil__eraser">
          <g class="pencil__eraser-skew">
            <rect height="30" width="30" ry="5" rx="5" fill="hsl(223,90%,70%)"></rect>
            <rect clip-path="url(#pencil-eraser)" height="30" width="5" fill="hsl(223,90%,60%)"></rect>
            <rect height="20" width="30" fill="hsl(223,10%,90%)"></rect>
            <rect height="20" width="15" fill="hsl(223,10%,70%)"></rect>
            <rect height="20" width="5" fill="hsl(223,10%,80%)"></rect>
            <rect height="2" width="30" y="6" fill="hsla(223,10%,10%,0.2)"></rect>
            <rect height="2" width="30" y="13" fill="hsla(223,10%,10%,0.2)"></rect>
          </g>
        </g>
        <g transform="rotate(-90) translate(49,-30)" class="pencil__point">
          <polygon points="15 0,30 30,0 30" fill="hsl(33,90%,70%)"></polygon>
          <polygon points="15 0,6 30,0 30" fill="hsl(33,90%,50%)"></polygon>
          <polygon points="15 0,20 10,10 10" fill="hsl(223,10%,10%)"></polygon>
        </g>
      </g>
    </svg>`;

  function renderLoading() {
    // width:100% ضروري: #app حاوية flex صفّية، فبلا هذا يتقلّص العنصر
    // الوحيد بداخلها إلى عرض نصّه فيظهر بزاوية الشاشة لا وسطها (نفس سبب
    // مشكلة .login في admin.css).
    document.getElementById('app').replaceChildren(
      h('div.boot-splash', { style: 'width:100%;height:100dvh' },
        h('div', { html: PENCIL_SVG })));
  }

  // انفجار قصير من الورق الملوّن — بلا مكتبة خارجية (canvas عادي)، فقط
  // لحظة ترحيب بعد الدخول الناجح فعلًا لا كل مرّة يُفتح فيها التطبيق.
  function fireConfetti(canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const COLORS = ['#2F6F73', '#57A9AD', '#F2B705', '#E4572E', '#5B8C5A'];
    const particles = Array.from({ length: 140 }, () => ({
      x: canvas.width / 2, y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 13, vy: (Math.random() - 1.6) * 11,
      size: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3,
      life: 0,
    }));

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.life++; p.vy += 0.22; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        const fade = Math.max(0, 1 - p.life / 90);
        if (fade <= 0) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (alive) requestAnimationFrame(tick);
    }
    tick();
  }

  /**
   * شاشة ترحيب لحظية بعد الدخول الناجح — تحلّ محلّ #app كليًا (بلا شريط
   * جانبي ولا ترويسة) ثم تنتقل تلقائيًا للوحة المعلومات، أو فورًا بضغطة زر.
   */
  function showWelcome() {
    const s = Store.get();
    const name = s.user ? ` ${s.user}` : '';
    const greeting = s.role === 'teacher' ? `أهلًا وسهلًا أستاذ${name}` : `أهلًا بك${name}`;

    let done = false;
    const proceed = () => { if (done) return; done = true; clearTimeout(timer); go('dashboard'); };

    const wrap = h('div.welcome',
      h('canvas.welcome__confetti'),
      h('div.welcome__card',
        h('img', { src: 'assets/icon-192.png', alt: '', width: 60, height: 60,
                   style: 'border-radius:16px' }),
        h('div.welcome__h', greeting),
        h('div.welcome__s', 'جاهز ليوم عمل جديد على لوحة منهاجي.'),
        h('button.btn.btn--primary', { onclick: proceed }, 'المتابعة إلى اللوحة')));

    document.getElementById('app').replaceChildren(wrap);
    fireConfetti(wrap.querySelector('canvas'));
    const timer = setTimeout(proceed, 4000);
  }

  async function boot() {
    const s = Store.get();
    document.documentElement.setAttribute('data-theme', s.theme);

    // توكن Supabase قد يبقى صالحًا عبر تحديث الصفحة حتى لو لم تُحفَظ حالة
    // اللوحة (الدور/المحتوى) محليًا — بلا هذا كان كل تحديث يبدو كطرد من
    // الجلسة رغم أن الدخول ما زال سليمًا فعليًا على السيرفر.
    if (!s.role && Api.isSignedIn()) {
      renderLoading();
      await Store.resume();
    }

    render();
  }

  return { go, render, boot, showWelcome };
})();

document.addEventListener('DOMContentLoaded', App.boot);
