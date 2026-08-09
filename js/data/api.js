/* =============================================================================
   api.js — طبقة الاتصال بـ Supabase (نسخة اللوحة)

   نفس مبدأ تطبيق الطالب (js/data/api.js هناك): عميل مكتوب بيدنا بدل
   supabase-js — HTTP عادي، بلا خطوة بناء وبلا CDN. الفرق الوحيد عن نسخة
   الطالب: الدخول هنا بريد/كلمة مرور حقيقيان (المدرّس شخص معروف واحد، لا
   حاجة لآلية الكود المشتقّة التي يستعملها الطلاب)، ولا حاجة لمنطق أوفلاين
   لأن اللوحة أداة عمل يومي يُفترض فيها اتصال دائم.
   ============================================================================= */
window.Api = (function () {

  const URL_BASE = 'https://ybwkunmyqbbwnnuaufgc.supabase.co';
  const ANON = 'sb_publishable_6xSYPVKr2zBSaqnbTpWi4A_pO7MJuxU';

  const SESSION_KEY = 'manhaji.admin.session.v1';

  let session = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }
  function save(s) {
    session = s;
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }

  const isSignedIn = () => !!session?.access_token;

  function expired() {
    if (!session?.expires_at) return false;
    return Date.now() > (session.expires_at * 1000) - 120_000;
  }

  async function refresh() {
    if (!session?.refresh_token) return false;
    try {
      const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) { save(null); return false; }
      save(await res.json());
      return true;
    } catch { return false; }
  }

  async function authHeader() {
    if (session && expired()) await refresh();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  class ApiError extends Error {
    constructor(code, message, status) { super(message); this.code = code; this.status = status; }
  }

  async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
    const h = { apikey: ANON, ...headers };
    if (auth) Object.assign(h, await authHeader());
    if (body !== undefined) h['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(URL_BASE + path, {
        method, headers: h,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('offline', 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت.', 0);
    }

    if (res.status === 204) return null;
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }

    if (!res.ok) {
      const code = data?.error || data?.code || 'http_' + res.status;
      const msg = data?.error_description || data?.message || 'حدث خطأ غير متوقع.';
      throw new ApiError(code, msg, res.status);
    }
    return data;
  }

  /* ---------------------------------------------------------------------------
     PostgREST يقصّ كل استجابة عند `db-max-rows` (١٠٠٠) بلا أي إشارة خطأ. الأثر
     هنا أخطر منه في تطبيق الطالب: جدول question_options تجاوز الحدّ فعلًا
     (١٣٠١ صفًّا)، فكان المحرِّر يرى سؤالًا **بلا خيارات** ويظنّها ناقصة
     فيضيفها من جديد — أي تكرارٌ في البيانات سببه عرضٌ ناقص.

     السعة تُتعلَّم من أول صفحة لا تُفترض، فلو خُفِّض الحدّ لاحقًا بقي صحيحًا.
  --------------------------------------------------------------------------- */
  const PAGE = 1000;

  /**
   * قراءة جدول عبر PostgREST — تجلب كامل الجدول (بحسب ما تسمح به RLS)،
   * مُرقَّمةً على صفحات. التصفية والربط (join) يحدثان في الواجهة كما كانا.
   */
  async function from(table, { select = '*', order, eq, pageKey = 'id' } = {}) {
    const q = new URLSearchParams({ select });
    // eq: { id: '...' } ⇒ ?id=eq.<value>
    if (eq) for (const [k, v] of Object.entries(eq)) q.set(k, `eq.${v}`);
    /* ترتيب فريد شرطُ صحّة للترقيم: `sort_order` غير فريد، والخادم حرٌّ في
       ترتيب المتساويات بين صفحة وأخرى — فيتكرّر صفّ ويسقط آخر بلا خطأ ظاهر. */
    q.set('order', order ? `${order},${pageKey}` : pageKey);

    const out = [];
    let full = null, prevHead = null;
    for (let offset = 0, pages = 0; ; pages++) {
      const page = await request(`/rest/v1/${table}?${q}`, {
        headers: { 'Range-Unit': 'items', Range: `${offset}-${offset + PAGE - 1}` },
      });
      if (!Array.isArray(page)) return page;

      // حارس ضدّ حلقة لا تنتهي لو تجاهل وسيطٌ ترويسة Range فأعاد الصفحة نفسها
      const head = page.length ? JSON.stringify(page[0]) : null;
      if (head !== null && head === prevHead) {
        console.error(`الخادم يتجاهل ترويسة Range على ${table} — قد تكون النتيجة ناقصة`);
        break;
      }
      prevHead = head;

      out.push(...page);
      if (!page.length) break;
      if (full === null) full = page.length;
      if (page.length < full) break;
      offset += page.length;
      if (pages >= 200) {
        console.error(`ترقيم ${table} تجاوز الحدّ المعقول — توقّفنا عند ${out.length} صفًّا`);
        break;
      }
    }
    return out;
  }

  /**
   * معرّف المستخدم الحالي، مقروءًا من حمولة الـJWT.
   *
   * ضروري لا تجميلي: المدير يرى **كل** الملفات الشخصية (سياسة
   * admin_read_all_profiles)، فقراءة profiles بلا مرشِّح ثم أخذ أول صفّ
   * تعطيه هوية شخص آخر ودورَه. حدث ذلك فعليًا: أول مدير دخل ظهر باسم أستاذ
   * وبصلاحياته لأن صفّه صادف أن يكون الأول.
   *
   * لا نتحقّق من التوقيع هنا — لا فائدة من ذلك في المتصفح، والسيرفر هو من
   * يتحقّق. هذه قراءة للمعرّف فقط لبناء استعلام صحيح.
   */
  function userId() {
    const t = session?.access_token;
    if (!t) return null;
    try {
      const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(p)))).sub || null;
    } catch { return null; }
  }

  /**
   * إدراج أو تحديث بمفتاح id — يعمل كتحديث لصفّ قائم أو إدراج لصفّ جديد.
   *
   * ⚠️ RLS لا تُرجع خطأً عند منع تحديث: تُصفّي الصفوف فلا يتطابق شيء، ويعود
   * PostgREST بنجاح وقائمة فارغة. بلا الفحص أدناه كانت اللوحة تقول «حُفظ»
   * وتحدّث حالتها المحلية بينما القاعدة لم تتغيّر — ويظهر التراجع عند أول
   * تحديث للصفحة. ظهر هذا فعليًا بعد حصر الأستاذ بموادّه: قبله كان كل طاقم
   * يكتب كل شيء فلم تحدث الحالة أصلًا.
   */
  async function upsert(table, row) {
    const out = await request(`/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      body: row,
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    });
    if (Array.isArray(out) && out.length === 0) {
      throw new ApiError('rls_denied',
        'لا تملك صلاحية التعديل على هذا العنصر. إن كنت أستاذًا فهو خارج موادّك.', 403);
    }
    return out;
  }

  /**
   * تعديل جزئي لصفّ قائم — PATCH لا upsert.
   *
   * `upsert` أعلاه تبني `INSERT … ON CONFLICT DO UPDATE`، وPostgres يتحقّق من
   * قيود `NOT NULL` على صفّ الإدراج **قبل** أن يصل إلى مرحلة الدمج. فتمرير
   * حقلين فقط لصفّ فيه أعمدة إلزامية أخرى يُخفق بـ
   * `null value in column … violates not-null constraint`
   * رغم أن الصفّ موجود ولا شيء سيُدرَج فعلًا. وقع هذا فعلًا عند تعيين
   * «الموسم الحالي»: أُرسل `{id, is_current}` فاشتكى من `code` الفارغ.
   *
   * القاعدة: `upsert` لصفّ كامل، و`update` لتعديل حقل أو حقلين.
   */
  async function update(table, id, patch) {
    const out = await request(`/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: patch,
      headers: { Prefer: 'return=representation' },
    });
    // المنع في RLS يعود 200 بمصفوفة فارغة لا خطأً — بلا هذا الفحص نقرأ المنع
    // نجاحًا ونخبر المستخدم أن تعديله حُفظ وهو لم يُحفظ.
    if (Array.isArray(out) && out.length === 0) {
      throw new ApiError('rls_denied',
        'لا تملك صلاحية التعديل على هذا العنصر.', 403);
    }
    return out;
  }

  /** يطلب تمثيل المحذوف لنفس السبب أعلاه: الحذف الممنوع يعود 204 صامتًا. */
  async function remove(table, id) {
    const out = await request(`/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    if (Array.isArray(out) && out.length === 0) {
      throw new ApiError('rls_denied',
        'لا تملك صلاحية حذف هذا العنصر. إن كنت أستاذًا فهو خارج موادّك.', 403);
    }
    return out;
  }

  /** استبدال كامل لصفوف جدول وسيط (متعدد-لمتعدد) — يحذف القديم ثم يُدرج الجديد. */
  async function replaceJoin(table, matchColumn, matchValue, rows) {
    await request(`/rest/v1/${table}?${matchColumn}=eq.${matchValue}`, { method: 'DELETE' });
    if (rows.length) {
      await request(`/rest/v1/${table}`, { method: 'POST', body: rows, headers: { Prefer: 'return=minimal' } });
    }
  }

  /**
   * نداء Edge Function إدارية.
   *
   * ما يمرّ من هنا هو ما لا يجوز أن يمرّ من المتصفح مباشرةً: إنشاء الحسابات
   * (يحتاج Auth Admin API) وتوليد الأكواد (يحتاج ACTIVATION_PEPPER). الدالة
   * تفحص is_admin() بنفسها على السيرفر — إخفاء الزر هنا ليس حماية.
   */
  async function invoke(name, body) {
    const res = await fetch(`${URL_BASE}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: ANON, ...(await authHeader()), 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).catch(() => null);

    if (!res) throw new ApiError('offline', 'تعذّر الاتصال بالخادم.', 0);
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok === false) {
      throw new ApiError(data?.code || 'fn_error',
        data?.message || `فشل الطلب (${res.status}).`, res.status);
    }
    return data;
  }

  /** نداء دالة SQL (RPC) — للقراءات المجمَّعة التي لا يجوز فتح جداولها للعميل. */
  async function rpc(fn, args = {}) {
    return request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args });
  }

  // ---------------------------------------------------------------------------
  // التخزين — دلو public-media العام (صور الأساتذة والبانرات)
  //
  // الرفع مباشرةً من المتصفح بتوكن المستخدم؛ سياسات storage تفرض أن يكون
  // من الطاقم. لا Edge Function وسيطة: لا سرّ هنا ولا منطق يستحق سيرفرًا،
  // ومرور الملف عبر دالة يعني تحميله كاملًا في ذاكرتها بلا فائدة.
  // ---------------------------------------------------------------------------
  const BUCKET = 'public-media';

  /** الرابط العام الدائم لملف — يصلح للتخزين المؤقّت وللوضع دون إنترنت. */
  const publicUrl = (path) =>
    path ? `${URL_BASE}/storage/v1/object/public/${BUCKET}/${path}` : null;

  /**
   * يرفع ملفًا ويعيد مساره داخل الدلو (لا الرابط الكامل).
   *
   * نخزّن المسار لا الرابط: الرابط يحوي نطاق المشروع، فتغييره يومًا (نقل
   * المشروع، نطاق مخصّص) يُبطل كل صفّ في القاعدة. المسار يبقى صالحًا.
   *
   * الاسم يحمل طابعًا زمنيًا: رفع صورة جديدة لنفس الأستاذ ينشئ ملفًا جديدًا
   * بدل الكتابة فوق القديم، فلا يُظهر المتصفح الصورة القديمة من كاشه.
   */
  async function uploadImage(file, folder) {
    if (!file) throw new ApiError('no_file', 'لم يُختَر ملف.', 400);
    if (!/^image\/(png|jpeg|webp|avif)$/.test(file.type)) {
      throw new ApiError('bad_type', 'الصيغ المقبولة: PNG أو JPEG أو WebP أو AVIF.', 400);
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new ApiError('too_big', 'حجم الصورة يتجاوز ٥ ميغابايت.', 400);
    }

    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg',
                   'image/webp': 'webp', 'image/avif': 'avif' })[file.type];
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { apikey: ANON, ...(await authHeader()), 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new ApiError('upload_failed',
        res.status === 403
          ? 'لا تملك صلاحية رفع الصور.'
          : `تعذّر رفع الصورة (${res.status}). ${t.slice(0, 120)}`,
        res.status);
    }
    return path;
  }

  /** حذف صورة قديمة — فشلُه لا يُفشل العملية: الصفّ أهمّ من ملف يتيم. */
  async function deleteImage(path) {
    if (!path) return;
    try {
      await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'DELETE', headers: { apikey: ANON, ...(await authHeader()) },
      });
    } catch { /* ملف يتيم بالدلو أهون من فشل حفظ البيانات */ }
  }

  // ---------------------------------------------------------------------------
  // المصادقة: بريد/كلمة مرور حقيقيان (Supabase Auth القياسي)
  // ---------------------------------------------------------------------------
  async function signInWithPassword(email, password) {
    const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data?.error_code || 'auth_failed',
        res.status === 400 ? 'البريد أو كلمة المرور غير صحيحة.' : (data?.msg || 'تعذّر تسجيل الدخول.'),
        res.status);
    }
    save(data);
    return data;
  }

  function signOut() { save(null); }

  return {
    URL_BASE, ANON, ApiError,
    isSignedIn, userId, session: () => session, refresh,
    request, from, upsert, update, remove, replaceJoin, invoke, rpc,
    uploadImage, deleteImage, publicUrl,
    signInWithPassword, signOut,
  };
})();
