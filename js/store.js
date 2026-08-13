/* =============================================================================
   store.js — حالة اللوحة، مدعومة بـ Supabase حقيقي

   المحتوى (كتب/وحدات/دروس/أسئلة/مواضيع) يُقرأ ويُكتب فعليًا من نفس قاعدة
   البيانات التي يستخدمها تطبيق الطالب — لا بيانات وهمية بعد اليوم لهذه
   الأقسام. الامتحانات والفيديوهات والأكواد والطلاب ما زالت على SEED الوهمية
   عمدًا: هذه التمريرة تغطّي «الدروس» و«بنك الأسئلة» فقط (الحاجة الفعلية
   الحالية)، والباقي يُوصَل في تمريرة لاحقة منفصلة.

   لماذا القراءة كاملة الجدول لا مرشَّحة من السيرفر: المحتوى صغير (وحدات
   بالعشرات، أسئلة بالمئات) فجلبه كاملًا مرة عند الدخول أبسط بكثير من بناء
   استعلامات مرشَّحة، ويبقي الصفحات (content.js وquestions.js) تقريبًا بلا
   تغيير — تصفّي وتربط في الذاكرة تمامًا كما كانت تفعل مع SEED.
   ============================================================================= */
window.Store = (function () {

  const KEY = 'manhaji.admin.v1';   // يخزّن هلق فقط: theme (لا محتوى بعد اليوم)

  /**
   * الأدوار. `admin` تبقى قيمة قاعدة البيانات وتُعرض «مدير» — إعادة تسميتها
   * إلى manager تمسّ ~٢٠ سياسة RLS ودالتين وتطبيقين بلا مكسب وظيفي.
   *
   * ⚠️ هذه القائمة تُخفي الأزرار فقط، وليست حاجزًا أمنيًا. الحاجز الحقيقي
   * سياسات RLS ودوال is_admin()/owns_course() على السيرفر — أي عنصر هنا
   * لا يقابله فرضٌ هناك يعني صفحةً تُفتح ثم تفشل كل عملياتها بـ403، أو أسوأ.
   */
  const ROLES = {
    admin: {
      label: 'مدير',
      can: ['dashboard', 'subjects', 'content', 'questions', 'exams', 'videos',
            'teachers', 'banners', 'students', 'codes', 'seasons', 'providers',
            'staff', 'audit', 'errors'],
    },
    teacher: {
      label: 'أستاذ',
      // `videos` مسحوبة: `admin-video` تفرض `requireAdmin`، فصفحةٌ تُفتح ثم
      // تفشل كل عملياتها تجربةٌ سيّئة لا حماية. إن أردنا رفع الأساتذة
      // للفيديو فالتغيير في الدالّة أوّلًا ثم هنا — لا هنا وحدها.
      can: ['dashboard', 'content', 'questions', 'exams'],
    },
    // المزوّد لا يرى شيئًا من المحتوى ولا من الطلاب: صفحته الوحيدة لوحته هو.
    // والحصر الحقيقي في SQL (`provider_dashboard` تحصر بـmy_provider_id)، وهذا
    // هنا لإخفاء ما سيرفضه السيرفر لا للحماية به.
    provider: {
      label: 'مزوّد',
      can: ['myCodes'],
    },
  };

  // أنواع الأسئلة: تسمية اللوحة الداخلية ↔ enum قاعدة البيانات الحقيقي
  const TYPE_TO_DB   = { mcq: 'mcq', multi: 'multi_select', blank: 'fill_blank', order: 'reorder', match: 'match', text: 'short_text' };
  const TYPE_FROM_DB = Object.fromEntries(Object.entries(TYPE_TO_DB).map(([a, b]) => [b, a]));

  const initial = () => ({
    role: null, user: null, loading: false,
    route: null,   // آخر صفحة نشطة {name, params} — لاستئنافها بعد تحديث الصفحة

    // --- من Supabase حقيقةً ---
    // subjectId = المادة الفعّالة التي يتبعها كل ما تعرضه الصفحات. كانت مثبّتة
    // على 'fr' بالكود؛ صارت اختيارًا يحفظه المستخدم ويبدّله من رأس اللوحة.
    subjectId: null, defaultGradeId: null,
    subjects: [], grades: [],
    books: [], units: [], lessons: [], questions: [],
    contentCounts: {},   // subjectId → عدد الكورسات+الأسئلة تحتها (قبل التصفية)

    // الطلاب والأكواد والطاقم لم تعد هنا: صفحاتها تقرأ من السيرفر مباشرةً
    // (RPCs و Edge Functions) لأن جداولها ممنوعة على العميل. الامتحانات
    // والفيديوهات ما زالت وهمية وصفحاتهما مخفيّتان من القائمة.
    exams:    structuredClone(SEED.exams),
    videos:   structuredClone(SEED.videos),

    theme: 'light',
    railCollapsed: false,   // طيّ الشريط الجانبي لأيقونات فقط — تفضيل جهاز محلي (آيباد مثلًا)
  });

  let state = load();
  const subs = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return { ...initial(), theme: saved.theme || 'light', route: saved.route || null,
               railCollapsed: !!saved.railCollapsed,
               subjectId: saved.subjectId || null };
    } catch { return initial(); }
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        theme: state.theme, route: state.route, railCollapsed: state.railCollapsed,
        subjectId: state.subjectId,
      }));
    } catch {}
  }

  function set(patch) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    persist();
    subs.forEach((f) => f(state));
  }

  const get = () => state;
  const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

  const can = (section) => {
    const r = ROLES[state.role];
    return !!r && r.can.includes(section);
  };

  // ---------------------------------------------------------------------------
  // تحويل الشكل: صفوف Supabase (snake_case، جداول منفصلة) ↔ شكل اللوحة الداخلي
  // (camelCase مسطّح) الذي تتوقّعه content.js وquestions.js كما كُتبتا أصلًا
  // على SEED الوهمية.
  // ---------------------------------------------------------------------------
  function fromDbSubject(s) {
    return { id: s.id, code: s.code, name: s.name_ar, native: s.name_native || '',
             color: s.color_hex || '', order: s.sort_order, icon: s.icon || null,
             icon_pos: s.icon_pos || null, description: s.description || '' };
  }
  function fromDbCourse(c) {
    return { id: c.id, subject: c.subject_id, grade: c.grade_id, code: c.code,
             title: c.title_ar, published: c.is_published };
  }
  function fromDbUnit(u) {
    return { id: u.id, book: u.course_id, code: u.code, order: u.sort_order, title: u.title_ar };
  }
  function fromDbLesson(l) {
    // `video` كان مثبَّتًا على null فكان **كل** درس يظهر «بلا فيديو» مهما
    // كان مربوطًا فعلًا. الاستعلام يجلب `video_id` أصلًا (select: '*')،
    // فالخلل كان في الربط لا في القراءة.
    return { id: l.id, unit: l.unit_id, code: l.code, order: l.sort_order,
             title: l.title_ar, minutes: l.est_minutes, page: null,
             video: l.video_id || null, free: l.is_free, published: l.is_published,
             /* وضع العرض يُنقل إلى الحالة المحلّية ليُعرف **تزامنيًّا**.
                بدونه كان محرّر الدرس يرسم «نص» أوّلًا ثم يصحّحها بعد جولتَي
                شبكة (REST ثم دالّة Edge قد تكون باردة). فيحفظ المحرِّر، ينظر،
                يرى «نص»، ويستنتج أن اختياره لم يُحفظ — وهو محفوظ في القاعدة. */
             mode: l.body_mode || 'text',
             body: l.body_html || '' };
  }
  /** الأقسام الأربعة التي يتصفّح الطالب تمارينه عبرها — راجع هجرة 20260802000400. */
  const SECTIONS = [
    ['vocabulaire', 'مفردات'], ['grammaire', 'قاعدة'],
    ['dialogue', 'ترتيب حوار'], ['unite', 'مواضيع الوحدة'],
  ];

  /**
   * تفريع كل قسم بحسب الوحدة (راجع هجرة 20260803000100). القيمة المخزَّنة
   * دائمًا u1..u6 (أو annexe للملحق الأدبي)، لكن **التسمية المعروضة** تختلف
   * باختلاف القسم: نفس u1 تعني «نحتفل معًا» في مفردات/ترتيب حوار/مواضيع
   * الوحدة، وتعني «التعبير عن الهدف» في قاعدة — لأن كل وحدة تُدرّس قاعدة
   * نحوية واحدة بعينها، فربط الاثنين بنفس الرمز أوفر من جدولين منفصلين.
   */
  // نفس القيَم بالضبط الموجودة في تطبيق الطالب (js/screens/course.js) —
  // نسختان مستقلّتان عمدًا (تطبيقان منفصلان بلا كود مشترك)، لكن يجب أن
  // يتطابق نصّهما حرفيًا. هنا نص خام بلا عزل اتجاهي لأن قوائم <option> لا
  // تقبل عناصر HTML متداخلة أصلًا — العزل يهمّ بواجهة الطالب لا هنا.
  const UNIT_THEME = {
    u1: 'الوحدة الأولى: نحتفل معًا — on fête ensemble',
    u2: 'الوحدة الثانية: كلّ شخص من أجل الجميع — chacun pour tous',
    u3: 'الوحدة الثالثة: الصالون مكان ثقافي — le salon un espace culturel',
    u4: 'الوحدة الرابعة: المرأة في الأدب — la femme dans la littérature',
    u5: "الوحدة الخامسة: الذكاء الاصطناعي — l'intelligence artificielle",
    u6: "الوحدة السادسة: غزو الفضاء — la conquête de l'espace",
  };
  const UNIT_GRAMMAR = {
    u1: "الوحدة الأولى: التعبير عن الهدف — l'expression de but",
    u2: "الوحدة الثانية: التعارض والتضاد — les conjonctions d'opposition/concession",
    u3: 'الوحدة الثالثة: الكلام المباشر وغير المباشر — le discours direct et indirect',
    u4: 'الوحدة الرابعة: المقارنة والتفضيل — le superlatif',
    u5: "الوحدة الخامسة: الصفات والضمائر المبهمة — les adjectifs et les pronoms indéfinis",
    u6: 'الوحدة السادسة: ضمائر الملكية وضمائر الإشارة — les pronoms possessifs et les pronoms démonstratifs',
  };
  /** قائمة [قيمة،تسمية] لقائمة منسدلة، بحسب القسم الحالي. annexe لا يظهر إلا
   *  تحت «مواضيع الوحدة» — لا معنى لملحق أدبي داخل تمارين المفردات مثلًا. */
  function unitOptionsFor(section) {
    const table = section === 'grammaire' ? UNIT_GRAMMAR : UNIT_THEME;
    const opts = Object.entries(table);
    if (section === 'unite') opts.push(['annexe', 'الملحق الأدبي']);
    return opts;
  }
  function unitLabel(section, code) {
    if (code === 'annexe') return 'الملحق الأدبي';
    return (section === 'grammaire' ? UNIT_GRAMMAR : UNIT_THEME)[code] || code;
  }

  function fromDbQuestion(q, options) {
    const row = { id: q.id, subject: q.subject_id, grade: q.grade_id, code: q.code,
                  lesson: q.lesson_id, section: q.section || null,
                  unitCode: q.unit_code || null,
                  type: TYPE_FROM_DB[q.type] || q.type,
                  difficulty: q.difficulty, source: null,
                  stem: q.stem_md, why: q.explanation_md || '', published: q.is_published };
    if (row.type === 'mcq' || row.type === 'multi') {
      row.options = options.map((o) => ({ k: o.code, t: o.text_md, correct: o.is_correct }));
    } else if (row.type === 'order') {
      row.answer = q.answer_key?.order || [];
    } else if (row.type === 'blank') {
      row.blanks = (q.answer_key?.blanks || []).map((accept) => ({ accept, choices: accept }));
    }
    return row;
  }

  const shortId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /**
   * UUID v4 حقيقي — أعمدة id بقاعدة البيانات من نوع uuid صارم، فمعرّف نصّي
   * مثل 'q' + Date.now() يرفضه Postgres فورًا. لا نعتمد على crypto.randomUUID()
   * لأنها تتطلّب سياقًا آمنًا قد لا يتوفر عند فتح الملف بـ file:// مباشرة —
   * getRandomValues متاحة في كل مكان.
   */
  function newId() {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  /**
   * صفّي أنا في profiles — مرشَّحًا بمعرّفي لا `rows[0]`.
   *
   * ⚠️ الفرق ليس تحسينًا: سياسة admin_read_all_profiles تجعل المدير يرى كل
   * الملفات، فأخذُ أول صفّ يعطيه هوية شخص آخر **ودورَه**. حدث ذلك فعليًا —
   * أول مدير دخل ظهرت له هوية أستاذ وصلاحياته لأن صفّ الأستاذ كان الأول.
   * ولو صادف أن الأول لطالب لانقفلت اللوحة في وجه المدير بلا سبب مفهوم.
   *
   * الأستاذ لم يكشف الخلل لأنه يرى صفّه وحده (read_own_profile).
   */
  async function myProfile() {
    const uid = Api.userId();
    if (!uid) throw new Error('تعذّر تحديد هوية الجلسة.');
    const rows = await Api.from('profiles',
      { select: 'id,full_name,role', eq: { id: uid } });
    return rows[0];
  }

  // ---------------------------------------------------------------------------
  // تسجيل الدخول: Supabase Auth حقيقي، ثم التحقّق من الدور، ثم تحميل المحتوى
  // ---------------------------------------------------------------------------
  async function signIn(email, password) {
    try {
      await Api.signInWithPassword(email, password);
    } catch (e) {
      return e.message || 'تعذّر تسجيل الدخول.';
    }

    let profile;
    try {
      profile = await myProfile();
    } catch (e) {
      Api.signOut();
      return 'تعذّر التحقّق من صلاحياتك: ' + (e.message || '');
    }

    if (!profile || !ROLES[profile.role]) {
      Api.signOut();
      return 'هذا الحساب ليس حساب مدرّس أو أدمن.';
    }

    set({ role: profile.role, user: profile.full_name || email });

    // أثرٌ لكل وصول إداري. كلمة مرور مسرَّبة تعطي وصولًا صامتًا مستمرًّا —
    // الطالب على الأقل يلاحظ أنه طُرد بسبب الجلسة الواحدة. فشلُ التسجيل لا
    // يمنع الدخول: سجلٌّ ناقص أهون من قفل المدير خارج لوحته.
    Api.rpc('log_staff_login').catch(() => {});

    try {
      await loadAll();
    } catch (e) {
      return 'دخلت بنجاح، لكن تعذّر تحميل المحتوى: ' + (e.message || '');
    }
    return null;
  }

  /**
   * استئناف الجلسة بعد تحديث الصفحة.
   *
   * توكن Supabase يبقى صالحًا في localStorage (api.js) عبر أي تحديث، لكن
   * حالة اللوحة هنا (الدور والمحتوى) لا تُحفَظ عمدًا — كانت تُعاد للصفر عند
   * كل تحديث فيظهر أنّ الجلسة "طُردت" رغم أن التوكن نفسه سليم. تُعاد بناؤها
   * هنا تمامًا كما بعد signIn، لكن بلا خطوة كلمة المرور.
   */
  async function resume() {
    if (!Api.isSignedIn()) return false;

    let profile;
    try {
      profile = await myProfile();
    } catch {
      return false;       // شبكة منقطعة — لا نطرد المستخدم، فقط نبقيه بلا دخول هذه المرة
    }

    if (!profile || !ROLES[profile.role]) {
      Api.signOut();
      return false;
    }

    set({ role: profile.role, user: profile.full_name || '' });
    try { await loadAll(); } catch { /* الدخول نجح؛ المحتوى يُعاد جلبه لاحقًا */ }
    return true;
  }

  function signOut() {
    Api.signOut();
    set({ ...initial(), theme: state.theme, railCollapsed: state.railCollapsed });
  }

  /** يُستدعى أيضًا بعد كل كتابة ناجحة — أبسط من تحديث الحالة المحلية يدويًا
   *  عنصرًا عنصرًا، ومضمون التطابق مع ما قبِلَه السيرفر فعلًا. */
  async function loadAll() {
    set({ loading: true });
    const [subjects, grades, courses, units, lessons, questions, options] =
      await Promise.all([
        Api.from('subjects', { select: '*', order: 'sort_order' }),
        Api.from('grades',   { select: 'id,code,name_ar', order: 'sort_order' }),
        Api.from('courses',  { select: '*' }),
        Api.from('units',    { select: '*', order: 'sort_order' }),
        Api.from('lessons',  { select: '*', order: 'sort_order' }),
        Api.from('questions', { select: '*' }),
        Api.from('question_options', { select: '*', order: 'sort_order' }),
      ]);

    // المادة الفعّالة: المحفوظة إن كانت ما زالت موجودة، وإلّا الأولى. الشرط
    // الثاني ضروري — مادة حُذفت أو تغيّر معرّفها كانت تترك اللوحة فارغة بصمت.
    const subjectId = subjects.some((s) => s.id === state.subjectId)
      ? state.subjectId
      : (subjects[0]?.id || null);

    const grade12 = grades.find((g) => g.code === 'g12');

    const optionsOfQ = new Map();
    options.forEach((o) => {
      if (!optionsOfQ.has(o.question_id)) optionsOfQ.set(o.question_id, []);
      optionsOfQ.get(o.question_id).push(o);
    });

    // كل ما تعرضه الصفحات محصور بالمادة الفعّالة. الوحدات والدروس تتبع
    // كورسات تلك المادة، فلا تتسرّب وحدةُ مادةٍ أخرى إلى شجرة الدروس.
    const contentCounts = {};
    const bump = (sid) => { if (sid) contentCounts[sid] = (contentCounts[sid] || 0) + 1; };
    courses.forEach((c) => bump(c.subject_id));
    questions.forEach((q) => bump(q.subject_id));

    const books = courses.filter((c) => c.subject_id === subjectId).map(fromDbCourse);
    const bookIds = new Set(books.map((b) => b.id));
    const scopedUnits = units.filter((u) => bookIds.has(u.course_id)).map(fromDbUnit);
    const unitIds = new Set(scopedUnits.map((u) => u.id));

    set({
      loading: false,
      subjectId,
      defaultGradeId: grade12?.id || grades[0]?.id || null,
      subjects: subjects.map(fromDbSubject),
      contentCounts,
      grades: grades.map((g) => ({ id: g.id, name: g.name_ar })),
      books,
      units:   scopedUnits,
      lessons: lessons.filter((l) => unitIds.has(l.unit_id)).map(fromDbLesson),
      questions: questions.filter((q) => q.subject_id === subjectId)
        .map((q) => fromDbQuestion(q, optionsOfQ.get(q.id) || [])),
    });
  }

  /** تبديل المادة الفعّالة — يُعاد تحميل كل شيء لأن كل القوائم محصورة بها. */
  async function setActiveSubject(id) {
    if (id === state.subjectId) return;
    set({ subjectId: id });
    await loadAll();
  }

  // ---------------------------------------------------------------------------
  // كتابة — مرسَلة حسب المجموعة إلى الجدول الحقيقي المطابق
  // ---------------------------------------------------------------------------
  async function upsert(coll, row) {
    if (coll === 'subjects')  return upsertSubject(row);
    if (coll === 'books')     return upsertBook(row);
    if (coll === 'units')     return upsertUnit(row);
    if (coll === 'lessons')   return upsertLesson(row);
    if (coll === 'questions') return upsertQuestion(row);
    // مجموعات غير موصولة بعد (exams/videos/batches/students): محليًا فقط
    set((s) => {
      const list = [...s[coll]];
      const i = list.findIndex((x) => x.id === row.id);
      if (i >= 0) list[i] = { ...list[i], ...row }; else list.push(row);
      return { [coll]: list };
    });
  }

  async function upsertSubject(row) {
    const dbRow = {
      id: row.id,
      code: (row.code || '').trim().toLowerCase(),
      name_ar: row.name,
      name_native: row.native || null,
      color_hex: row.color || null,
      sort_order: Number(row.order) || 0,
      icon: row.icon || null,
      icon_pos: row.iconPos || null,
      description: row.description || null,
    };
    await Api.upsert('subjects', dbRow);
    await loadAll();     // المادة قد تكون الأولى فتصير الفعّالة تلقائيًا
  }

  async function upsertBook(row) {
    const isNew = !state.books.some((b) => b.id === row.id);
    const dbRow = {
      id: row.id, subject_id: state.subjectId, grade_id: row.grade,
      code: row.code || `fr-${shortId()}`, title_ar: row.title, is_published: !!row.published,
    };
    await Api.upsert('courses', dbRow);
    set((s) => {
      const mapped = fromDbCourse(dbRow);
      const list = isNew ? [...s.books, mapped] : s.books.map((b) => (b.id === row.id ? mapped : b));
      return { books: list };
    });
  }

  async function upsertUnit(row) {
    const isNew = !state.units.some((u) => u.id === row.id);
    const dbRow = {
      id: row.id, course_id: row.book, code: row.code || `u-${shortId()}`,
      title_ar: row.title, sort_order: row.order,
    };
    await Api.upsert('units', dbRow);
    set((s) => {
      const mapped = fromDbUnit(dbRow);
      const list = isNew ? [...s.units, mapped] : s.units.map((u) => (u.id === row.id ? mapped : u));
      return { units: list };
    });
  }

  async function upsertLesson(row) {
    const isNew = !state.lessons.some((l) => l.id === row.id);
    // body: محرّر النص الغني بالإدخال المباشر (contenteditable) يُنتج HTML
    // مباشرة، لا Markdown. body_html هو ما يعرضه التطبيق فعلًا، فيُكتب دائمًا.
    // body_md يُكتب بنفس القيمة أيضًا حفاظًا على تطابق العمودين لدرسٍ حرَّرته
    // اللوحة — دروس مستوردة من ملفات .md الأصلية تبقى Markdown حقيقية طالما
    // لم يفتحها أحد بهذا المحرّر ويحفظها.
    const dbRow = {
      id: row.id, unit_id: row.unit, code: row.code || `l-${shortId()}`,
      title_ar: row.title, body_html: row.body || '', body_md: row.body || '',
      est_minutes: row.minutes || 10, is_free: !!row.free,
      is_published: row.published !== false, sort_order: row.order,
    };
    await Api.upsert('lessons', dbRow);

    set((s) => {
      /* `dbRow` لا يحمل `body_mode` (ولا يجب أن يحمله — الحفظ لا يغيّر وضع
         العرض). لكن `fromDbLesson` تشتقّ الحالة المحلّية منه وحده، فكانت
         تُرجع `mode: 'text'` بعد كل حفظ وتدهس اختيار المحرِّر في الذاكرة —
         فيرى «نص» فورًا ويظنّ أن اختياره ضاع، وهو سليمٌ في القاعدة. */
      const prev = s.lessons.find((l) => l.id === row.id);
      const mapped = { ...fromDbLesson(dbRow), mode: prev?.mode || 'text' };
      const list = isNew ? [...s.lessons, mapped] : s.lessons.map((l) => (l.id === row.id ? mapped : l));
      return { lessons: list };
    });
  }

  async function upsertQuestion(row) {
    const isNew = !state.questions.some((q) => q.id === row.id);
    const existing = state.questions.find((q) => q.id === row.id);

    const dbRow = {
      id: row.id,
      subject_id: existing?.subject || row.subject || state.subjectId,
      grade_id:   existing?.grade   || row.grade   || state.defaultGradeId,
      code: existing?.code || row.code || `admin-${shortId()}`,
      lesson_id: row.lesson || null,
      section: row.section || null,
      unit_code: row.unitCode || null,
      type: TYPE_TO_DB[row.type] || row.type,
      stem_md: row.stem,
      difficulty: row.difficulty || 3,
      explanation_md: row.why || null,
      is_published: row.published !== false,
      answer_key: row.type === 'order' ? { order: row.answer || [] }
                : row.type === 'blank' ? { blanks: (row.blanks || []).map((b) => b.accept) }
                : null,
    };
    await Api.upsert('questions', dbRow);

    if (row.type === 'mcq' || row.type === 'multi') {
      await Api.replaceJoin('question_options', 'question_id', row.id,
        (row.options || []).map((o, i) => ({
          question_id: row.id, code: o.k, text_md: o.t, is_correct: !!o.correct, sort_order: i,
        })));
    }

    set((s) => {
      const mapped = fromDbQuestion(dbRow, row.options
        ? row.options.map((o, i) => ({ code: o.k, text_md: o.t, is_correct: !!o.correct, sort_order: i }))
        : []);
      const list = isNew ? [...s.questions, mapped] : s.questions.map((q) => (q.id === row.id ? mapped : q));
      return { questions: list };
    });
  }

  const TABLE_OF = { subjects: 'subjects', books: 'courses', units: 'units',
                     lessons: 'lessons', questions: 'questions' };

  async function remove(coll, id) {
    const table = TABLE_OF[coll];
    if (!table) {   // مجموعات غير موصولة بعد: محليًا فقط
      set((s) => ({ [coll]: s[coll].filter((x) => x.id !== id) }));
      return;
    }
    await Api.remove(table, id);
    // حذف المادة يجرف كورساتها ووحداتها ودروسها بـcascade — نعيد التحميل
    // كاملًا بدل ترقيع الحالة المحلية، وقد تكون هي المادة الفعّالة أصلًا.
    if (coll === 'subjects') { set({ subjectId: null }); return loadAll(); }
    set((s) => {
      const patch = { [coll]: s[coll].filter((x) => x.id !== id) };
      // حذف درس يُصفّر lesson_id لأسئلته في القاعدة تلقائيًا (on delete set null)؛
      // نطابق ذلك محليًا كي لا يبقى سؤال يشير إلى درس لم يعد موجودًا.
      if (coll === 'lessons') {
        patch.questions = s.questions.map((q) => (q.lesson === id ? { ...q, lesson: null } : q));
      }
      return patch;
    });
  }

  // ---------------------------------------------------------------------------
  // استعلامات مشتقّة — بلا تغيير عن السابق
  // ---------------------------------------------------------------------------
  const unitsOf   = (bookId) => state.units.filter((u) => u.book === bookId)
                                  .sort((a, b) => a.order - b.order);
  const lessonsOf = (unitId) => state.lessons.filter((l) => l.unit === unitId)
                                  .sort((a, b) => a.order - b.order);
  const questionsOf = (lessonId) => state.questions.filter((q) => q.lesson === lessonId);
  const lessonById  = (id) => state.lessons.find((l) => l.id === id);

  function lessonPaths() {
    const out = [];
    state.books.forEach((b) => unitsOf(b.id).forEach((u) => lessonsOf(u.id).forEach((l) => {
      out.push({ ...l, bookTitle: b.title, unitTitle: u.title });
    })));
    return out;
  }

  /**
   * إحصاءات المحتوى المحمَّل محليًا (المادة الفعّالة).
   *
   * أرقام الطلاب والأكواد والاشتراكات لم تعد هنا: مصدرها admin_stats() على
   * السيرفر، لأن جداولها ممنوعة على العميل أصلًا. خلطُ المصدرين كان يعطي
   * أرقامًا وهمية تبدو حقيقية — أسوأ من غياب الرقم.
   */
  function stats() {
    const s = state;
    const published = (a) => a.filter((x) => x.published !== false).length;
    return {
      lessons: s.lessons.length, lessonsPub: published(s.lessons),
      questions: s.questions.length, questionsPub: published(s.questions),
      exams: s.exams.length, examsPub: published(s.exams),
      gaps: s.lessons.filter((l) => questionsOf(l.id).length === 0),
    };
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  }

  function reset() { signOut(); }

  /**
   * هل تحت المادة أي محتوى؟ يمنع حذفًا يجرف كورسات ودروسًا بـcascade.
   *
   * لا يقرأ books/questions لأنهما مصفَّيان بالمادة الفعّالة — فحصُ مادةٍ
   * أخرى بهما يعيد "فارغة" دائمًا ويسمح بحذفها وهي مليئة. contentCounts
   * تُبنى في loadAll من الصفوف كاملةً قبل التصفية.
   */
  const subjectHasContent = (id) => (state.contentCounts[id] || 0) > 0;

  return {
    get, set, subscribe, ROLES, can, signIn, signOut, resume, newId, SECTIONS,
    unitOptionsFor, unitLabel, setActiveSubject, subjectHasContent, loadAll,
    upsert, remove, unitsOf, lessonsOf, questionsOf, lessonById,
    lessonPaths, stats, setTheme, reset,
  };
})();
