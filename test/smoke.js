// اختبار دخان لمنطق اللوحة — بلا متصفح ولا شبكة حقيقية:  node test/smoke.js
//
// بعد ربط اللوحة بـ Supabase حقيقي، صار المحتوى (كتب/وحدات/دروس/أسئلة) يبدأ
// فارغًا حتى يُسجَّل الدخول فعليًا ويُستدعى loadAll() عبر الشبكة — فلا معنى
// لاختبار "كتابان" أو "دروس الوحدة الأولى" كما في السابق (كانت SEED وهمية
// محلية). بدلها: نختبر ما بقي منطقًا خالصًا بلا شبكة (الأدوار والصلاحيات،
// توليد المعرّفات) + طبقة الشبكة نفسها (Api) عبر fetch مزيَّف — هذا الجزء
// الجديد كليًا في هذه الجولة وأكثر ما يستحق تغطية.
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
global.crypto = require('node:crypto').webcrypto;

// --- fetch مزيَّف: يسجّل آخر طلب ويعيد استجابة نحدّدها مسبقًا ------------------
let lastCall = null;
let nextResponse = { status: 200, body: [] };
global.fetch = async (url, opts = {}) => {
  lastCall = { url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body };
  const { status, body } = nextResponse;
  const raw = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => raw,
    json: async () => (raw ? JSON.parse(raw) : {}),
  };
};

eval(fs.readFileSync(dir + 'data/api.js', 'utf8'));
eval(fs.readFileSync(dir + 'data/seed.js', 'utf8'));
eval(fs.readFileSync(dir + 'store.js', 'utf8'));

const fail = [];
const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fail.push(n); };

(async () => {

  // --- الأدوار والصلاحيات (منطق محلي خالص، بلا شبكة) ---------------------------
  // signIn الحقيقي الآن يستدعي الشبكة (Supabase Auth فعلي)، فلا نختبره هنا
  // بمحاكاة كاملة؛ ما يستحق التغطية محليًا هو مصفوفة can() نفسها.
  Store.set({ role: 'admin', user: 'admin@test' });
  ok('الأدمن يرى الأكواد', Store.can('codes'));
  ok('الأدمن يرى الطلاب', Store.can('students'));
  ok('الأدمن يرى المحتوى', Store.can('content'));

  Store.set({ role: 'teacher', user: 'teacher@test' });
  ok('المدرّس يحرّر المحتوى', Store.can('content') && Store.can('questions'));
  ok('المدرّس لا يرى الأكواد', !Store.can('codes'));
  ok('المدرّس لا يرى الطلاب', !Store.can('students'));

  Store.signOut();
  ok('الخروج يمسح الدور', Store.get().role === null);
  ok('بلا دور لا صلاحية', !Store.can('content'));
  ok('الخروج يفرّغ المحتوى المحمَّل', Store.get().books.length === 0);

  // --- newId(): معرّفات صالحة لعمود uuid بقاعدة البيانات ------------------------
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ids = Array.from({ length: 500 }, () => Store.newId());
  ok('newId ينتج UUID v4 صالحًا', ids.every((id) => UUID_RE.test(id)));
  ok('newId لا يكرّر (٥٠٠ عيّنة)', new Set(ids).size === ids.length);

  // --- Api.from(): بناء استعلام PostgREST الصحيح --------------------------------
  nextResponse = { status: 200, body: [{ id: '1' }] };
  await Api.from('lessons', { select: 'id,title_ar', order: 'sort_order' });
  ok('from() يستهدف الجدول الصحيح', lastCall.url.includes('/rest/v1/lessons?'));
  ok('from() يمرّر select', lastCall.url.includes('select=id%2Ctitle_ar'));
  ok('from() يمرّر order', lastCall.url.includes('order=sort_order'));
  ok('from() طلب GET', lastCall.method === 'GET');

  // --- Api.upsert(): on_conflict=id + دمج لا استبدال -----------------------------
  nextResponse = { status: 201, body: [{ id: 'x' }] };
  await Api.upsert('questions', { id: 'x', stem_md: 'test' });
  ok('upsert() على /rest/v1/<table>', lastCall.url.startsWith(Api.URL_BASE + '/rest/v1/questions'));
  ok('upsert() يحدّد on_conflict=id', lastCall.url.includes('on_conflict=id'));
  ok('upsert() طلب POST', lastCall.method === 'POST');
  ok('upsert() يطلب resolution=merge-duplicates',
     /resolution=merge-duplicates/.test(lastCall.headers.Prefer || ''));
  ok('upsert() يرسل الصفّ بجسم الطلب', JSON.parse(lastCall.body).id === 'x');

  // --- Api.remove(): حذف بمعرّف محدَّد -------------------------------------------
  nextResponse = { status: 204, body: undefined };
  await Api.remove('lessons', 'abc-123');
  ok('remove() يفلتر بـ id=eq.', lastCall.url.includes('id=eq.abc-123'));
  ok('remove() طلب DELETE', lastCall.method === 'DELETE');

  // --- Api.signInWithPassword(): نجاح وفشل ---------------------------------------
  nextResponse = { status: 200, body: { access_token: 'tok', refresh_token: 'ref', expires_at: 9999999999 } };
  await Api.signInWithPassword('a@b.com', 'secret');
  ok('signInWithPassword يحفظ الجلسة عند النجاح', Api.isSignedIn());
  ok('طلب الدخول بصيغة grant_type=password', lastCall.url.includes('grant_type=password'));

  Api.signOut();
  nextResponse = { status: 400, body: { error_description: 'Invalid credentials' } };
  let loginErr = null;
  try { await Api.signInWithPassword('a@b.com', 'wrong'); } catch (e) { loginErr = e; }
  ok('signInWithPassword يرمي خطأً عند الرفض', loginErr instanceof Api.ApiError);
  ok('لا تُحفظ جلسة عند الفشل', !Api.isSignedIn());

  // --- الهاتف: زر الخروج كان يختفي كليًا (rail__user: display:none)، وحقول
  // الفلترة كانت بعرض ثابت بسمة style التي لا يطالها أي @media إطلاقًا -----------
  const cssDir = require('node:path').join(__dirname, '..', 'css') + '/';
  const adminCss = fs.readFileSync(cssDir + 'admin.css', 'utf8');
  const mobileBlock = (adminCss.match(/@media \(max-width: 760px\) \{[\s\S]*?\n\}/) || [''])[0];
  // ملاحظة: .rail__user \{[^}]*\} فقط (لا .rail__user .grow {...} الفرعية) —
  // إخفاء .grow (اسم المستخدم) مقصود ومختلف عن إخفاء rail__user كلّها كما
  // كان قبل الإصلاح.
  ok('rail__user لا تُخفى كليًا على الهاتف', !/\.rail__user\s*\{[^}]*display:\s*none/.test(adminCss));
  ok('rail__user مثبَّتة (sticky) لتبقى الأزرار قابلة للوصول',
     /\.rail__user\s*\{[^}]*position:\s*sticky/.test(mobileBlock));
  ok('.filter-w معرَّفة لعرض مرن للمرشّحات', /\.filter-w\s*\{/.test(adminCss));

  // نتحقّق من عروض المرشّحات الثابتة تحديدًا (١٧٠-٢٣٠px) لا كل width:Npx
  // بالملف — حقول رقمية ضيّقة عمدًا (رقم الترتيب/الدقائق بعرض 90px) سليمة
  // ولا علاقة لها بمشكلة مرشّحات الهاتف.
  const FILTER_WIDTHS = /style:\s*'width:(170|190|200|220|230)px'/;
  const questionsSrc = fs.readFileSync(dir + 'pages/questions.js', 'utf8');
  const contentSrc = fs.readFileSync(dir + 'pages/content.js', 'utf8');
  ok('بنك الأسئلة لا يستعمل عرضًا ثابتًا بالبكسل للمرشّحات', !FILTER_WIDTHS.test(questionsSrc));
  ok('منتقي الدرس لا يستعمل عرضًا ثابتًا بالبكسل للمرشّحات', !FILTER_WIDTHS.test(contentSrc));
  ok('كلا الملفّين يستعملان filter-w', /filter-w/.test(questionsSrc) && /filter-w/.test(contentSrc));

  // --- سلامة الترميز: يكشف تلف UTF-8 مبكرًا ----------------------------------------
  const SRC = ['ui.js', 'store.js', 'components.js', 'editors.js', 'app.js', 'data/api.js', 'data/seed.js',
               'pages/dashboard.js', 'pages/content.js', 'pages/questions.js',
               'pages/exams.js', 'pages/codes.js', 'pages/students.js', 'pages/videos.js'];
  const corrupt = SRC.filter((f) => /Ø|Ã˜/.test(fs.readFileSync(dir + f, 'utf8')));
  ok('لا تلف في ترميز الملفات', corrupt.length === 0);
  corrupt.forEach((f) => console.log('   ← ترميز تالف: ' + f));

  console.log('\n' + (fail.length ? `${fail.length} فشل` : 'كل الاختبارات نجحت'));
  process.exit(fail.length ? 1 : 0);
})();
