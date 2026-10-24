// زیرنویس‌ها و کارت‌های ریلز «۵۰ ایده برای جذب نوجوان‌ها» (۱۰۸۰×۱۹۲۰)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const subs = [
  'مربی‌ها! جمعهٔ همین هفته، <b>۸ آبان</b>، روز نوجوانه',
  'و چهارشنبهٔ بعدش، <b>۱۳ آبان</b>، روز دانش‌آموز',
  'دو تا فرصت خیلی خوب که <b>بین نوجوون‌ها دیده بشی</b>',
  'و فقط <b>تا جمعه</b> وقت داری آماده‌ش کنی.',
  'نوجوونی که از تمرین با تو <b>لذت ببره</b> و پیشرفتش رو ببینه،',
  'و تو باشگاه <b>رفیق پیدا کنه</b>، احتمالاً سال‌ها می‌مونه.',
  'اگه تجربه‌ش ارزش استوری داشته باشه، <b>خودش تو رو به دوستاش معرفی می‌کنه.</b>',
  'پس به‌جای یه استوری تبریک، <b>یه برنامهٔ واقعی بچین:</b>',
  'یه چالش گروهی، یه مسابقهٔ دوستانه، یه جلسهٔ رکوردگیری',
  'لازم نیست خرج زیادی کنی؛ فقط <b>امن باشه</b> و با اجازهٔ خانواده‌ها.',
  '<b>۵۰ تا ایده</b> با راهنمای قدم‌به‌قدم اجرا آماده کردم.',
  'کلمهٔ <b>«نوجوان»</b> رو کامنت کن تا لینکش رو برات بفرستم.',
];
const base = `<base href="file://${__dirname}/"><style>@font-face{font-family:T;src:url(CoachTitle.ttf)}@font-face{font-family:B;src:url(CoachBody.ttf)}
*{margin:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;background:transparent}</style>`;
const page = (css, body) => `<!doctype html><html dir="rtl"><head><meta charset="utf-8">${base}<style>${css}</style></head><body>${body}</body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const shot = async (html, out, transparent = true) => {
    fs.writeFileSync(__dirname + '/page.html', html);
    await p.goto('file://' + __dirname + '/page.html', { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: __dirname + '/' + out, omitBackground: transparent });
  };
  const subCss = `.s{position:absolute;left:70px;right:70px;bottom:400px;text-align:center;font-family:B;font-weight:700;font-size:66px;line-height:1.6;color:#fff;
    text-shadow:0 2px 18px rgba(0,0,0,.9),0 0 4px rgba(0,0,0,.9)} .s b{color:#FFB37E} .s.bg{background:rgba(20,18,17,.86);border-radius:44px;padding:26px 30px;text-shadow:none}`;
  for (let i = 0; i < subs.length; i++) await shot(page(subCss, `<div class="s bg">${subs[i]}</div>`), `sub${i + 1}.png`);

  // قلاب: دو تاریخ
  const hookCss = `.wrap{position:absolute;top:330px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:34px}
    .pill{display:flex;align-items:center;gap:26px;background:rgba(255,255,255,.95);border-radius:999px;padding:22px 52px 22px 26px;box-shadow:0 30px 60px -20px rgba(0,0,0,.45)}
    .d{font-family:T;font-size:84px;color:#fff;background:#F47B3B;border-radius:999px;padding:4px 34px}
    .t{font-family:T;font-size:68px;color:#1F1A17} .hide{visibility:hidden}`;
  const pill = (d, t, hide) => `<div class="pill ${hide ? 'hide' : ''}"><span class="d">${d}</span><span class="t">${t}</span></div>`;
  await shot(page(hookCss, `<div class="wrap">${pill('۸ آبان', 'روز نوجوان')}${pill('۱۳ آبان', 'روز دانش‌آموز', true)}</div>`), 'hook1.png');
  await shot(page(hookCss, `<div class="wrap">${pill('۸ آبان', 'روز نوجوان')}${pill('۱۳ آبان', 'روز دانش‌آموز')}</div>`), 'hook2.png');

  // کارت فایل ۵۰ ایده (تصویر واقعی صفحه‌های PDF)
  await shot(page(`body{background:radial-gradient(90% 60% at 85% 0%,#FDDCC4 0%,rgba(253,220,196,0) 60%),radial-gradient(80% 50% at 0% 100%,#FCE3D2 0%,rgba(252,227,210,0) 60%),#F6F1EC}
    .h{position:absolute;top:150px;left:0;right:0;text-align:center;font-family:T;font-size:96px;color:#1F1A17}.h b{color:#F47B3B;font-weight:normal}
    .p{position:absolute;top:170px;font-family:B;font-size:44px;color:#4A423D;left:0;right:0;text-align:center;margin-top:150px}
    img{position:absolute;width:560px;border-radius:24px;box-shadow:0 60px 90px -30px rgba(140,63,25,.55)}
    .a{left:120px;top:520px;transform:rotate(-6deg)}.c{right:110px;top:470px;transform:rotate(5deg)}`,
    `<div class="h"><b>۵۰ ایده</b> + راهنمای اجرا</div><div class="p">مربی تک‌نفره · چند مربی · باشگاه · مدرسه · آنلاین</div>
     <img class="a" src="inner-09.png"><img class="c" src="cover-01.png">`), 'pdfcard.png', false);

  // کارت پایانی
  await shot(page(`body{background:#141211;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px}
    .k{font-family:B;font-size:58px;color:#d8d2cc}.w{font-family:T;font-size:150px;color:#fff;background:#F47B3B;border-radius:40px;padding:10px 70px;box-shadow:0 0 80px rgba(244,123,59,.55)}
    .arr{width:0;height:0;border-left:44px solid transparent;border-right:44px solid transparent;border-top:56px solid #F47B3B;margin-top:-6px}
    .sub{font-family:B;font-size:46px;color:#d8d2cc}.logo{display:flex;align-items:center;gap:22px;margin-top:90px}.logo img{width:110px}
    .logo div{font-family:T;font-size:70px;color:#fff}.tag{font-family:B;font-size:40px;color:#a9a19b}.tag b{color:#F47B3B}`,
    `<div class="k">کلمهٔ</div><div class="w">نوجوان</div><div class="k">رو کامنت کن</div><div class="arr"></div>
     <div class="sub">تا لینک «۵۰ ایده برای جذب نوجوان‌ها» رو برات بفرستم</div>
     <div class="logo"><img src="logo-mark.png"><div>کمک مربی</div></div><div class="tag">مدیریت کمتر، <b>مربیگری بیشتر</b></div>`), 'endcard.png', false);
  await b.close();
})();
