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

  const ROLES = {
    admin:   { label: 'أدمن',  can: ['content', 'questions', 'exams', 'videos', 'codes', 'students', 'dashboard'] },
    teacher: { label: 'مدرّس', can: ['content', 'questions', 'exams', 'videos', 'dashboard'] },
  };

  // أنواع الأسئلة: تسمية اللوحة الداخلية ↔ enum قاعدة البيانات الحقيقي
  const TYPE_TO_DB   = { mcq: 'mcq', multi: 'multi_select', blank: 'fill_blank', order: 'reorder', match: 'match', text: 'short_text' };
  const TYPE_FROM_DB = Object.fromEntries(Object.entries(TYPE_TO_DB).map(([a, b]) => [b, a]));

  const initial = () => ({
    role: null, user: null, loading: false,

    // --- من Supabase حقيقةً ---
    subjectId: null, defaultGradeId: null,
    grades: [], topics: [],
    books: [], units: [], lessons: [], questions: [],

    // --- ما زالت وهمية عمدًا (غير موصولة بهذه التمريرة) ---
    exams:    structuredClone(SEED.exams),
    videos:   structuredClone(SEED.videos),
    batches:  structuredClone(SEED.batches),
    students: structuredClone(SEED.students),

    theme: 'light',
  });

  let state = load();
  const subs = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return { ...initial(), theme: saved.theme || 'light' };
    } catch { return initial(); }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ theme: state.theme })); } catch {}
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
  function fromDbCourse(c) {
    return { id: c.id, subject: c.subject_id, grade: c.grade_id, code: c.code,
             title: c.title_ar, published: c.is_published };
  }
  function fromDbUnit(u) {
    return { id: u.id, book: u.course_id, code: u.code, order: u.sort_order, title: u.title_ar };
  }
  function fromDbLesson(l, topicIds) {
    return { id: l.id, unit: l.unit_id, code: l.code, order: l.sort_order,
             title: l.title_ar, minutes: l.est_minutes, page: null,
             video: null, free: l.is_free, published: l.is_published,
             topics: topicIds || [], body: l.body_html || '' };
  }
  /** الأقسام الأربعة التي يتصفّح الطالب تمارينه عبرها — راجع هجرة
   *  20260802000400. مستقلّة عن topic (الذي يبقى لتتبّع الإتقان الدقيق). */
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
                  lesson: q.lesson_id, topic: q.topic_id, section: q.section || null,
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
      const rows = await Api.from('profiles', { select: 'id,full_name,role' });
      profile = rows[0];
    } catch (e) {
      Api.signOut();
      return 'تعذّر التحقّق من صلاحياتك: ' + (e.message || '');
    }

    if (!profile || !ROLES[profile.role]) {
      Api.signOut();
      return 'هذا الحساب ليس حساب مدرّس أو أدمن.';
    }

    set({ role: profile.role, user: profile.full_name || email });

    try {
      await loadAll();
    } catch (e) {
      return 'دخلت بنجاح، لكن تعذّر تحميل المحتوى: ' + (e.message || '');
    }
    return null;
  }

  function signOut() {
    Api.signOut();
    set({ ...initial(), theme: state.theme });
  }

  /** يُستدعى أيضًا بعد كل كتابة ناجحة — أبسط من تحديث الحالة المحلية يدويًا
   *  عنصرًا عنصرًا، ومضمون التطابق مع ما قبِلَه السيرفر فعلًا. */
  async function loadAll() {
    set({ loading: true });
    const [subjects, grades, topics, courses, units, lessons, lessonTopics, questions, options] =
      await Promise.all([
        Api.from('subjects', { select: 'id,code' }),
        Api.from('grades',   { select: 'id,code,name_ar', order: 'sort_order' }),
        Api.from('topics',   { select: 'id,parent_id,name_ar', order: 'sort_order' }),
        Api.from('courses',  { select: '*' }),
        Api.from('units',    { select: '*', order: 'sort_order' }),
        Api.from('lessons',  { select: '*', order: 'sort_order' }),
        Api.from('lesson_topics', { select: 'lesson_id,topic_id' }),
        Api.from('questions', { select: '*' }),
        Api.from('question_options', { select: '*', order: 'sort_order' }),
      ]);

    const subject = subjects.find((s) => s.code === 'fr');
    const grade12 = grades.find((g) => g.code === 'g12');

    const topicsByParent = new Map();
    topics.forEach((t) => { if (t.parent_id) topicsByParent.set(t.id, t.parent_id); });
    const topicLabel = (t) => {
      const parent = topics.find((p) => p.id === t.parent_id);
      return parent ? `${parent.name_ar} ← ${t.name_ar}` : t.name_ar;
    };

    const topicsOfLesson = new Map();
    lessonTopics.forEach(({ lesson_id, topic_id }) => {
      if (!topicsOfLesson.has(lesson_id)) topicsOfLesson.set(lesson_id, []);
      topicsOfLesson.get(lesson_id).push(topic_id);
    });

    const optionsOfQ = new Map();
    options.forEach((o) => {
      if (!optionsOfQ.has(o.question_id)) optionsOfQ.set(o.question_id, []);
      optionsOfQ.get(o.question_id).push(o);
    });

    set({
      loading: false,
      subjectId: subject?.id || null,
      defaultGradeId: grade12?.id || grades[0]?.id || null,
      grades: grades.map((g) => ({ id: g.id, name: g.name_ar })),
      topics: topics.map((t) => ({ id: t.id, name: topicLabel(t) })),
      books:     courses.map(fromDbCourse),
      units:     units.map(fromDbUnit),
      lessons:   lessons.map((l) => fromDbLesson(l, topicsOfLesson.get(l.id))),
      questions: questions.map((q) => fromDbQuestion(q, optionsOfQ.get(q.id) || [])),
    });
  }

  // ---------------------------------------------------------------------------
  // كتابة — مرسَلة حسب المجموعة إلى الجدول الحقيقي المطابق
  // ---------------------------------------------------------------------------
  async function upsert(coll, row) {
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
      // lesson_topics غير مُستهلَكة حاليًا في تطبيق الطالب — لا نكتب عليها من
      // هنا، ونحافظ على أي روابط قديمة كما هي (موروثة من الاستيراد الأصلي).
      const mapped = fromDbLesson(dbRow, s.lessons.find((x) => x.id === row.id)?.topics || []);
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
      topic_id: row.topic || null,
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

  const TABLE_OF = { books: 'courses', units: 'units', lessons: 'lessons', questions: 'questions' };

  async function remove(coll, id) {
    const table = TABLE_OF[coll];
    if (!table) {   // مجموعات غير موصولة بعد: محليًا فقط
      set((s) => ({ [coll]: s[coll].filter((x) => x.id !== id) }));
      return;
    }
    await Api.remove(table, id);
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
  const topicName   = (id) => (state.topics.find((t) => t.id === id) || {}).name || id;

  function lessonPaths() {
    const out = [];
    state.books.forEach((b) => unitsOf(b.id).forEach((u) => lessonsOf(u.id).forEach((l) => {
      out.push({ ...l, bookTitle: b.title, unitTitle: u.title });
    })));
    return out;
  }

  function stats() {
    const s = state;
    const published = (a) => a.filter((x) => x.published !== false).length;
    const activeStudents = s.students.filter((x) => x.lastSeen !== 'قبل ٦ أيام').length;
    return {
      lessons: s.lessons.length, lessonsPub: published(s.lessons),
      questions: s.questions.length, questionsPub: published(s.questions),
      exams: s.exams.length, examsPub: published(s.exams),
      videos: s.videos.length,
      videoMb: Math.round(s.videos.reduce((a, v) => a + v.mb, 0) * 10) / 10,
      students: s.students.length, activeStudents,
      codes: s.batches.reduce((a, b) => a + b.qty, 0),
      codesUsed: s.batches.reduce((a, b) => a + b.used, 0),
      gaps: s.lessons.filter((l) => !l.video || questionsOf(l.id).length === 0),
    };
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  }

  function reset() { signOut(); }

  return {
    get, set, subscribe, ROLES, can, signIn, signOut, newId, SECTIONS,
    unitOptionsFor, unitLabel,
    upsert, remove, unitsOf, lessonsOf, questionsOf, lessonById, topicName,
    lessonPaths, stats, setTheme, reset,
  };
})();
