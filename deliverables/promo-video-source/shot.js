const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const mode = process.argv[2] || 'preview';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('file://' + __dirname + '/video.html');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  if (mode === 'preview') {
    for (const t of [1.5, 4.5, 8.5, 12, 15.5, 18.5]) {
      await p.evaluate((t) => render(t), t); await p.waitForTimeout(50);
      await p.screenshot({ path: `${__dirname}/pv_${t}.jpg`, type: 'jpeg', quality: 80 });
    }
  } else {
    fs.mkdirSync(__dirname + '/frames', { recursive: true });
    const FPS = 30, N = Math.round(19 * FPS);
    for (let i = 0; i < N; i++) {
      await p.evaluate((t) => render(t), i / FPS);
      await p.screenshot({ path: `${__dirname}/frames/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
    }
    console.log('frames', N);
  }
  await b.close();
})();
