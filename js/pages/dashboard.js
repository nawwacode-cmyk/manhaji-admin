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
  Pages.dashboard = () => {
    const s = Store.get();
    const st = Store.stats();
    const isAdmin = s.role === 'admin';

    const page = h('div.content', h('div.wrap'));
    const wrap = page.firstChild;

    // مؤشرات سريعة
    wrap.appendChild(h('div.grid.grid--4',
      C.kpi('الدروس', ar(st.lessons), `${ar(st.lessonsPub)} منشور`),
      C.kpi('الأسئلة', ar(st.questions), `${ar(st.questionsPub)} منشور`),
      C.kpi('الامتحانات', ar(st.exams), `${ar(st.examsPub)} منشور`),
      isAdmin
        ? C.kpi('الطلاب', ar(st.students), `${ar(st.activeStudents)} نشط هذا الأسبوع`)
        : C.kpi('الفيديوهات', ar(st.videos), `${st.videoMb} م.ب`)));

    if (isAdmin) {
      wrap.appendChild(h('div.grid.grid--3', { style: 'margin-top:16px' },
        C.kpi('أكواد مولَّدة', ar(st.codes), `${ar(st.codesUsed)} مستعمَل`),
        C.kpi('الفيديوهات', ar(st.videos), `${st.videoMb} م.ب إجمالًا`),
        C.kpi('أجهزة بلا ربط', ar(s.students.filter((x) => !x.device).length),
              'طلاب لا يستطيعون الدخول')));
    }

    // --- قائمة العمل: الفجوات في المحتوى ---
    // هذه أهم بطاقة في اللوحة: تحوّل «المحتوى ناقص» من إحساس غامض إلى قائمة
    // مهام محدّدة يمكن إنهاؤها.
    wrap.appendChild(h('div.grid.grid--side', { style: 'margin-top:16px' },
      C.card('نواقص المحتوى',
        st.gaps.length
          ? C.table(['الدرس', 'الناقص', ''], st.gaps, (l) => {
              const missing = [];
              if (!l.video) missing.push('فيديو');
              if (!Store.questionsOf(l.id).length) missing.push('أسئلة');
              return [
                h('div', h('div', { style: 'font-weight:600' }, l.title),
                  h('div.faint.small', l.id)),
                h('div.row--wrap.row', ...missing.map((m) => h('span.badge.badge--warn', m))),
                C.actions(h('button.btn.btn--sec.btn--sm', {
                  onclick: () => App.go('content', { lesson: l.id }),
                }, 'افتح الدرس')),
              ];
            })
          : h('div.center.muted', { style: 'padding:24px' },
              'كل الدروس مكتملة — فيديو وأسئلة لكل درس.'),
        h('span.badge.' + (st.gaps.length ? 'badge--warn' : 'badge--ok'),
          st.gaps.length ? `${ar(st.gaps.length)} درس` : 'مكتمل')),

      h('div',
        C.card('أصعب الأسئلة',
          h('div',
            h('div.help', { style: 'margin-bottom:12px' },
              'نسبة إجابة صحيحة منخفضة جدًا قد تعني سؤالًا سيّئ الصياغة لا طلابًا ضعافًا. '
              + 'راجع هذه أولًا.'),
            ...SEED.hardQuestions.map((hq) => {
              const q = s.questions.find((x) => x.id === hq.id);
              return h('div', { style: 'padding:10px 0;border-top:1px solid var(--brd)' },
                h('div.row',
                  h('div.grow.small', { style: 'font-weight:600' },
                    q ? q.stem.slice(0, 46) + (q.stem.length > 46 ? '…' : '') : hq.id),
                  h('span.badge.' + (hq.rate < 30 ? 'badge--err' : 'badge--warn'), ar(hq.rate) + '٪')),
                h('div.faint.small', `${ar(hq.attempts)} محاولة`));
            }))),

        isAdmin && C.card('آخر الطلاب',
          h('div', ...s.students.slice(0, 4).map((x) =>
            h('div.row', { style: 'padding:9px 0;border-top:1px solid var(--brd)' },
              h('div.grow',
                h('div.small', { style: 'font-weight:600' }, x.username),
                h('div.faint.small', x.lastSeen)),
              h('span.badge.badge--acc', ar(x.progress) + '٪')))))),
    ));

    return page;
  };
})();
