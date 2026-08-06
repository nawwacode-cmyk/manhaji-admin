/* =============================================================================
   الدخول · لوحة المعلومات
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, fr, ar, icon } = UI;

  // --- الدخول ------------------------------------------------------------------
  Pages.login = () => {
    const user = C.input({ type: 'email', placeholder: 'name@example.com', autocomplete: 'username', dir: 'ltr' });
    const pass = C.input({ type: 'password', placeholder: '••••••', autocomplete: 'current-password' });
    const err = h('div');
    let busy = false;

    const submit = async () => {
      if (busy) return;
      if (!user.value.trim() || !pass.value) {
        user.classList.add('is-err'); pass.classList.add('is-err');
        err.replaceChildren(h('div.badge.badge--err', { style: 'margin-bottom:12px' }, 'أدخل البريد وكلمة المرور.'));
        return;
      }
      busy = true; btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
      const e = await Store.signIn(user.value.trim(), pass.value);
      busy = false; btn.disabled = false; btn.textContent = 'دخول';
      if (e) {
        user.classList.add('is-err'); pass.classList.add('is-err');
        err.replaceChildren(h('div.badge.badge--err', { style: 'margin-bottom:12px' }, e));
        return;
      }
      App.showWelcome();
    };
    [user, pass].forEach((i) => i.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      i.classList.remove('is-err'); err.replaceChildren();
    }));

    const btn = h('button.btn.btn--primary.btn--block', { style: 'margin-top:6px', onclick: submit }, 'دخول');

    return h('div.login',
      h('div.login__card',
        h('div.login__logo',
          h('img', { src: 'assets/icon-192.png', alt: '', width: 48, height: 48,
                     style: 'border-radius:14px' }),
          h('div',
            h('div', { style: 'font-weight:700;font-size:20px' }, 'لوحة منهاجي'),
            h('div.faint.small', 'إدارة المحتوى والاشتراكات'))),

        C.card(null, h('div',
          err,
          C.field('البريد الإلكتروني', user),
          C.field('كلمة المرور', pass),
          btn))),
    );
  };

  // --- لوحة المعلومات -----------------------------------------------------------
  //
  // كل الأرقام من admin_stats() — نداء واحد يعيد لقطة متّسقة. عشرة نداءات
  // متتابعة قد تقع بينها كتابات فتتناقض أرقامها على نفس الشاشة.
  //
  // الأستاذ لا يملك صلاحية تلك الدالة (is_admin داخلها)، فنعرض له لوحة محتوى
  // مبنية من الحالة المحمَّلة أصلًا بدل استدعاء يفشل بـ403.
  Pages.dashboard = () => {
    const s = Store.get();
    const isAdmin = s.role === 'admin';

    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    if (!isAdmin) { drawTeacher(); return page; }

    wrap.appendChild(h('div.center.muted', { style: 'padding:40px' }, 'جارٍ تحميل الإحصاءات…'));
    Api.rpc('admin_stats')
      .then(drawAdmin)
      .catch((e) => wrap.replaceChildren(
        C.card('لوحة المعلومات', h('div.badge.badge--err', e.message || 'تعذّر تحميل الإحصاءات.'))));

    // -------------------------------------------------------------------------
    function drawTeacher() {
      const lessons = s.lessons.length;
      const pub = s.lessons.filter((l) => l.published !== false).length;
      const gaps = s.lessons.filter((l) => Store.questionsOf(l.id).length === 0);
      const subject = s.subjects.find((x) => x.id === s.subjectId);

      wrap.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('دروس مادتك', ar(lessons), `${ar(pub)} منشور`),
          C.kpi('أسئلة مادتك', ar(s.questions.length)),
          C.kpi('دروس بلا أسئلة', ar(gaps.length),
                gaps.length ? 'تحتاج عملًا' : 'مكتمل',
                gaps.length ? 'var(--warn)' : undefined)),
        C.card(`نواقص ${subject ? subject.name : 'المادة'}`, gapsTable(gaps)));
    }

    function gapsTable(gaps) {
      if (!gaps.length) {
        return h('div.center.muted', { style: 'padding:24px' }, 'كل الدروس فيها أسئلة.');
      }
      return C.table(['الدرس', 'الوحدة', ''], gaps.slice(0, 20), (l) => {
        const unit = Store.get().units.find((u) => u.id === l.unit);
        return [
          h('div', { style: 'font-weight:600' }, l.title),
          h('span.faint.small', unit ? unit.title : '—'),
          C.actions(h('button.btn.btn--sec.btn--sm',
            { onclick: () => App.go('content', { lesson: l.id }) }, 'فتح')),
        ];
      });
    }

    // -------------------------------------------------------------------------
    function drawAdmin(st) {
      const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

      wrap.replaceChildren(
        h('div.grid.grid--4.mb',
          C.kpi('الطلاب', ar(st.students.total), `${ar(st.students.new_30d)} جديد هذا الشهر`),
          C.kpi('اشتراكات فعّالة', ar(st.subscriptions.active),
                `${ar(st.students.active_7d)} دخلوا هذا الأسبوع`),
          C.kpi('أكواد متاحة', ar(st.codes.available),
                `${ar(st.codes.redeemed)} مستهلَك من ${ar(st.codes.total)}`,
                st.codes.available === 0 ? 'var(--warn)' : undefined),
          C.kpi('تنتهي خلال شهر', ar(st.subscriptions.expiring_30d), 'تحتاج تجديدًا',
                st.subscriptions.expiring_30d > 0 ? 'var(--warn)' : undefined)),

        C.card('التسجيلات — آخر ٣٠ يومًا', sparkline(st.signups_30d)),

        h('div.grid.grid--side.mt',
          C.card('نواقص المحتوى', h('div',
            h('div.help', { style: 'margin-bottom:12px' },
              'هذه أولوية العمل: درس منشور بلا أسئلة يراه الطالب ناقصًا.'),
            gapRow('دروس منشورة بلا أسئلة', st.gaps.lessons_no_questions, st.content.lessons_published),
            gapRow('دروس منشورة بلا فيديو', st.gaps.lessons_no_video, st.content.lessons_published),
            gapRow('أسئلة غير مصنَّفة بقسم', st.gaps.questions_unclassified, st.content.questions))),

          C.card('المحتوى', h('div',
            row('المواد', ar(st.content.subjects)),
            row('الوحدات', ar(st.content.units)),
            row('الدروس', `${ar(st.content.lessons_published)} / ${ar(st.content.lessons)}`),
            row('الأسئلة', `${ar(st.content.questions_published)} / ${ar(st.content.questions)}`),
            row('الامتحانات', ar(st.content.exams)),
            row('الأساتذة', ar(st.content.teachers)),
            row('بانرات ظاهرة الآن', ar(st.content.banners_live))))),

        h('div.help.mt',
          `آخر تحديث: ${new Date(st.generated_at).toLocaleString('ar')} · `
          + `نسبة استهلاك الأكواد: ${ar(pct(st.codes.redeemed, st.codes.total))}٪`),
      );
    }

    const row = (k, v) => h('div.row', { style: 'padding:9px 0;border-top:1px solid var(--brd)' },
      h('div.grow.small', k), h('span.num', v));

    function gapRow(label, n, of) {
      const bad = n > 0;
      return h('div', { style: 'padding:11px 0;border-top:1px solid var(--brd)' },
        h('div.row',
          h('div.grow.small', { style: 'font-weight:600' }, label),
          h('span.badge.badge--' + (bad ? 'warn' : 'ok'),
            bad ? `${ar(n)} من ${ar(of)}` : 'لا نواقص')),
        of > 0 && h('div.bar', { style: 'margin-top:7px' },
          h('i', { style: `width:${Math.round(((of - n) / of) * 100)}%` })));
    }

    /**
     * رسم خطّي بـ<canvas> عادي بلا مكتبة — نفس نهج fireConfetti في app.js.
     * إضافة مكتبة رسوم لأجل خطّ من ٣٠ نقطة تكلفة لا تُبرَّر في مشروع بلا
     * خطوة بناء أصلًا.
     */
    function sparkline(series) {
      const box = h('div', { style: 'padding:8px 4px' });
      const cv = h('canvas', { style: 'width:100%;height:160px;display:block' });
      box.appendChild(cv);

      // القياس بعد الإلحاق بالـDOM: قبله offsetWidth = 0 فيخرج الرسم فارغًا
      requestAnimationFrame(() => {
        const dpr = window.devicePixelRatio || 1;
        const w = cv.offsetWidth, hh = cv.offsetHeight;
        if (!w) return;
        cv.width = w * dpr; cv.height = hh * dpr;
        const c = cv.getContext('2d');
        c.scale(dpr, dpr);

        const vals = (series || []).map((p) => p.n);
        if (!vals.length) return;
        const max = Math.max(1, ...vals);
        const pad = { t: 14, b: 22, l: 6, r: 6 };
        const iw = w - pad.l - pad.r, ih = hh - pad.t - pad.b;
        const x = (i) => pad.l + (i / Math.max(1, vals.length - 1)) * iw;
        const y = (v) => pad.t + ih - (v / max) * ih;

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--acc') || '#5B4B9E').trim();
        const line = (css.getPropertyValue('--brd') || '#E1DAF0').trim();
        const txm = (css.getPropertyValue('--txm') || '#6B5F8C').trim();

        // شبكة أفقية خفيفة تعطي الأرقام مرجعًا بدل خطّ عائم
        c.strokeStyle = line; c.lineWidth = 1;
        for (let g = 0; g <= 2; g++) {
          const yy = pad.t + (ih / 2) * g;
          c.beginPath(); c.moveTo(pad.l, yy); c.lineTo(w - pad.r, yy); c.stroke();
        }

        c.beginPath();
        c.moveTo(x(0), y(vals[0]));
        vals.forEach((v, i) => c.lineTo(x(i), y(v)));
        c.lineTo(x(vals.length - 1), pad.t + ih);
        c.lineTo(x(0), pad.t + ih);
        c.closePath();
        const grad = c.createLinearGradient(0, pad.t, 0, pad.t + ih);
        grad.addColorStop(0, acc + '55');
        grad.addColorStop(1, acc + '00');
        c.fillStyle = grad; c.fill();

        c.beginPath();
        vals.forEach((v, i) => (i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v))));
        c.strokeStyle = acc; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();

        // نقطة النهاية مُبرَزة: «اليوم» أول ما تبحث عنه العين
        c.beginPath();
        c.arc(x(vals.length - 1), y(vals[vals.length - 1]), 4, 0, Math.PI * 2);
        c.fillStyle = acc; c.fill();

        c.fillStyle = txm;
        c.font = '11px ' + ((css.getPropertyValue('--font') || 'sans-serif').trim());
        c.textAlign = 'right';
        c.fillText(ar(max), w - pad.r, pad.t - 3);
        c.textAlign = 'left';
        c.fillText(ar(vals.reduce((a, b) => a + b, 0)) + ' تسجيلًا', pad.l, hh - 6);
      });

      return box;
    }

    return page;
  };
})();
