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

  /**
   * قراءة جدول عبر PostgREST — تجلب كامل الجدول (بحسب ما تسمح به RLS).
   * حجم المحتوى صغير (عشرات الوحدات، مئات الأسئلة)، فالتصفية والربط
   * (join) يحدثان في الواجهة تمامًا كما كانت تعمل على SEED الوهمية —
   * هذا يبقي صفحات content.js وquestions.js شبه بلا تغيير.
   */
  function from(table, { select = '*', order } = {}) {
    const q = new URLSearchParams({ select });
    if (order) q.set('order', order);
    return request(`/rest/v1/${table}?${q}`);
  }

  /** إدراج أو تحديث بمفتاح id — يعمل كتحديث لصفّ قائم أو إدراج لصفّ جديد. */
  function upsert(table, row) {
    return request(`/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      body: row,
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    });
  }

  function remove(table, id) {
    return request(`/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE' });
  }

  /** استبدال كامل لصفوف جدول وسيط (متعدد-لمتعدد) — يحذف القديم ثم يُدرج الجديد. */
  async function replaceJoin(table, matchColumn, matchValue, rows) {
    await request(`/rest/v1/${table}?${matchColumn}=eq.${matchValue}`, { method: 'DELETE' });
    if (rows.length) {
      await request(`/rest/v1/${table}`, { method: 'POST', body: rows, headers: { Prefer: 'return=minimal' } });
    }
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
    isSignedIn, session: () => session, refresh,
    request, from, upsert, remove, replaceJoin,
    signInWithPassword, signOut,
  };
})();
