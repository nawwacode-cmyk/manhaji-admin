/* =============================================================================
   بيانات تجريبية للوحة.
   البنية مطابقة لمخطط Supabase، فالانتقال لاحقًا يستبدل مصدر البيانات فقط.
   ============================================================================= */
window.SEED = {

  subjects: [{ id: 'fr', name: 'اللغة الفرنسية', native: 'Français' }],
  grades:   [{ id: 'g9', name: 'الصف التاسع' }, { id: 'g12', name: 'البكالوريا' }],

  topics: [
    { id: 'salutations', name: 'التحيات والتعارف', native: 'Salutations' },
    { id: 'articles',    name: 'أدوات التعريف',    native: 'Les articles' },
    { id: 'conjugaison', name: 'تصريف الأفعال',    native: 'La conjugaison' },
    { id: 'syntaxe',     name: 'بناء الجملة',      native: 'La syntaxe' },
    { id: 'vocabulaire', name: 'المفردات',         native: 'Vocabulaire' },
    { id: 'expression',  name: 'التعبير الكتابي',  native: 'Expression écrite' },
  ],

  // الكتاب = course في مخطط Supabase
  books: [
    { id: 'student',  subject: 'fr', grade: 'g9', title: 'كتاب الطالب',  published: true },
    { id: 'activity', subject: 'fr', grade: 'g9', title: 'كتاب الأنشطة', published: false },
  ],

  units: [
    { id: 'u1', book: 'student', order: 1, title: 'الوحدة الأولى: التعارف والتحيات' },
    { id: 'u2', book: 'student', order: 2, title: 'الوحدة الثانية: الأفعال الأساسية' },
    { id: 'a1', book: 'activity', order: 1, title: 'أنشطة الوحدة الأولى' },
  ],

  lessons: [
    { id: 'u1-l1', unit: 'u1', order: 1, title: 'التحيات والتعارف',
      minutes: 12, free: true, page: 12, video: 'v-u1-l1',
      topics: ['salutations', 'vocabulaire'], published: true,
      body: '<h3>Les salutations — التحيات</h3><p>في الفرنسية تختلف التحية حسب <b>وقت اليوم</b> وحسب <b>درجة الرسمية</b>.</p><table><tr><th>الفرنسية</th><th>العربية</th></tr><tr><td><span class="fr">Bonjour</span></td><td>صباح الخير</td></tr><tr><td><span class="fr">Bonsoir</span></td><td>مساء الخير</td></tr></table><div class="callout">خطأ شائع: استخدام <span class="fr">Bonne nuit</span> عند مغادرة مكان مساءً. الصحيح <span class="fr">Bonsoir</span>.</div>' },
    { id: 'u1-l2', unit: 'u1', order: 2, title: 'أدوات التعريف والتنكير',
      minutes: 15, free: false, page: 16, video: 'v-u1-l2',
      topics: ['articles'], published: true,
      body: '<h3>Les articles définis</h3><p>تُستخدم للحديث عن شيء معروف، وتقابل «الـ» في العربية.</p>' },
    { id: 'u2-l1', unit: 'u2', order: 1, title: 'تصريف être و avoir',
      minutes: 18, free: false, page: 24, video: null,
      topics: ['conjugaison'], published: true,
      body: '<h3>Le verbe être au présent</h3><p>je suis · tu es · il est …</p>' },
    { id: 'u2-l2', unit: 'u2', order: 2, title: 'النفي وبناء الجملة',
      minutes: 10, free: false, page: 30, video: null,
      topics: ['syntaxe'], published: false, body: '<p>مسوّدة — لم تكتمل بعد.</p>' },
  ],

  questions: [
    { id: 'q1', lesson: 'u1-l1', topic: 'salutations', type: 'mcq', difficulty: 1,
      source: 'كتاب الأنشطة ص ٩',
      stem: 'تلتقي أستاذك الساعة الثامنة صباحًا. ماذا تقول؟',
      options: [
        { k: 'أ', t: 'Bonjour', correct: true }, { k: 'ب', t: 'Bonsoir' },
        { k: 'ج', t: 'Bonne nuit' }, { k: 'د', t: 'Salut' }],
      why: 'Bonjour تحية النهار. Salut غير رسمية ولا تُقال للأستاذ.', published: true },
    { id: 'q2', lesson: 'u1-l2', topic: 'articles', type: 'mcq', difficulty: 2,
      source: 'كتاب الأنشطة ص ١٤',
      stem: 'اختر الأداة الصحيحة: ___ maison est grande.',
      options: [{ k: 'أ', t: 'le' }, { k: 'ب', t: 'la', correct: true },
                { k: 'ج', t: 'les' }, { k: 'د', t: 'un' }],
      why: 'كلمة maison مؤنثة مفردة فتأخذ la.', published: true },
    { id: 'q3', lesson: 'u1-l2', topic: 'articles', type: 'multi', difficulty: 3,
      stem: 'أي من هذه الكلمات مؤنثة؟',
      options: [{ k: 'أ', t: 'la nation', correct: true }, { k: 'ب', t: 'le village' },
                { k: 'ج', t: 'la liberté', correct: true }, { k: 'د', t: 'le monument' }],
      why: 'النهايتان ‎-tion‎ و ‎-té‎ مؤنثتان غالبًا.', published: true },
    { id: 'q4', lesson: 'u2-l1', topic: 'conjugaison', type: 'blank', difficulty: 2,
      stem: 'أكمل بتصريف الفعل être:',
      parts: ['Je ', { blank: 0 }, ' étudiant et tu ', { blank: 1 }, ' professeur.'],
      blanks: [{ accept: ['suis'], choices: ['suis', 'es', 'est'] },
               { accept: ['es'], choices: ['es', 'est', 'suis'] }],
      why: 'je suis / tu es / il est.', published: true },
    { id: 'q5', lesson: 'u2-l1', topic: 'conjugaison', type: 'mcq', difficulty: 3,
      stem: 'كيف تقول «عمري خمس عشرة سنة»؟',
      options: [{ k: 'أ', t: 'Je suis quinze ans' }, { k: 'ب', t: "J'ai quinze ans", correct: true },
                { k: 'ج', t: 'Je suis quinze' }],
      why: 'العمر يُقال بالفعل avoir لا être.', published: true },
    { id: 'q6', lesson: 'u2-l2', topic: 'syntaxe', type: 'order', difficulty: 3,
      stem: 'رتّب الكلمات لتكوين جملة منفية صحيحة.',
      answer: ['Je', 'ne', 'suis', 'pas', 'professeur'],
      why: 'قاعدة النفي: ne + الفعل + pas.', published: true },
  ],

  exams: [
    { id: 'mock-1', kind: 'mock', title: 'امتحان تجريبي — النموذج الأول',
      minutes: 45, pass: 50, published: true, questions: ['q1', 'q2', 'q4', 'q5', 'q6'] },
    { id: 'min-2024', kind: 'ministry', title: 'الدورة الوزارية ٢٠٢٤',
      minutes: 60, pass: 50, published: true, questions: ['q2', 'q5', 'q3'] },
    { id: 'min-2023', kind: 'ministry', title: 'الدورة الوزارية ٢٠٢٣',
      minutes: 60, pass: 50, published: false, questions: ['q1', 'q6'] },
  ],

  videos: [
    { id: 'v-u1-l1', title: 'Les salutations', lesson: 'u1-l1',
      seconds: 384, mb: 11.4, quality: '360p', uploaded: '2026-07-20' },
    { id: 'v-u1-l2', title: 'Les articles', lesson: 'u1-l2',
      seconds: 490, mb: 14.8, quality: '360p', uploaded: '2026-07-22' },
  ],

  batches: [
    { id: 'b1', label: 'مكتبة النور — آب ٢٠٢٦', distributor: 'أبو أحمد', phone: '0933000000',
      qty: 50, used: 3, grade: 'g9', days: 365, created: '2026-07-15' },
    { id: 'b2', label: 'معهد الأمل — بكالوريا', distributor: 'م. سامر', phone: '0955111111',
      qty: 30, used: 1, grade: 'g12', days: 365, created: '2026-07-28' },
  ],

  students: [
    { id: 's1', username: 'أحمد التاسع', grade: 'g9', batch: 'b1',
      joined: '2026-07-16', daysLeft: 350, device: 'Android — Samsung A15',
      lastSeen: 'اليوم', progress: 64, lessons: 2, attempts: 214, correct: 78, bestExam: 72 },
    { id: 's2', username: 'سارة ب', grade: 'g12', batch: 'b2',
      joined: '2026-07-29', daysLeft: 363, device: 'Android — Redmi 12',
      lastSeen: 'قبل ساعتين', progress: 18, lessons: 0, attempts: 41, correct: 61, bestExam: 0 },
    { id: 's3', username: 'مروان ك', grade: 'g9', batch: 'b1',
      joined: '2026-07-18', daysLeft: 352, device: null,
      lastSeen: 'قبل ٦ أيام', progress: 31, lessons: 1, attempts: 96, correct: 54, bestExam: 40 },
    { id: 's4', username: 'ليلى ح', grade: 'g9', batch: 'b1',
      joined: '2026-07-20', daysLeft: 354, device: 'iPhone 11',
      lastSeen: 'أمس', progress: 88, lessons: 4, attempts: 302, correct: 91, bestExam: 94 },
  ],

  // أسئلة يخطئ فيها أغلب الطلاب — مؤشر على سؤال سيئ الصياغة لا طلاب ضعاف
  hardQuestions: [
    { id: 'q5', rate: 22, attempts: 180 },
    { id: 'q6', rate: 38, attempts: 142 },
    { id: 'q3', rate: 44, attempts: 121 },
  ],
};
