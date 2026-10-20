// Make a 1200×675 cover image (title graphic) for an article.
// Usage: node scripts/make_cover.js articles/<file>.md   → writes articles/<file>.cover.png
// It is a plain title card, never a mock-up of an app screen.
const fs = require("fs");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const src = process.argv[2];
const raw = fs.readFileSync(src, "utf8");
const fm = raw.split("---")[1];
const field = (k) => ((fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1] || "").trim().replace(/^["']|["']$/g, "");
const title = field("title");
const [main, sub] = title.split("؛").map((s) => s.trim());
const fontDir = path.join(__dirname, "assets", "fonts");
const font = (w) => "data:font/woff2;base64," + fs.readFileSync(path.join(fontDir, `vazirmatn-arabic-${w}-normal.woff2`)).toString("base64");
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:V;font-weight:400;src:url(${font(400)})}
@font-face{font-family:V;font-weight:800;src:url(${font(800)})}
*{margin:0;box-sizing:border-box}
html,body{width:1200px;height:675px;overflow:hidden}
body{font-family:V,Arial,sans-serif;background:#16181d;color:#fff}
.stage{position:fixed;inset:0;overflow:hidden}
.glow{position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,#c8102e55,transparent 65%);top:-260px;left:-200px}
.bar{position:absolute;right:80px;top:150px;width:10px;height:300px;background:#c8102e;border-radius:6px}
.t{position:absolute;right:120px;left:90px;top:140px}
h1{font-weight:800;font-size:72px;line-height:1.45}
h2{font-weight:400;font-size:40px;color:#d9dbe1;margin-top:18px}
.site{position:absolute;left:90px;bottom:60px;font-size:28px;color:#9aa0ab;direction:ltr}
</style></head><body><div class="stage"><div class="glow"></div><div class="bar"></div>
<div class="t"><h1>${esc(main)}</h1>${sub ? `<h2>${esc(sub)}</h2>` : ""}</div>
<div class="site">masports.ir</div></div></body></html>`;

(async () => {
  const out = src.replace(/\.md$/, ".cover.png");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 675 } });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out });
  await b.close();
  console.log(out);
})();
