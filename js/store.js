/* =============================================================================
   store.js — حالة اللوحة
   يحفظ في localStorage الآن؛ عند الانتقال إلى Supabase تُستبدل دوال الكتابة
   باستدعاءات `from(...).upsert(...)` والقراءة بـ `select()`، وتبقى الواجهة كما هي.
   ============================================================================= */
window.Store = (function () {

  const KEY = 'manhaji.admin.v1';

  /** الأدوار: المدرّس يحرّر المحتوى فقط ولا يرى الأكواد ولا بيانات الطلاب. */
  const ROLES = {
    admin:   { label: 'أدمن',  can: ['content', 'questions', 'exams', 'videos', 'codes', 'students', 'dashboard'] },
    teacher: { label: 'مدرّس', can: ['content', 'questions', 'exams', 'videos', 'dashboard'] },
  };

  const initial = () => ({
    role: null, user: null,
    books:     structuredClone(SEED.books),
    units:     structuredClone(SEED.units),
    lessons:   structuredClone(SEED.lessons),
    questions: structuredClone(SEED.questions),
    exams:     structuredClone(SEED.exams),
    videos:    structuredClone(SEED.videos),
    batches:   structuredClone(SEED.batches),
    students:  structuredClone(SEED.students),
    theme: 'light',
  });

  let state = load();
  const subs = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...initial(), ...JSON.parse(raw) } : initial();
    } catch { return initial(); }
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

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

  function signIn(user, pass) {
    // مؤقت حتى ربط Supabase Auth. لا تُشحن هذه الشاشة كما هي إلى الإنتاج.
    if (user === 'admin' && pass === 'admin') { set({ role: 'admin', user }); return null; }
    if (user === 'teacher' && pass === 'teacher') { set({ role: 'teacher', user }); return null; }
    return 'اسم المستخدم أو كلمة المرور غير صحيحة.';
  }
  function signOut() { set({ role: null, user: null }); }

  // ---------------------------------------------------------------------------
  // كتابة عامة: upsert وحذف على أي مجموعة
  // ---------------------------------------------------------------------------
  function upsert(coll, row) {
    set((s) => {
      const list = [...s[coll]];
      const i = list.findIndex((x) => x.id === row.id);
      if (i >= 0) list[i] = { ...list[i], ...row };
      else list.push(row);
      return { [coll]: list };
    });
  }

  function remove(coll, id) {
    set((s) => ({ [coll]: s[coll].filter((x) => x.id !== id) }));
  }

  // ---------------------------------------------------------------------------
  // استعلامات مشتقّة
  // ---------------------------------------------------------------------------
  const unitsOf   = (bookId) => state.units.filter((u) => u.book === bookId)
                                  .sort((a, b) => a.order - b.order);
  const lessonsOf = (unitId) => state.lessons.filter((l) => l.unit === unitId)
                                  .sort((a, b) => a.order - b.order);
  const questionsOf = (lessonId) => state.questions.filter((q) => q.lesson === lessonId);
  const lessonById  = (id) => state.lessons.find((l) => l.id === id);
  const topicName   = (id) => (SEED.topics.find((t) => t.id === id) || {}).name || id;

  /** كل درس بمساره الكامل — يُستعمل في القوائم المنسدلة والجداول */
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
      /** دروس بلا فيديو أو بلا أسئلة — أهم قائمة عمل للمدرّس */
      gaps: s.lessons.filter((l) => !l.video || questionsOf(l.id).length === 0),
    };
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  }

  function reset() { localStorage.removeItem(KEY); state = initial(); subs.forEach((f) => f(state)); }

  return {
    get, set, subscribe, ROLES, can, signIn, signOut,
    upsert, remove, unitsOf, lessonsOf, questionsOf, lessonById, topicName,
    lessonPaths, stats, setTheme, reset,
  };
})();
