const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs');
(async()=>{
  const mode=process.argv[2]||'preview';
  const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:1080,height:1920}});
  p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('C',m.text().slice(0,200))});
  await p.goto('http://localhost:8765/scene.html'); await p.waitForFunction(()=>window.ready===true,null,{timeout:120000}); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(300);
  if(mode==='preview'){
    const ts=(process.argv[3]||'0,2,4,6,7.8,9.5').split(',').map(Number); fs.mkdirSync(__dirname+'/pv',{recursive:true});
    for(const t of ts){const s=Date.now();await p.evaluate(t=>render(t),t);await p.screenshot({path:`${__dirname}/pv/${t}.jpg`,type:'jpeg',quality:80});console.log(t,Date.now()-s,'ms');}
  } else {
    const lang=process.argv[3], from=+process.argv[4], to=+process.argv[5], dir=__dirname+'/'+process.argv[6]; fs.mkdirSync(dir,{recursive:true});
    await p.evaluate(l=>setLang(l),lang); const FPS=30; let n=0;
    for(let i=Math.round(from*FPS);i<Math.round(to*FPS);i++){await p.evaluate(t=>render(t),i/FPS);await p.screenshot({path:`${dir}/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});n++;}
    console.log('frames',n);
  }
  await b.close();
})();
