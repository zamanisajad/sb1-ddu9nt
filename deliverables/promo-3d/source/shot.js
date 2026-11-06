const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs');
(async()=>{
  const mode=process.argv[2]||'preview';
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1080,height:1920}});
  p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{if(m.type()==='error')console.log('CERR',m.text())});
  await p.goto('file://'+__dirname+'/video.html'); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(500);
  if(mode==='preview'){
    const ts=(process.argv[3]||'1.2,2.1,3.3,4.3,5.8,7.6,8.5,10.8,13.2,14.8,15.6,17.3,18.6,19.6,27.2,28.4,29.6,30.5,32.5').split(',').map(Number);
    fs.mkdirSync(__dirname+'/pv',{recursive:true});
    for(const t of ts){await p.evaluate(t=>render(t),t);await p.screenshot({path:`${__dirname}/pv/${t}.jpg`,type:'jpeg',quality:70});}
  } else {
    const lang=process.argv[3]||'fa', from=+process.argv[4], to=+process.argv[5], dir=__dirname+'/'+process.argv[6];
    fs.mkdirSync(dir,{recursive:true}); await p.evaluate(l=>setLang(l),lang);
    const FPS=30; let n=0;
    for(let i=Math.round(from*FPS);i<Math.round(to*FPS);i++){await p.evaluate(t=>render(t),i/FPS);await p.screenshot({path:`${dir}/f${String(n++).padStart(4,'0')}.jpg`,type:'jpeg',quality:90});}
    console.log('frames',n);
  }
  await b.close();
})();
