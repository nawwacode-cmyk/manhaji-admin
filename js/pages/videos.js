/* =============================================================================
   الفيديوهات — مكتبة ورفع وربط بالدروس
   ============================================================================= */
window.Pages = window.Pages || {};

(function () {
  const { h, ar } = UI;

  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  Pages.videos = () => {
    const page = h('div.content');
    const wrap = h('div.wrap');
    page.appendChild(wrap);

    function draw() {
      const s = Store.get();
      const totalMb = Math.round(s.videos.reduce((a, v) => a + v.mb, 0) * 10) / 10;
      const noVideo = s.lessons.filter((l) => !l.video);

      // تقدير الكلفة: الحجم × عدد الطلاب المتوقّع. هذا الرقم هو الذي يقرّر
      // جودة الترميز، ولا يجب أن يُكتشف بعد رفع ٢٤ فيديو.
      const perStudent = totalMb;
      const for100 = Math.round((perStudent * 100) / 1024 * 10) / 10;

      wrap.replaceChildren(
        h('div.grid.grid--3.mb',
          C.kpi('الفيديوهات', ar(s.videos.length)),
          C.kpi('الحجم الإجمالي', `${totalMb} م.ب`, 'لكل طالب ينزّل الكل'),
          C.kpi('تقدير النقل الشهري', `${for100} غيغا`, 'لو نزّلها ١٠٠ طالب',
                for100 > 50 ? 'var(--warn)' : undefined)),

        noVideo.length > 0 && h('div.mb',
          C.card('دروس بلا فيديو',
            C.table(['الدرس', ''], noVideo, (l) => [
              h('div', { style: 'font-weight:600' }, l.title),
              C.actions(h('button.btn.btn--sec.btn--sm', {
                onclick: () => App.go('content', { lesson: l.id }),
              }, 'افتح الدرس')),
            ]),
            h('span.badge.badge--warn', `${ar(noVideo.length)} درس`))),

        C.card('مكتبة الفيديو',
          C.table(['العنوان', 'الدرس المرتبط', 'المدة', 'الحجم', 'الجودة', 'الرفع', ''],
            s.videos, (v) => {
              const l = Store.lessonById(v.lesson);
              return [
                h('div', { style: 'font-weight:600' }, v.title),
                l ? l.title : h('span.badge.badge--warn', 'غير مرتبط'),
                h('span.num', fmt(v.seconds)),
                h('span.num', `${v.mb} م.ب`),
                h('span.badge.badge--mute', v.quality),
                h('span.faint.small.mono', v.uploaded),
                C.actions(
                  h('button.btn.btn--sec.btn--sm', { onclick: () => edit(v) }, 'تعديل'),
                  h('button.btn.btn--danger.btn--sm', {
                    onclick: () => C.confirmDialog('حذف الفيديو',
                      'سيُحذف الفيديو، والدرس المرتبط سيصبح بلا فيديو.',
                      () => {
                        Store.get().lessons.filter((x) => x.video === v.id)
                          .forEach((x) => Store.upsert('lessons', { id: x.id, video: null }));
                        Store.remove('videos', v.id); C.toast('حُذف الفيديو'); draw();
                      }, 'حذف'),
                  }, 'حذف')),
              ];
            }, 'لا فيديوهات بعد. ارفع أول فيديو لتربطه بدرس.'),
          h('button.btn.btn--primary.btn--sm', { onclick: () => upload() }, '+ رفع فيديو')),

        h('div.mt',
          C.card('قرار الجودة — احسمه قبل تصوير الدروس', h('div',
            C.table(['الجودة', 'الدرس (١٠ دقائق)', '٢٤ درسًا', 'ملاحظة'],
              [
                ['480p فيديو كامل', '~٦٠ م.ب', '١٫٤ غيغا', 'أعلى جودة، أثقل نقل'],
                ['360p فيديو كامل', '~٣٤ م.ب', '٨٠٠ م.ب', 'مقبول على هاتف متوسط'],
                ['شرائح + صوت شرح', '~١١ م.ب', '٢٦٠ م.ب', 'الأنسب لمنهاج لغة'],
              ], (r) => r.map((c, i) => i === 3 ? h('span.faint.small', c) : c)),
            h('div.help.mt',
              'لمنهاج لغة أنت تشرح قواعد وجداول لا تُظهر حركة — الشرائح مع صوتك '
              + 'تنزل بالحجم إلى الخُمس تقريبًا. هذا الفرق بين تطبيق يُنزَّل وتطبيق يُهجَر '
              + 'على نت سوري.')))),
      );
    }

    // =========================================================================
    function upload() {
      const fTitle = C.input({ placeholder: 'Les salutations' });
      const fLesson = C.select([['', '— بلا ربط —'],
        ...Store.lessonPaths().map((l) => [l.id, l.title])], '');
      const fQuality = C.select([['360p', '360p'], ['480p', '480p'], ['slides', 'شرائح + صوت']], '360p');
      const info = h('div');
      const progress = h('div');
      let file = null;

      const drop = h('div.drop',
        h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'اسحب ملف الفيديو هنا'),
        h('div.small', 'أو اضغط للاختيار — mp4 · webm'));

      const picker = h('input', { type: 'file', accept: 'video/*', style: 'display:none' });
      drop.addEventListener('click', () => picker.click());
      ['dragover', 'dragenter'].forEach((e) => drop.addEventListener(e, (ev) => {
        ev.preventDefault(); drop.classList.add('is-over');
      }));
      ['dragleave', 'drop'].forEach((e) => drop.addEventListener(e, () => drop.classList.remove('is-over')));
      drop.addEventListener('drop', (ev) => { ev.preventDefault(); take(ev.dataTransfer.files[0]); });
      picker.addEventListener('change', () => take(picker.files[0]));

      function take(f) {
        if (!f) return;
        if (!f.type.startsWith('video/')) return C.toast('الملف ليس فيديو', 'err');
        file = f;
        const mb = Math.round(f.size / 1048576 * 10) / 10;
        if (!fTitle.value) fTitle.value = f.name.replace(/\.[^.]+$/, '');

        // نقرأ المدة من الملف نفسه — لا نطلب من المستخدم إدخالها يدويًا
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => {
          file._seconds = Math.round(v.duration);
          URL.revokeObjectURL(v.src);
          showInfo(mb, file._seconds);
        };
        v.onerror = () => showInfo(mb, null);
        v.src = URL.createObjectURL(f);
      }

      function showInfo(mb, seconds) {
        const perMin = seconds ? Math.round(mb / (seconds / 60) * 10) / 10 : null;
        info.replaceChildren(
          h('div.row.mt',
            h('span.badge.badge--acc', `${mb} م.ب`),
            seconds && h('span.badge.badge--mute', fmt(seconds)),
            perMin && h('span.badge.' + (perMin > 6 ? 'badge--warn' : 'badge--ok'),
              `${perMin} م.ب/دقيقة`)),
          perMin > 6 && h('div.help', { style: 'margin-top:8px' },
            'أعلى من الموصى به. أعد ترميزه بجودة أقل قبل الرفع — كل ميغابايت '
            + 'زائد يتحمّله كل طالب ينزّل الدرس.'));
      }

      C.modal({
        title: 'رفع فيديو',
        body: h('div',
          drop, picker, info,
          h('div.mt',
            C.field('العنوان', fTitle),
            h('div.grid.grid--2',
              C.field('الدرس المرتبط', fLesson),
              C.field('الجودة', fQuality))),
          progress,
          h('div.help',
            'الرفع هنا محاكاة — لا يوجد تخزين بعد. عند ربط Supabase Storage '
            + 'سيُرفع الملف فعليًا ويُصدر له رابط موقّع لا يُقرأ إلا باشتراك فعّال.')),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'رفع', kind: 'primary', onClick: (c) => {
              if (!file) return C.toast('اختر ملفًا أولًا', 'err');
              if (!fTitle.value.trim()) return C.toast('العنوان مطلوب', 'err');

              const id = 'v' + Date.now();
              const mb = Math.round(file.size / 1048576 * 10) / 10;

              // محاكاة تقدّم الرفع
              const bar = h('div.bar', h('i', { style: 'width:0%' }));
              progress.replaceChildren(h('div.mt', h('div.small.mb', 'جارٍ الرفع…'), bar));
              let p = 0;
              const t = setInterval(() => {
                p = Math.min(100, p + 12);
                bar.firstChild.style.width = p + '%';
                if (p < 100) return;
                clearInterval(t);
                Store.upsert('videos', {
                  id, title: fTitle.value.trim(), lesson: fLesson.value || null,
                  seconds: file._seconds || 0, mb, quality: fQuality.value,
                  uploaded: new Date().toISOString().slice(0, 10),
                });
                if (fLesson.value) Store.upsert('lessons', { id: fLesson.value, video: id });
                c(); C.toast('رُفع الفيديو'); draw();
              }, 140);
            } },
        ],
      });
    }

    function edit(v) {
      const fTitle = C.input({ value: v.title });
      const fLesson = C.select([['', '— بلا ربط —'],
        ...Store.lessonPaths().map((l) => [l.id, l.title])], v.lesson || '');

      C.modal({
        title: 'تعديل الفيديو',
        body: h('div', C.field('العنوان', fTitle), C.field('الدرس المرتبط', fLesson)),
        actions: [
          { label: 'إلغاء', onClick: (c) => c() },
          { label: 'حفظ', kind: 'primary', onClick: (c) => {
              // فكّ الربط القديم قبل ربط الجديد، وإلا بقي درسان يشيران لنفس الفيديو
              Store.get().lessons.filter((l) => l.video === v.id)
                .forEach((l) => Store.upsert('lessons', { id: l.id, video: null }));
              Store.upsert('videos', { id: v.id, title: fTitle.value.trim(), lesson: fLesson.value || null });
              if (fLesson.value) Store.upsert('lessons', { id: fLesson.value, video: v.id });
              c(); C.toast('حُفظ'); draw();
            } },
        ],
      });
    }

    draw();
    return page;
  };
})();
