// اختبار دخان لمنطق اللوحة — بلا متصفح:  node test/smoke.js
const fs = require('fs');
const dir = require('node:path').join(__dirname, '..', 'js') + '/';

global.window = global;
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = v; },
  removeItem(k) { delete this._d[k]; },
};
global.document = { documentElement: { setAttribute() {} } };

eval(fs.readFileSync(dir + 'data/seed.js', 'utf8'));
eval(fs.readFileSync(dir + 'store.js', 'utf8'));

const fail = [];
const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fail.push(n); };

// --- الدخول والأدوار ---------------------------------------------------------
ok('يرفض بيانات خاطئة', !!Store.signIn('x', 'y'));
ok('يقبل الأدمن', Store.signIn('admin', 'admin') === null);
ok('الأدمن يرى الأكواد', Store.can('codes'));
ok('الأدمن يرى الطلاب', Store.can('students'));

Store.signOut();
ok('الخروج يمسح الدور', Store.get().role === null);
ok('بلا دور لا صلاحية', !Store.can('content'));

Store.signIn('teacher', 'teacher');
ok('المدرّس يحرّر المحتوى', Store.can('content') && Store.can('questions'));
ok('المدرّس لا يرى الأكواد', !Store.can('codes'));
ok('المدرّس لا يرى الطلاب', !Store.can('students'));

// --- الشجرة -------------------------------------------------------------------
ok('كتابان', Store.get().books.length === 2);
ok('وحدتان في كتاب الطالب', Store.unitsOf('student').length === 2);
ok('الوحدات مرتّبة', Store.unitsOf('student')[0].order === 1);
ok('دروس الوحدة الأولى', Store.lessonsOf('u1').length === 2);
ok('مسارات الدروس كاملة', Store.lessonPaths().length === Store.get().lessons.length);

// --- الكتابة ------------------------------------------------------------------
Store.upsert('lessons', { id: 'new-1', unit: 'u1', order: 3, title: 'درس تجريبي',
                          topics: ['articles'], published: false });
ok('إضافة درس', !!Store.lessonById('new-1'));
Store.upsert('lessons', { id: 'new-1', title: 'عنوان معدّل' });
ok('التعديل لا يمسح الحقول الأخرى',
   Store.lessonById('new-1').title === 'عنوان معدّل' && Store.lessonById('new-1').unit === 'u1');
Store.remove('lessons', 'new-1');
ok('الحذف', !Store.lessonById('new-1'));

// --- الإحصائيات ----------------------------------------------------------------
const st = Store.stats();
ok('عدّ الدروس', st.lessons === Store.get().lessons.length);
ok('يميّز المنشور عن المسوّدة', st.lessonsPub < st.lessons);
ok('يكشف الدروس الناقصة', st.gaps.length > 0);
ok('الناقص = بلا فيديو أو بلا أسئلة',
   st.gaps.every((l) => !l.video || Store.questionsOf(l.id).length === 0));

// --- سلامة الروابط --------------------------------------------------------------
const s = Store.get();
const bad = [];
s.lessons.forEach((l) => {
  if (!s.units.some((u) => u.id === l.unit)) bad.push(`درس ${l.id}: وحدة مجهولة`);
  (l.topics || []).forEach((t) => {
    if (!SEED.topics.some((x) => x.id === t)) bad.push(`درس ${l.id}: موضوع مجهول ${t}`);
  });
  if (l.video && !s.videos.some((v) => v.id === l.video)) bad.push(`درس ${l.id}: فيديو مفقود`);
});
s.questions.forEach((q) => {
  if (q.lesson && !s.lessons.some((l) => l.id === q.lesson)) bad.push(`سؤال ${q.id}: درس مفقود`);
  if (!SEED.topics.some((t) => t.id === q.topic)) bad.push(`سؤال ${q.id}: موضوع مجهول`);
  if ((q.type === 'mcq' || q.type === 'multi') && !q.options.some((o) => o.correct))
    bad.push(`سؤال ${q.id}: بلا إجابة صحيحة`);
});
s.exams.forEach((e) => e.questions.forEach((qid) => {
  if (!s.questions.some((q) => q.id === qid)) bad.push(`امتحان ${e.id}: سؤال مفقود ${qid}`);
}));
ok('سلامة روابط البيانات', bad.length === 0);
bad.forEach((b) => console.log('   ← ' + b));

// --- سلامة الترميز: يكشف تلف UTF-8 مبكرًا ----------------------------------------
const SRC = ['ui.js', 'store.js', 'components.js', 'app.js', 'data/seed.js',
             'pages/dashboard.js', 'pages/content.js', 'pages/questions.js',
             'pages/exams.js', 'pages/codes.js', 'pages/students.js', 'pages/videos.js'];
const corrupt = SRC.filter((f) => /Ø|Ã˜/.test(fs.readFileSync(dir + f, 'utf8')));
ok('لا تلف في ترميز الملفات', corrupt.length === 0);
corrupt.forEach((f) => console.log('   ← ترميز تالف: ' + f));

console.log('\n' + (fail.length ? `${fail.length} فشل` : 'كل الاختبارات نجحت'));
process.exit(fail.length ? 1 : 0);
