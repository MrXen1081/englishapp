const V='ef-v13';
const FILES=['./','index.html','style.css','app.js','manifest.webmanifest','icons/icon.svg','icons/icon-maskable.svg','bg.jpg','data/units.json','data/unit1.json','data/unit2.json','data/unit3.json','data/unit4.json','data/unit5.json','data/unit6.json','data/unit7.json','data/unit8.json','data/unit9.json','data/unit10.json','data/unit11.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
    const net=fetch(e.request).then(r=>{if(r.ok&&new URL(e.request.url).origin===location.origin){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c))}return r}).catch(()=>hit);
    return hit||net;
  }));
});
