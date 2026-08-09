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
  ok('المدير يرى الأكواد', Store.can('codes'));
  ok('المدير يرى الطلاب', Store.can('students'));
  ok('المدير يرى المحتوى', Store.can('content'));
  ok('المدير يرى المواد', Store.can('subjects'));
  ok('المدير يرى الأساتذة والبانرات', Store.can('teachers') && Store.can('banners'));
  ok('المدير يرى الطاقم وسجل النشاط', Store.can('staff') && Store.can('audit'));

  Store.set({ role: 'teacher', user: 'teacher@test' });
  ok('الأستاذ يحرّر المحتوى', Store.can('content') && Store.can('questions'));
  ok('الأستاذ لا يرى الأكواد', !Store.can('codes'));
  ok('الأستاذ لا يرى الطلاب', !Store.can('students'));
  // هذه الأربعة يفرضها السيرفر بـ is_admin()؛ إظهارها للأستاذ يعني صفحة
  // تُفتح ثم تفشل كل عملياتها بـ403 — تطابقُ القائمتين مقصود لا تجميلي.
  ok('الأستاذ لا يدير المواد', !Store.can('subjects'));
  ok('الأستاذ لا يدير الأساتذة', !Store.can('teachers'));
  ok('الأستاذ لا يدير البانرات', !Store.can('banners'));
  ok('الأستاذ لا يدير الطاقم ولا يقرأ السجل', !Store.can('staff') && !Store.can('audit'));

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
  nextResponse = { status: 200, body: [{ id: 'abc-123' }] };
  await Api.remove('lessons', 'abc-123');
  ok('remove() يفلتر بـ id=eq.', lastCall.url.includes('id=eq.abc-123'));
  ok('remove() طلب DELETE', lastCall.method === 'DELETE');

  // --- الكتابة الممنوعة بـRLS: تعود بنجاح وقائمة فارغة، لا بخطأ -----------------
  // أخطر سلوك في هذه الطبقة: PostgREST لا يُخطئ حين تمنع RLS التحديث — تُصفّي
  // الصفوف فلا يتطابق شيء ويعود 200 بقائمة فارغة. بلا الفحص كانت اللوحة تقول
  // «حُفظ» بينما القاعدة لم تتغيّر. ظهر فعليًا بعد حصر الأستاذ بموادّه.
  const denied = async (fn) => {
    nextResponse = { status: 200, body: [] };
    try { await fn(); return null; } catch (e) { return e; }
  };
  let e1 = await denied(() => Api.upsert('lessons', { id: 'x', title_ar: 'y' }));
  ok('upsert يرمي خطأً حين تمنعه RLS', e1 instanceof Api.ApiError && e1.code === 'rls_denied');
  ok('رسالة المنع بالعربية وتشرح السبب', /صلاحية/.test(e1?.message || ''));

  let e2 = await denied(() => Api.remove('lessons', 'x'));
  ok('remove يرمي خطأً حين تمنعه RLS', e2 instanceof Api.ApiError && e2.code === 'rls_denied');
  ok('remove يطلب تمثيل المحذوف ليكشف المنع',
     /return=representation/.test(lastCall.headers.Prefer || ''));

  // إدراج ناجح يعيد صفًّا — يجب ألّا يُعتبر منعًا
  nextResponse = { status: 201, body: [{ id: 'ok' }] };
  let e3 = null;
  try { await Api.upsert('lessons', { id: 'ok' }); } catch (e) { e3 = e; }
  ok('الكتابة الناجحة لا تُعدّ منعًا', e3 === null);

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

  // --- تعدّد المواد: لا تثبيت على الفرنسي بعد اليوم ---------------------------------
  const storeSrc = fs.readFileSync(dir + 'store.js', 'utf8');
  const appSrc   = fs.readFileSync(dir + 'app.js', 'utf8');
  ok('loadAll لا يثبّت المادة على fr', !/code === 'fr'/.test(storeSrc));
  ok('المادة الفعّالة تُحفظ محليًا', /subjectId: saved\.subjectId/.test(storeSrc));
  ok('المادة الفعّالة تسقط للأولى إن اختفت المحفوظة',
     /subjects\.some\(\(s\) => s\.id === state\.subjectId\)/.test(storeSrc));
  ok('الدروس محصورة بكورسات المادة الفعّالة', /bookIds\.has\(u\.course_id\)/.test(storeSrc));
  ok('الأسئلة محصورة بالمادة الفعّالة', /q\.subject_id === subjectId/.test(storeSrc));
  ok('مبدّل المادة موجود بالرأس', /function subjectSwitcher/.test(appSrc)
     && /subjectSwitcher\(\)/.test(appSrc));
  // contentCounts تُبنى قبل التصفية — فحصُ الحذف بـbooks المصفّاة كان سيقول
  // «فارغة» عن كل مادة غير فعّالة ويسمح بحذفها وهي مليئة.
  ok('فحص محتوى المادة لا يعتمد على القوائم المصفّاة',
     /contentCounts\[id\]/.test(storeSrc) && !/subjectHasContent = \(id\) => state\.books/.test(storeSrc));

  // --- هوية الجلسة: صفّي أنا لا أول صفّ يعود ---------------------------------------
  // بقّ حقيقي وقع: المدير يرى كل الملفات (admin_read_all_profiles)، فقراءة
  // profiles بلا مرشِّح ثم أخذ rows[0] أعطته اسم أستاذ **ودورَه**. الأستاذ لم
  // يكشفه لأنه يرى صفّه وحده. لو صادف أن الأول لطالب لانقفلت اللوحة على المدير.
  ok('لا قراءة profiles بلا مرشِّح', !/Api\.from\('profiles', \{ select: 'id,full_name,role' \}\)/.test(storeSrc));
  ok('الملف الشخصي يُقرأ بمرشِّح المعرّف', /eq: \{ id: uid \}/.test(storeSrc));
  ok('signIn و resume كلاهما يمرّان بـmyProfile',
     (storeSrc.match(/await myProfile\(\)/g) || []).length === 2);

  const apiSrc = fs.readFileSync(dir + 'data/api.js', 'utf8');
  ok('Api.userId يقرأ sub من التوكن', /function userId\(\)/.test(apiSrc) && /\.sub/.test(apiSrc));
  ok('from() يدعم المرشِّح eq', /eq\.\$\{v\}|`eq\.\$\{v\}`/.test(apiSrc) || /eq\.\$/.test(apiSrc));

  /* الترقيم: PostgREST يقصّ عند db-max-rows (١٠٠٠) بلا إشارة خطأ. الأثر هنا
     أخطر منه عند الطالب — محرِّرٌ يرى سؤالًا بلا خيارات فيضيفها من جديد. */
  ok('from() تُرقّم الصفحات بترويسة Range',
     /Range: `\$\{offset\}-\$\{offset \+ PAGE - 1\}`/.test(apiSrc));
  ok('سعة الصفحة تُتعلَّم لا تُفترض', /if \(full === null\) full = page\.length;/.test(apiSrc)
     && /if \(page\.length < full\) break;/.test(apiSrc));
  ok('الترتيب يُذيَّل بمفتاح فريد', /order \? `\$\{order\},\$\{pageKey\}` : pageKey/.test(apiSrc));
  ok('حارس ضدّ حلقة لا تنتهي إن تُجوهلت Range',
     /head === prevHead/.test(apiSrc) && /pages >= 200/.test(apiSrc));

  // اختبار وظيفي لمنطق الاختيار نفسه: بمعرّف محدَّد لا يُختار الأول
  const fakeRows = [
    { id: 'other', full_name: 'أستاذ', role: 'teacher' },
    { id: 'me', full_name: 'مدير', role: 'admin' },
  ];
  const pickFirst = fakeRows[0];
  const pickMine = fakeRows.find((r) => r.id === 'me');
  ok('أخذ الأول يعطي هوية خاطئة (توثيق البق)', pickFirst.role === 'teacher');
  ok('الاختيار بالمعرّف يعطي الهوية الصحيحة', pickMine.role === 'admin' && pickMine.full_name === 'مدير');

  // --- طبقة الإدارة: أين يُنفَّذ كل فعل ---------------------------------------------
  // القاعدة التي يقوم عليها التصميم كله: جداول المال والهوية لا يلمسها
  // المتصفح مباشرةً. أي انزلاق هنا (قراءة subscriptions بـ Api.from مثلًا)
  // يفتح قاعدة العملاء لأي ثغرة XSS في اللوحة.
  const staffSrc    = fs.readFileSync(dir + 'pages/staff.js', 'utf8');
  const codesSrc    = fs.readFileSync(dir + 'pages/codes.js', 'utf8');
  const studentsSrc = fs.readFileSync(dir + 'pages/students.js', 'utf8');
  const dashSrc     = fs.readFileSync(dir + 'pages/dashboard.js', 'utf8');
  const myCodesSrc  = fs.readFileSync(dir + 'pages/myCodes.js', 'utf8');

  ok('الطاقم عبر Edge Function لا PostgREST',
     /Api\.invoke\('admin-staff'/.test(staffSrc) && !/Api\.from\(/.test(staffSrc));
  // الإصدار صار مفردًا عبر issue-code لا توليدًا جماعيًا عبر admin-codes.
  // `Api.from` مسموحة هنا لكتالوج الباقات وحده (عامّ، لا مال فيه) — ما يُمنع
  // هو جداول المال، ويفحصه حارس `leaky` أدناه على كل الصفحات.
  ok('إصدار الأكواد عبر Edge Function لا كتابة مباشرة',
     /Api\.invoke\('issue-code'/.test(codesSrc)
     && !/Api\.(upsert|remove)\('activation_codes'/.test(codesSrc));
  ok('وقراءتها عبر تقرير مجمَّع لا جدولًا خامًا',
     /Api\.rpc\('admin_codes_report'/.test(codesSrc));
  ok('ولوحة المزوّد كذلك عبر دالّة تحصره بنفسه',
     /Api\.rpc\('provider_dashboard'/.test(myCodesSrc)
     // بلا وسيط معرّف مزوّد: الحصر في SQL لا في الواجهة
     && !/provider_dashboard'[^)]*p_provider/.test(myCodesSrc));
  ok('الطلاب عبر RPC لا قراءة جداول',
     /Api\.rpc\('admin_students'/.test(studentsSrc)
     && !/Api\.from\('(subscriptions|devices|profiles)'/.test(studentsSrc));
  ok('الداشبورد عبر admin_stats', /Api\.rpc\('admin_stats'\)/.test(dashSrc));

  // لا صفحة تقرأ جداول المال مباشرةً بأي شكل
  const ALL_PAGES = ['staff', 'codes', 'students', 'dashboard', 'audit',
                     'subjects', 'teachers', 'banners',
                     'seasons', 'providers', 'myCodes'];
  const leaky = ALL_PAGES.filter((p) => {
    const src = fs.readFileSync(dir + `pages/${p}.js`, 'utf8');
    // `students` أُضيف للقائمة: فيه أسماء الزبائن وأرقامهم — قاعدة عملائك
    // حرفيًّا. يُقرأ عبر التقارير المجمَّعة لا كجدول خام.
    return /Api\.from\('(subscriptions|activation_codes|devices|code_batches|redeem_attempts|students)'/.test(src);
  });
  ok('لا صفحة تقرأ جداول المال/الأجهزة مباشرةً', leaky.length === 0, leaky.join(', '));

  // القائمة الجانبية لا تعرض شيئًا لا يفرضه السيرفر
  ok('أقسام الإدارة كلها في صلاحيات المدير وحده',
     ['students', 'codes', 'staff', 'audit', 'subjects', 'teachers', 'banners',
      'seasons', 'providers']
       .every((x) => Store.ROLES.admin.can.includes(x) && !Store.ROLES.teacher.can.includes(x)));

  // المزوّد: أضيق دور في اللوحة. صفحة واحدة، ولا شيء من المحتوى ولا الطلاب
  // ولا المزوّدين الآخرين. (الحصر الحقيقي في SQL؛ هذا يمنع عرض ما سيُرفض.)
  // صفحة الأعطال: بيانات مقصورة على المدير، وتُقرأ مجمَّعة لا خامًا
  const errSrc = fs.readFileSync(dir + 'pages/errors.js', 'utf8');
  ok('الأعطال عبر RPC مجمَّعة لا جدولًا خامًا',
     /Api\.rpc\('admin_client_errors'/.test(errSrc)
     && !/Api\.from\('client_errors'/.test(errSrc));
  ok('وهي للمدير وحده', Store.ROLES.admin.can.includes('errors')
     && !Store.ROLES.teacher.can.includes('errors')
     && !Store.ROLES.provider.can.includes('errors'));
  // «لا أعطال» يجب أن يُقال صراحةً: صفحةٌ فارغة بلا تفسير تُقرأ «معطّلة»
  ok('وتقول صراحةً حين لا أعطال', /لا أعطال في هذه المدّة/.test(errSrc));

  /* --- الفيديو: الملفّ لا يمرّ عبر خوادمنا ------------------------------------
     حدّ طلب Edge Function بضعة ميغابايت والدرس مئات، فالرفع عبرها مستحيل
     عمليًّا. الرابط الموقّع هو الطريق الوحيد. */
  const vidSrc = fs.readFileSync(dir + 'pages/videos.js', 'utf8');
  // `contentSrc` مُعرَّفة أعلاه (سطر ١٥٧) — نعيد استعمالها لا نُظلّلها.
  // منطق الرفع في المكوّن المشترك لا في الصفحتين: نسختان تنحرفان عند أوّل
  // تعديل يُنسى في إحداهما.
  const upSrc = fs.readFileSync(dir + 'components.js', 'utf8');

  ok('الرفع مباشر إلى R2 برابط موقّع',
     /action: 'sign'/.test(upSrc) && /xhr\.open\('PUT', sign\.upload_url/.test(upSrc));
  ok('ومنطق الرفع مشترك لا مكرَّر',
     /videoUploader/.test(upSrc)
     && !/xhr\.open/.test(vidSrc) && !/xhr\.open/.test(contentSrc));
  // الزرّ داخل الدرس نفسه: المحرِّر يصوّر ويكتب في جلسة واحدة، وإرساله إلى
  // صفحة أخرى ليربط الفيديو خطوةٌ تُنسى فيُنشر درسٌ بلا فيديو.
  ok('وزرّ الرفع داخل محرّر الدرس',
     /C\.videoUploader\(\{[\s\S]{0,120}lessonId: l\.id/.test(contentSrc));
  ok('ويربط الفيديو بالدرس تلقائيًّا',
     /lessonId\) await Api\.update\('lessons', lessonId, \{ video_id/.test(upSrc));
  // fetch لا تعطي تقدّم رفع. وبلا مؤشّر يظنّ المحرِّر أن التطبيق تعلّق فيغلق
  // النافذة في منتصف رفع يستغرق دقائق على شبكة سورية.
  ok('وبتقدّم حقيقي (XHR لا fetch)', /xhr\.upload\.onprogress/.test(upSrc));
  ok('ويمكن إلغاؤه', /xhr\.abort\(\)/.test(upSrc));

  /* الترتيب: التسجيل **بعد** نجاح الرفع. لو سُجّل أوّلًا لبقي في المكتبة
     فيديو لا وجود له في R2، يُربط بدرس، فيرى الطالب مشغّلًا لا يعمل. */
  ok('والتسجيل بعد الرفع لا قبله',
     upSrc.indexOf("xhr.send(file)") < upSrc.indexOf("action: 'commit'"));

  ok('والمدّة تُقرأ من الملفّ لا تُطلب يدويًا', /onloadedmetadata/.test(upSrc));
  ok('والحذف لا يمسّ R2', /الملفّ نفسه يبقى في R2|ما زال في R2/.test(vidSrc));
  // صفحة تُفتح ثم تفشل كل عملياتها تجربةٌ سيّئة لا حماية
  ok('والرفع معطَّل حين لا تخزين', /disabled: !r2Ready/.test(vidSrc));
  ok('والفيديو للمدير وحده (الدالّة تفرض requireAdmin)',
     Store.ROLES.admin.can.includes('videos') && !Store.ROLES.teacher.can.includes('videos'));

  ok('المزوّد لا يملك إلا صفحته', Store.ROLES.provider.can.length === 1
     && Store.ROLES.provider.can[0] === 'myCodes');
  ok('ولا يرى شيئًا من المحتوى أو الإدارة',
     ['content', 'questions', 'students', 'codes', 'providers', 'staff', 'audit', 'seasons']
       .every((x) => !Store.ROLES.provider.can.includes(x)));
  ok('ولا المدير ولا الأستاذ يقعان في صفحة المزوّد',
     !Store.ROLES.teacher.can.includes('myCodes'));

  // الكود الصريح صار واحدًا يُعرض لا ملفًّا بالمئات يُنزَّل. الخطر تبدّل معه:
  // لم يعد «ملف قد يُنسى تنزيله» بل «كود قد يُغلَق عنه قبل نسخه» — فالتحذير
  // في اللحظة، وزرّ نسخ، هما ما يحلّ محلّ التنزيل التلقائي.
  for (const [name, src] of [['صفحة الأكواد', codesSrc], ['لوحة المزوّد', myCodesSrc]]) {
    ok(`${name}: الكود يُعرض بعد الإصدار مباشرةً`, /code-out/.test(src));
    ok(`${name}: مع تحذير أنه لا يُستعاد`, /لا يمكن استعادته|لا يُخزَّن صريحًا/.test(src));
    ok(`${name}: وزرّ نسخ`, /clipboard\.writeText/.test(src));
    ok(`${name}: ولا يُخزَّن محليًا`, !/localStorage[\s\S]{0,40}code/i.test(src));
  }
  // التوليد الجماعي أُزيل فعلًا لا أُخفي: بقاؤه في الشيفرة يعني مسارًا ثانيًا
  // يُنتج أكوادًا مجهولة الطالب بينما يظنّ الجميع أنه أُلغي.
  ok('لا أثر للتوليد الجماعي في الصفحة',
     !/admin-codes/.test(codesSrc) && !/code_batches/.test(codesSrc)
     && !/\bqty\b/.test(codesSrc));

  // stats() المحلية ما عادت تخترع أرقام طلاب/أكواد من SEED الوهمية
  ok('stats المحلية بلا أرقام طلاب أو أكواد وهمية',
     !/students:\s*s\.students\.length/.test(storeSrc)
     && !/codes:\s*s\.batches/.test(storeSrc));

  // --- سلامة الترميز: يكشف تلف UTF-8 مبكرًا ----------------------------------------
  const SRC = ['ui.js', 'store.js', 'components.js', 'editors.js', 'app.js', 'data/api.js', 'data/seed.js',
               'pages/dashboard.js', 'pages/subjects.js', 'pages/teachers.js', 'pages/banners.js',
               'pages/content.js', 'pages/questions.js', 'pages/exams.js', 'pages/codes.js',
               'pages/students.js', 'pages/staff.js', 'pages/audit.js', 'pages/videos.js'];
  const corrupt = SRC.filter((f) => /Ø|Ã˜/.test(fs.readFileSync(dir + f, 'utf8')));
  ok('لا تلف في ترميز الملفات', corrupt.length === 0);

  /* --- كل صفحة تُحلَّل نحويًّا -------------------------------------------------
     خطأ صياغة في صفحة لا يُظهر أي رسالة للمستخدم: `Pages[current]` تصير
     undefined، و`Pages[current] || Pages.dashboard` تعرض **لوحة المعلومات**
     مكانها. فيبدو الأمر «الزرّ يفتح الصفحة الخطأ» لا «الصفحة معطوبة»، ويُبحث
     عن العلّة في التوجيه لا في الملفّ. وقع هذا فعلًا في صفحة الفيديو: قوس
     ناقص واحد.

     `new Function` تُحلّل بلا تنفيذ — تكفي لالتقاط خطأ الصياغة. */
  {
    const pages = fs.readdirSync(dir + 'pages').filter((f) => f.endsWith('.js'));
    const broken = [];
    for (const f of pages) {
      try { new Function(fs.readFileSync(dir + 'pages/' + f, 'utf8')); }
      catch (e) { broken.push(`${f}: ${e.message}`); }
    }
    ok(`كل صفحات اللوحة تُحلَّل (${pages.length})`, broken.length === 0, broken.join(' · '));

    // وكل صفحة في القائمة لها ملفّ مُحمَّل في index.html: صفحة غير محمَّلة
    // تعطي نفس العرض الخاطئ بلا خطأ.
    const html = fs.readFileSync(
      require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
    const navIds = [...appSrc.matchAll(/\{ id: '([a-zA-Z]+)'/g)].map((m) => m[1]);
    const missing = navIds.filter((id) => !html.includes(`pages/${id}.js`));
    ok('وكل صفحة في القائمة محمَّلة في index.html', missing.length === 0, missing.join(', '));
  }

  /* --- upsert الجزئي: خلل صامت حتى لحظة الضغط على الزرّ ---------------------
     `Api.upsert` تبني `INSERT … ON CONFLICT DO UPDATE`، وPostgres يتحقّق من
     قيود NOT NULL على صفّ الإدراج **قبل** بلوغ مرحلة الدمج. فتمرير حقل أو
     حقلين لصفّ فيه أعمدة إلزامية أخرى يُخفق بـ
     `null value in column … violates not-null constraint`
     رغم أن الصفّ موجود ولن يُدرَج شيء. وقع هذا فعلًا في «اجعله الحالي».

     الحارس: أي استدعاء upsert لا يحمل إلّا `id` وحقلًا واحدًا هو تعديل جزئي
     متنكّر — يجب أن يكون `update`. */
  {
    const PAGES = fs.readdirSync(dir + 'pages').filter((f) => f.endsWith('.js'));
    const bad = [];
    for (const f of PAGES) {
      const src = fs.readFileSync(dir + 'pages/' + f, 'utf8');
      // العدّ بالفواصل لا بالنقطتين: `{ id, is_current: true }` اختصارٌ بلا
      // نقطتين بعد id، فتعبيرٌ يشترطها يمرّ على الخلل بلا أن يراه — وهو ما
      // وقع فعلًا في أوّل صياغة لهذا الحارس.
      const re = /Api\.upsert\(\s*'([a-z_]+)'\s*,\s*(\{[^{}]*\})\s*\)/g;
      let m;
      while ((m = re.exec(src))) {
        const obj = m[2];
        if (obj.includes('...')) continue;           // نشرٌ ⇒ صفّ كامل، لا جزئي
        if (!/\bid\b/.test(obj)) continue;           // بلا id ⇒ إدراج جديد
        if (obj.split(',').length <= 2) bad.push(`${f} → ${m[1]}`);
      }
    }
    ok('لا upsert جزئي (استعمل update للتعديل الجزئي)', bad.length === 0, bad.join(' · '));
  }
  corrupt.forEach((f) => console.log('   ← ترميز تالف: ' + f));

  console.log('\n' + (fail.length ? `${fail.length} فشل` : 'كل الاختبارات نجحت'));
  process.exit(fail.length ? 1 : 0);
})();
