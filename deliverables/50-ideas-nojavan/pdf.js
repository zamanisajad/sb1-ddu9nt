// جلد و متن جدا چاپ می‌شوند و بعد پشت هم چسبانده می‌شوند (join.py)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + __dirname + '/50-ideas-nojavan.html', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: __dirname + '/_body.pdf', preferCSSPageSize: true, printBackground: true });
  await p.evaluate(() => document.documentElement.classList.add('cv'));
  await p.pdf({ path: __dirname + '/_cover.pdf', preferCSSPageSize: true, printBackground: true, pageRanges: '1' });
  await b.close();
  require('child_process').execFileSync('python3', [__dirname + '/join.py'], { cwd: __dirname, stdio: 'inherit' });
})();
