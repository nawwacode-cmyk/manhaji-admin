/* =============================================================================
   الفيديوهات — مكتبة ورفع وربط بالدروس

   الملفّ **لا يمرّ عبر خوادمنا**: نطلب رابط PUT موقّعًا من `admin-video` ثم
   يرفع المتصفّح إلى Cloudflare R2 مباشرةً. المرور عبر Edge Function مستحيل
   عمليًّا — حدّ الطلب بضعة ميغابايت والدرس مئات.

   والرفع بـXMLHttpRequest لا fetch: `fetch` لا تعطي تقدّم الرفع. وشريط
   التقدّم ليس زينة هنا — رفع ٦٠٠ م.ب على شبكة سورية يستغرق دقائق، وبلا
   مؤشّر يظنّ المحرِّر أن التطبيق تعلّق فيغلق النافذة في منتصف الرفع.

   الترتيب: وقّع ← ارفع ← سجّل. التسجيل **بعد** نجاح الرفع، وإلّا بقي في
   المكتبة فيديو لا وجود له في R2 يُربط بدرس فيرى الطالب مشغّلًا لا يعمل.
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');
  const mb = (b) => (b ? Math.round(b / 1048576 * 10) / 10 : 0);
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ar',
    { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  Pages.videos = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    let videos = [], lessons = [], r2Ready = false, loadErr = null, busy = true;

    async function load() {
      busy = true;
      try {
        const [lib, ls] = await Promise.all([
          Api.invoke('admin-video', { action: 'list' }),
          // الدروس لربط الفيديو بها — عبر الجدول مباشرةً (محتوى لا مال)
          Api.from('lessons', { select: 'id,title_ar,video_id,unit_id', order: 'sort_order' }),
        ]);
        videos = lib.videos || []; r2Ready = !!lib.r2_ready; lessons = ls || [];
        loadErr = null;
      } catch (e) { loadErr = e.message || 'تعذّر تحميل المكتبة.'; }
      busy = false;
      draw();
    }

    /** ربط/فكّ الفيديو بدرس. الجدول مباشرةً — `lessons` جدول محتوى لا مال. */
    async function linkTo(videoId, lessonId, prevLessonIds = []) {
      // نفكّ القديم أوّلًا: بلا هذا يشير درسان إلى نفس الفيديو، وهو ما لم
      // يُقصد أبدًا حين يختار المحرِّر «الدرس المرتبط».
      for (const id of prevLessonIds) await Api.update('lessons', id, { video_id: null });
      if (lessonId) await Api.update('lessons', lessonId, { video_id: videoId });
    }

    // =========================================================================
    // الرفع — عبر المكوّن المشترك (C.videoUploader)
    //
    // نسخة ثانية من منطق الرفع هنا كانت ستنحرف عن نظيرتها في محرّر الدرس
    // عند أوّل تعديل يُنسى في إحداهما. المنطق دقيق: ترتيب التوقيع والرفع
    // والتسجيل، والإلغاء، وقراءة المدّة — فمكانه واحد.
    // =========================================================================
    function uploader() {
      if (!r2Ready) {
        return C.modal({
          title: "التخزين غير مضبوط",
          body: h("div",
            h("div.mb", "مفاتيح Cloudflare R2 غير مضبوطة على السيرفر."),
            h("span.help", "اضبط R2_ACCOUNT_ID و R2_ACCESS_KEY_ID و "
              + "R2_SECRET_ACCESS_KEY و R2_BUCKET ثم أعد المحاولة.")),
          actions: [{ label: "حسنًا", kind: "primary", onClick: (c) => c() }],
        });
      }
      C.videoUploader({ onDone: () => load() });
    }


    // =========================================================================
    function editor(v) {
      const fTitle = C.input({ value: v.title });
      const current = lessons.find((l) => l.video_id === v.id);
      const fLesson = C.select([['', '— بلا ربط —'],
        ...lessons.map((l) => [l.id, l.title_ar])], current?.id || '');
      const err = h('div.badge.badge--err', { style: 'display:none' });

      C.modal({
        title: `تعديل: ${v.title}`,
        body: h('div',
          C.field('العنوان', fTitle),
          C.field('الدرس المرتبط', fLesson),
          h('div.help', { style: 'margin-top:10px' },
            h('div', h('b', 'مفتاح R2: '), h('span.mono.small', v.r2_key)),
            h('div', h('b', 'الحجم: '), `${ar(mb(v.size_bytes))} م.ب · `,
              h('b', 'المدّة: '), fmtDur(v.duration_s))),
          err),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: async (c) => {
            try {
              await Api.update('videos', v.id, { title: fTitle.value.trim() });
              const prev = lessons.filter((l) => l.video_id === v.id).map((l) => l.id);
              await linkTo(v.id, fLesson.value || null, prev);
              C.toast('حُفظ'); c(); load();
            } catch (e) { err.textContent = e.message || 'تعذّر الحفظ.'; err.style.display = ''; }
          } },
        ],
      });
    }

    function draw() {
      if (loadErr) { wrap.replaceChildren(C.card('الفيديوهات', h('div.badge.badge--err', loadErr))); return; }

      const totalMb = videos.reduce((a, v) => a + mb(v.size_bytes), 0);
      const unlinked = videos.filter((v) => !v.lessons.length);
      const noVideo = lessons.filter((l) => !l.video_id);

      wrap.replaceChildren(
        !r2Ready && !busy && h('div.badge.badge--warn.mb',
          'تخزين R2 غير مضبوط على السيرفر — الرفع معطَّل.'),

        h('div.grid.grid--3.mb',
          C.kpi('الفيديوهات', ar(videos.length)),
          C.kpi('حجم المكتبة', `${ar(Math.round(totalMb))} م.ب`,
                'يُخزَّن مرّة — النقل من R2 مجّاني'),
          // فيديو غير مربوط لا يراه طالب: عملٌ مرفوع ومدفوع تخزينه بلا فائدة
          C.kpi('غير مربوط بدرس', ar(unlinked.length), unlinked.length ? 'لا يراه أحد' : null,
                unlinked.length ? 'var(--warn)' : undefined)),

        h('div.row.mb', { style: 'gap:10px;flex-wrap:wrap' },
          h('span.grow'),
          h('button.btn.btn--sec.btn--sm', { onclick: load }, 'تحديث'),
          h('button.btn.btn--primary.btn--sm',
            { onclick: uploader, disabled: !r2Ready }, '+ رفع فيديو')),

        C.card('مكتبة الفيديو',
          C.table(['العنوان', 'الدرس المرتبط', 'المدّة', 'الحجم', 'الجودة', 'رُفع', ''],
            videos, (v) => [
              h('div', { style: 'font-weight:600' }, v.title),
              v.lessons.length
                ? h('span.small', v.lessons.join('، '))
                : h('span.badge.badge--warn', 'غير مرتبط'),
              h('span.num', fmtDur(v.duration_s)),
              h('span.num', `${ar(mb(v.size_bytes))} م.ب`),
              h('span.badge.badge--mute', v.quality),
              h('span.faint.small', fmtDate(v.created_at)),
              C.actions(
                h('button.btn.btn--sec.btn--sm', { onclick: () => editor(v) }, 'تعديل'),
                h('button.btn.btn--danger.btn--sm', {
                  onclick: () => C.confirmDialog('حذف الفيديو',
                    'يُحذف السجلّ من المكتبة. الملفّ نفسه يبقى في R2 — حذفه '
                    + 'لا رجعة فيه، فيُنظَّف يدويًّا من لوحة Cloudflare عند التأكّد.',
                    async () => {
                      try {
                        await Api.invoke('admin-video', { action: 'remove', id: v.id });
                        C.toast('حُذف السجلّ'); load();
                      } catch (e) { C.toast(e.message || 'تعذّر الحذف', 'err'); }
                    }, 'حذف'),
                }, 'حذف')),
            ], busy ? 'جارٍ التحميل…' : 'لا فيديوهات بعد. ارفع أوّل فيديو لتربطه بدرس.')),

        noVideo.length > 0 && h('div.mt',
          C.card('دروس بلا فيديو',
            C.table(['الدرس', ''], noVideo.slice(0, 20), (l) => [
              h('div', { style: 'font-weight:600' }, l.title_ar),
              C.actions(h('button.btn.btn--sec.btn--sm',
                { onclick: () => App.go('content') }, 'افتح الدروس')),
            ]),
            h('span.badge.badge--warn', `${ar(noVideo.length)} درسًا`))),

        h('div.mt', C.card('قبل الرفع — اضغط الفيديو',
          h('div',
            h('div.mono.small', { style: 'direction:ltr;text-align:left;white-space:pre-wrap' },
              'ffmpeg -i "input.mp4" -c:v libx264 -preset slow -crf 22 \\\n'
              + '  -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "output.mp4"'),
            h('div.help', { style: 'margin-top:10px' },
              'نبقى على 1080p ولا ننزل الدقّة: دروسنا نصّية بصريًّا (قواعد وجداول '
              + 'تصريف)، والنصّ أوّل ما ينهار عند خفض الدقّة فيقرأ الطالب ضبابًا. '
              + 'و«faststart» تجعل الفيديو يبدأ قبل اكتمال تنزيله — بدونها ينتظر '
              + 'الطالب الملفّ كاملًا على شبكة بطيئة.')))),
      );
    }

    load();
    return page;
  };
})();
