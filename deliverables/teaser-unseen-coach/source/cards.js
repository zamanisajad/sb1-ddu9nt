const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const lines = ["شاگردت فقط یه برنامه می‌بینه…","نمی‌بینه چند شب بیدار موندی…","چند بار یه حرکت رو توضیح دادی…","تا امروز، قوی‌تر از دیروز باشه."];
const css = `@font-face{font-family:T;src:url(CoachTitle.ttf)}@font-face{font-family:B;src:url(CoachBody.ttf)}
*{margin:0}html,body{width:1080px;height:1920px;background:transparent;overflow:hidden}`;
(async()=>{
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1080,height:1920}});
  for (let i=0;i<lines.length;i++){
    require('fs').writeFileSync('page.html',`<html dir="rtl"><head><base href="file://${process.cwd()}/"><style>${css}
      .s{position:absolute;left:80px;right:80px;bottom:430px;text-align:center;font-family:B;font-weight:700;font-size:70px;line-height:1.6;color:#fff;
      text-shadow:0 2px 18px rgba(0,0,0,.85),0 0 4px rgba(0,0,0,.9)}</style></head><body><div class="s">${lines[i]}</div></body></html>`); await p.goto('file://'+process.cwd()+'/page.html',{waitUntil:'load'});
    await p.evaluate(()=>document.fonts.ready);
    await p.screenshot({path:`sub${i+1}.png`,omitBackground:true});
  }
  require('fs').writeFileSync('page.html',`<html dir="rtl"><head><base href="file://${process.cwd()}/"><style>${css}
    body{background:#0f0f10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px}
    img{width:230px}.t{font-family:T;font-size:104px;color:#fff}.l{font-family:B;font-size:52px;color:#d8d2cc}.l b{color:#F47B3B;font-weight:700}
    </style></head><body><img src="logo-mark.png"><div class="t">کمک مربی</div><div class="l">مدیریت کمتر، <b>مربیگری بیشتر</b></div></body></html>`); await p.goto('file://'+process.cwd()+'/page.html',{waitUntil:'load'});
  await p.evaluate(()=>document.fonts.ready);
  await p.screenshot({path:'endcard.png'});
  await b.close();
})();
