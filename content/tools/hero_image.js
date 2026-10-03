// Render a clean MA Sport branded hero image (1200x630 PNG) from a title.
// Usage: node content/tools/hero_image.js "<Persian title>" "<short label>" out.png
const { chromium } = require('playwright');

const [title, label = 'MA Sport', out = 'hero.png'] = process.argv.slice(2);
if (!title) { console.error('usage: hero_image.js "<title>" "<label>" out.png'); process.exit(1); }

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const html = `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden;background:#fff}
  .card{position:fixed;top:0;left:0;width:1200px;height:630px;overflow:hidden;font-family:Vazirmatn,Tahoma,'DejaVu Sans',sans-serif;
       display:flex;flex-direction:column;justify-content:space-between;padding:72px 96px 72px 84px}
  .bar{position:absolute;top:0;bottom:0;left:0;width:22px;background:#6B002A}
  .blob{position:absolute;left:-160px;bottom:-200px;width:520px;height:520px;border-radius:50%;background:#F5BED3;opacity:.55}
  .label{color:#940000;font-weight:800;font-size:26px;letter-spacing:.5px;position:relative}
  h1{color:#0f1c2f;font-weight:800;font-size:64px;line-height:1.35;max-width:980px;position:relative}
  .brand{color:#6a0029;font-size:24px;position:relative}
</style></head><body>
<div class="card"><div class="bar"></div><div class="blob"></div>
<div class="label">${esc(label)}</div>
<h1>${esc(title)}</h1>
<div class="brand">masports.ir — مدیریت کمتر، مربیگری بیشتر</div></div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: 'networkidle' }).catch(() => {});
  await page.screenshot({ path: out });
  await browser.close();
  console.log(out);
})();
