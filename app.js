'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const today=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

/* ---------- storage ---------- */
const KEY='englishfile:v1';
let S=load();
const newProg=()=>({box:{},days:{},total:0,correct:0});
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s){
  if(!s.units){   // migrate: progress saved before units were separated belongs to Unit 1
    s.units={unit1:{box:s.box||{},days:s.days||{},total:s.total||0,correct:s.correct||0}};
    delete s.box;delete s.days;delete s.total;delete s.correct}
  return s}}catch(e){}return{units:{},auto:true,rate:0.9,unit:'unit1'}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
const IR=()=>S.irr||(S.irr={box:{},days:{},total:0,correct:0});   // irregular-verb progress (independent of units)
const P=()=>S.units[S.unit]||(S.units[S.unit]=newProg());   // progress of the selected unit
function record(ok){
  const p=P();p.total++;if(ok)p.correct++;
  const d=p.days[today()]||(p.days[today()]={n:0,c:0});d.n++;if(ok)d.c++;save();
}
function streak(){const days=P().days;let n=0,d=new Date();if(!days[today()])d.setDate(d.getDate()-1);
  while(days[today(d)]){n++;d.setDate(d.getDate()-1)}return n}

/* ---------- text normalisation ---------- */
const FOLD={'ı':'i','İ':'i','ş':'s','ç':'c','ğ':'g','ö':'o','ü':'u','â':'a','î':'i','û':'u'};
function normTr(s){
  return s.replace(/[İI]/g,m=>m==='İ'?'i':'ı').toLowerCase().replace(/[ışçğöüâîû]/g,c=>FOLD[c]||c)
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function normEn(s){return s.replace(/[’‘`]/g,"'").toLowerCase().replace(/\s+([?.!,])/g,'$1').replace(/[.!]+$/,'').replace(/\s+/g,' ').trim()}
const trAnswers=v=>[v.tr,...(v.alt||[])].flatMap(t=>[t,...t.split(/\s*[\/;]\s*/)]).map(normTr).filter(Boolean);

/* ---------- speech ---------- */
let voice=null;
function pickVoice(){
  const vs=speechSynthesis.getVoices();
  voice=vs.find(v=>v.lang==='en-GB')||vs.find(v=>/^en[-_]GB/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;
  const el=$('#voiceInfo');if(el)el.textContent=voice?'Ses: '+voice.name+' ('+voice.lang+')':(('speechSynthesis' in window)?'İngilizce ses bulunamadı.':'Bu tarayıcı seslendirmeyi desteklemiyor.');
}
if('speechSynthesis' in window){pickVoice();speechSynthesis.onvoiceschanged=pickVoice}
function say(t){
  if(!('speechSynthesis' in window))return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(t.replace(/___+/g,'blank').replace(/\.\.\./g,''));
  u.lang=voice?voice.lang:'en-GB';if(voice)u.voice=voice;u.rate=S.rate;speechSynthesis.speak(u);
}
const spk=t=>`<button class="btn spk" data-say="${esc(t)}" aria-label="Dinle">🔊</button>`;
document.addEventListener('click',e=>{const b=e.target.closest('[data-say]');if(b){e.stopPropagation();say(b.dataset.say)}},true);

/* ---------- data ---------- */
let UNITS=[],U=null,tab='cards';
let IRRV=null;
async function loadIrr(){if(IRRV)return IRRV;IRRV=(await (await fetch('data/irregular.json')).json()).verbs;return IRRV}
async function init(){
  loadIrr().then(()=>{if(tab==='progress'&&U)render()}).catch(()=>{});   // preload for the progress card; doesn't block startup
  UNITS=await (await fetch('data/units.json')).json();
  const sel=$('#unitSel');sel.innerHTML=UNITS.map(u=>`<option value="${u.id}">${esc(u.title)}</option>`).join('');
  if(!UNITS.find(u=>u.id===S.unit))S.unit=UNITS[0].id;sel.value=S.unit;
  sel.onchange=async()=>{
    if(typeof slBusy!=='undefined'&&slBusy){sel.value=S.unit;return}   // don't swap words under a running slot spin
    try{await loadUnit(sel.value)}catch(e){sel.value=S.unit;return}   // keep the current unit if the new one can't be loaded
    C=null;Q=null;save();render();scrollTo(0,0)};
  await loadUnit(S.unit);render();
}
async function loadUnit(id){const u=UNITS.find(x=>x.id===id);const d=await (await fetch(u.file)).json();U=d;S.unit=id}
const app=$('#app');
function render(){({cards:cardsHome,quiz:quizHome,grammar:grammarView,verbs:verbsView,write:writeView,slot:slotView,progress:progressView}[tab])()}
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b||(typeof slBusy!=='undefined'&&slBusy))return;tab=b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));window.speechSynthesis?.cancel();IS=null;render();scrollTo(0,0)};
const boxOf=id=>P().box[id]||0;

/* ---------- flashcards ---------- */
let cfg={mode:'write',scope:'all',size:10};
function chips(name,opts,cur){return `<div class="chips">${opts.map(([v,l])=>`<button class="chip ${v==cur?'on':''}" data-chip="${name}" data-v="${v}">${l}</button>`).join('')}</div>`}
function bindChips(c){app.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{c[b.dataset.chip]=isNaN(b.dataset.v)?b.dataset.v:+b.dataset.v;render()})}
function cardsHome(){
  const due=U.vocab.filter(v=>boxOf(v.id)>0&&boxOf(v.id)<3).length;
  app.innerHTML=`<div class="card"><h2>Kelime Kartları</h2><p class="muted">${U.vocab.length} kelime · ${due} tanesi tekrar bekliyor (kutu 1-2)</p>
  <b>Mod</b>${chips('mode',[['write','✍️ Yaz'],['mc','🔘 Çoktan seçmeli'],['flip','🔄 Kartı çevir']],cfg.mode)}
  <b>Kelimeler</b>${chips('scope',[['all','Hepsi'],['weak','Zayıf (kutu 1-2)'],['new','Yeni']],cfg.scope)}
  <b>Oturum</b>${chips('size',[[10,'10'],[20,'20'],[999,'Tümü']],cfg.size)}
  <button class="btn primary" id="go" style="width:100%;margin-top:6px">Başla</button></div>`;
  bindChips(cfg);$('#go').onclick=startCards;
}
let C=null;
function startCards(){
  let pool=U.vocab.slice();
  if(cfg.scope==='weak')pool=pool.filter(v=>boxOf(v.id)>0&&boxOf(v.id)<3);
  if(cfg.scope==='new')pool=pool.filter(v=>!boxOf(v.id));
  if(!pool.length){app.insertAdjacentHTML('afterbegin','<div class="fb bad">Bu kapsamda kelime yok.</div>');return}
  pool=shuffle(pool).sort((a,b)=>boxOf(a.id)-boxOf(b.id)).slice(0,cfg.size);
  C={queue:shuffle(pool),first:{},wrong:{},total:pool.length,done:0,moves:[]};cardStep();
}
function cardStep(){
  if(!C.queue.length)return cardSummary();
  const v=C.queue[0],retry=C.first[v.id]!==undefined;
  const head=`<div class="bar"><i style="width:${C.done/C.total*100}%"></i></div><p class="muted center">${C.done}/${C.total}${retry?' · tekrar':''} · kutu ${boxOf(v.id)||'yeni'}</p>`;
  const word=`<div class="big">${esc(v.en)}</div><div class="center">${spk(v.en)}</div>`;
  if(cfg.mode==='write'){
    app.innerHTML=`<div class="card">${head}${word}<input type="text" id="ans" class="inp" placeholder="Türkçesini yaz" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><div id="fb"></div><button class="btn primary" id="chk" style="width:100%">Kontrol et</button></div>`;
    const inp=$('#ans');inp.focus();let checked=false;
    const go=()=>{ if(checked){cardNext();return}
      const ok=trAnswers(v).includes(normTr(inp.value));
      if(!inp.value.trim())return;checked=true;grade(v,ok);
      $('#fb').innerHTML=`<div class="fb ${ok?'ok':'bad'}">${ok?'Doğru! ✓':'Yanlış. Cevap: '+esc(v.tr)+((v.alt||[]).length?' <small>('+esc(v.alt.join(', '))+')</small>':'')}</div>`;
      inp.disabled=true;$('#chk').textContent='Devam';$('#chk').focus()};
    $('#chk').onclick=go;inp.onkeydown=e=>{if(e.key==='Enter')go()};
  }else if(cfg.mode==='mc'){
    const same=U.vocab.filter(x=>x.cat===v.cat&&x.id!==v.id&&normTr(x.tr)!==normTr(v.tr));
    const rest=U.vocab.filter(x=>x.id!==v.id&&!same.includes(x)&&normTr(x.tr)!==normTr(v.tr));
    const dist=[...shuffle(same),...shuffle(rest)].filter((x,i,a)=>a.findIndex(y=>normTr(y.tr)===normTr(x.tr))===i).slice(0,3);
    const opts=shuffle([v,...dist]);
    app.innerHTML=`<div class="card">${head}${word}<div class="opts two" id="opts">${opts.map(o=>`<button class="opt" data-id="${o.id}">${esc(o.tr)}</button>`).join('')}</div><div id="fb"></div></div>`;
    $('#opts').onclick=e=>{const b=e.target.closest('.opt');if(!b||b.disabled)return;const ok=b.dataset.id===v.id;grade(v,ok);
      app.querySelectorAll('.opt').forEach(x=>{x.disabled=true;if(x.dataset.id===v.id)x.classList.add('ok')});if(!ok)b.classList.add('bad');
      $('#fb').innerHTML=`<button class="btn primary" id="nx" style="width:100%;margin-top:12px">Devam</button>`;$('#nx').onclick=cardNext;$('#nx').focus()};
  }else{
    app.innerHTML=`<div class="card">${head}<div class="flip" id="flip"><div class="flip-in"><div class="face glass">${word}<p class="muted">çevirmek için dokun</p></div><div class="face back glass"><div class="big">${esc(v.tr)}</div>${(v.alt||[]).length?`<p class="muted">${esc(v.alt.join(', '))}</p>`:''}<div class="muted">${esc(v.en)}</div></div></div></div>
    <div class="opts two" id="jd" style="visibility:hidden"><button class="btn" data-k="0">😕 Bilmedim</button><button class="btn primary" data-k="1">😀 Bildim</button></div></div>`;
    $('#flip').onclick=()=>{$('#flip').classList.add('on');$('#jd').style.visibility='visible'};
    $('#jd').onclick=e=>{const b=e.target.closest('button');if(!b)return;grade(v,b.dataset.k==='1');cardNext()};
  }
  if(S.auto)say(v.en);
}
function grade(v,ok){
  C.lastOk=ok;
  if(C.first[v.id]!==undefined)return;
  C.first[v.id]=ok;const old=boxOf(v.id),nb=ok?Math.min(5,old+1):1;P().box[v.id]=nb;C.moves.push({v,old,nb,ok});record(ok);
  if(!ok)C.wrong[v.id]=v;
}
function cardNext(){
  const v=C.queue.shift();
  if(!C.lastOk)C.queue.push(v);   // wrong answers come back at the end of the session until answered correctly
  C.done=C.total-new Set(C.queue.map(x=>x.id)).size;cardStep();
}
function cardSummary(){
  const ok=Object.values(C.first).filter(Boolean).length,n=C.total,w=Object.values(C.wrong);
  app.innerHTML=`<div class="card center"><h2>Oturum bitti 🎉</h2><div class="big">${ok}/${n}</div><p class="muted">İlk denemede doğruluk: %${Math.round(ok/n*100)}</p></div>
  ${w.length?`<div class="card"><h3>Tekrar edilecekler</h3>${w.map(v=>`<div class="ex"><div><b>${esc(v.en)}</b><small>${esc(v.tr)}</small></div>${spk(v.en)}</div>`).join('')}</div>`:''}
  <div class="card"><h3>Kutu hareketleri</h3><p class="muted">${C.moves.map(m=>`${esc(m.v.en)}: ${m.old||'yeni'}→${m.nb}`).join(' · ')}</p></div>
  <button class="btn primary" id="again" style="width:100%">Yeni oturum</button>`;
  $('#again').onclick=cardsHome;C=null;
}

/* ---------- quiz ---------- */
let qcfg={type:'all',size:10},Q=null;
function quizHome(){
  const cnt=t=>U.exercises.filter(e=>t==='all'||e.type===t).length;
  app.innerHTML=`<div class="card"><h2>Quiz</h2><p class="muted">Workbook alıştırmalarından (${U.exercises.length} soru)</p>
  <b>Tür</b>${chips('type',[['all','Karışık ('+cnt('all')+')'],['mc','Çoktan seçmeli ('+cnt('mc')+')'],['fill','Boşluk doldurma ('+cnt('fill')+')'],['order','Sıralama ('+cnt('order')+')']],qcfg.type)}
  <b>Soru sayısı</b>${chips('size',[[10,'10'],[20,'20'],[999,'Tümü']],qcfg.size)}
  <button class="btn primary" id="go" style="width:100%">Başla</button>
  ${U.skipped&&U.skipped.length?`<details style="margin-top:14px"><summary class="muted">Veride atlanan alıştırmalar (${U.skipped.length})</summary><ul class="muted list">${U.skipped.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details>`:''}</div>`;
  bindChips(qcfg);
  $('#go').onclick=()=>{const items=shuffle(U.exercises.filter(e=>qcfg.type==='all'||e.type===qcfg.type)).slice(0,qcfg.size);Q={items,i:0,score:0,wrong:[]};quizStep()};
}
const ordTok=a=>{const m=a.trim().match(/^(.*?)([?.!]*)$/);return m[1].split(/\s+/).filter(Boolean).concat(m[2]?[m[2]]:[])};
const fullText=(e,a)=>e.type==='order'?e.answer:/___+/.test(e.q)?e.q.replace(/\s*\(resim[^)]*\)/,'').replace(/___+/,a):/\.\.\./.test(e.q)?e.q.replace(/^.*?“(.*?)”.*$/,'$1').replace('...',a):e.topic==='word stress'?e.q.replace(/^.*\?\s*/,''):a;
function quizStep(){
  if(Q.i>=Q.items.length)return quizEnd();
  const e=Q.items[Q.i];
  const head=`<div class="bar"><i style="width:${Q.i/Q.items.length*100}%"></i></div><p class="muted center">${Q.i+1}/${Q.items.length} · ${esc(e.topic)}</p>`;
  const done=(ok,given,show)=>{record(ok);if(ok)Q.score++;else Q.wrong.push({e,given,show});
    $('#fb').innerHTML=`<div class="fb ${ok?'ok':'bad'}">${ok?'Doğru! ✓':'Doğru cevap: '+esc(show)}${e.explain?`<br><small>${esc(e.explain)}</small>`:''}</div><div style="display:flex;gap:10px"><button class="btn primary" id="nx" style="flex:1">Devam</button>${spk(fullText(e,show))}</div>`;
    $('#nx').onclick=()=>{Q.i++;quizStep()};$('#nx').focus()};
  if(e.type==='mc'){
    app.innerHTML=`<div class="card">${head}<div class="big" style="font-size:1.4rem">${esc(e.q)}</div><div class="opts ${e.options.length>2?'two':''}" id="opts">${shuffle(e.options).map(o=>`<button class="opt">${esc(o)}</button>`).join('')}</div><div id="fb"></div></div>`;
    $('#opts').onclick=ev=>{const b=ev.target.closest('.opt');if(!b||b.disabled)return;const ok=b.textContent===e.answer;
      app.querySelectorAll('.opt').forEach(x=>{x.disabled=true;if(x.textContent===e.answer)x.classList.add('ok')});if(!ok)b.classList.add('bad');done(ok,b.textContent,e.answer)};
  }else if(e.type==='fill'){
    app.innerHTML=`<div class="card">${head}<div class="big" style="font-size:1.4rem">${esc(e.q)}</div><input type="text" id="ans" class="inp" placeholder="Boşluğu doldur" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><div id="fb"></div><button class="btn primary" id="chk" style="width:100%">Kontrol et</button></div>`;
    const inp=$('#ans');inp.focus();let ck=false;
    const go=()=>{if(ck){$('#nx')&&$('#nx').click();return}if(!inp.value.trim())return;ck=true;
      const ok=e.answer.some(a=>normEn(a)===normEn(inp.value));inp.disabled=true;$('#chk').remove();done(ok,inp.value,e.answer[0])};
    $('#chk').onclick=go;inp.onkeydown=ev=>{if(ev.key==='Enter')go()};
  }else{
    let pool=shuffle(ordTok(e.answer).map((w,i)=>({w,i}))),sel=[];
    const draw=()=>{app.innerHTML=`<div class="card">${head}<p class="muted center">Kelimeleri doğru sıraya diz</p><div class="words" id="sel">${sel.map(x=>`<button class="w" data-i="${x.i}">${esc(x.w)}</button>`).join('')}</div><div class="words" id="pool" style="border-style:solid">${pool.map(x=>`<button class="w" data-i="${x.i}">${esc(x.w)}</button>`).join('')}</div><div id="fb"></div><div id="ctl" style="display:flex;gap:10px"><button class="btn" id="clr">Temizle</button><button class="btn primary" id="chk" style="flex:1" ${pool.length||!sel.length?'disabled':''}>Kontrol et</button></div></div>`;
      $('#pool').onclick=ev=>{const b=ev.target.closest('.w');if(!b)return;const x=pool.find(p=>p.i==b.dataset.i);pool=pool.filter(p=>p!==x);sel.push(x);draw()};
      $('#sel').onclick=ev=>{const b=ev.target.closest('.w');if(!b)return;const x=sel.find(p=>p.i==b.dataset.i);sel=sel.filter(p=>p!==x);pool.push(x);draw()};
      $('#clr').onclick=()=>{pool=pool.concat(sel);sel=[];draw()};
      $('#chk').onclick=()=>{if(!sel.length||pool.length){$('#fb').innerHTML='<div class="fb bad">Önce kelimeleri diz</div>';return}const g=sel.map(x=>x.w).join(' ').replace(/ ([?.!])$/,'$1');const ok=normEn(g)===normEn(e.answer);app.querySelectorAll('.w').forEach(x=>x.disabled=true);$('#ctl').remove();done(ok,g,e.answer)};
    };draw();
  }
}
function quizEnd(){
  const n=Q.items.length;
  app.innerHTML=`<div class="card center"><h2>Quiz bitti</h2><div class="big">${Q.score}/${n}</div><p class="muted">%${Math.round(Q.score/n*100)} doğru</p></div>
  ${Q.wrong.length?`<div class="card"><h3>Yanlışların</h3>${Q.wrong.map(w=>`<div class="ex"><div>${esc(w.e.q||'Sırala: '+w.e.words.join(' / '))}<small>Senin cevabın: ${esc(w.given)} → <b>${esc(w.show)}</b></small></div>${spk(fullText(w.e,w.show))}</div>`).join('')}</div>`:'<div class="card center">Hepsi doğru! 🌟</div>'}
  <button class="btn primary" id="again" style="width:100%">Yeni quiz</button>`;
  $('#again').onclick=quizHome;
}

/* ---------- grammar ---------- */
function grammarView(){
  app.innerHTML=U.grammar.map((g,i)=>`<details class="card" ${i===0?'open':''}><summary>${esc(g.title)}</summary><div class="in"><p>${g.tr}</p>
  ${g.table?`<table><tr>${g.table.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>${g.table.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`:''}
  ${g.examples.map(([en,tr])=>`<div class="ex"><div>${esc(en)}<small>${esc(tr)}</small></div>${spk(en)}</div>`).join('')}</div></details>`).join('');
}


/* ---------- irregular verbs ---------- */
const irrBox=id=>IR().box[id]||0;
const GROUPS=[['AAA','Aynı biçimli (V1 = V2 = V3)','cut – cut – cut'],['ABB','V2 = V3','buy – bought – bought'],['ABC','Üç biçim farklı','go – went – gone'],['ABA','V1 = V3','come – came – come']];
let icfg={view:'az',q:'',mode:'list',given:'v1',scope:'all',size:10},IS=null;
const forms=(v,k)=>[].concat(v[k]);   // always an array (v1 is a plain string)
const showForm=a=>a.join(' / ');
const irrRow=v=>`<div class="ex"><div><b>${esc(v.v1)}</b> – ${esc(showForm(v.v2))} – ${esc(showForm(v.v3))}<small>${esc(v.tr)}${v.v1==='read'?' · read /riːd/, read /red/, read /red/':''}</small></div><span class="muted">${irrBox(v.id)?'K'+irrBox(v.id):''}</span>${spk([v.v1,showForm(v.v2).split(' / ')[0],showForm(v.v3).split(' / ')[0]].join(', '))}</div>`;
async function verbsView(){
  try{await loadIrr()}catch(e){app.innerHTML='<div class="card"><div class="fb bad">Fiil verisi yüklenemedi. Bağlantını kontrol et.</div></div>';return}
  if(tab!=='verbs')return;
  if(IS)return irrStep();
  const tabs=chips('mode',[['list','📖 Liste'],['study','✍️ Çalış']],icfg.mode);
  if(icfg.mode==='study'){
    const weak=IRRV.filter(v=>irrBox(v.id)>0&&irrBox(v.id)<3).length;
    app.innerHTML=`<div class="card"><h2>Düzensiz Fiiller</h2>${tabs}<p class="muted">${IRRV.length} fiil · ${weak} tanesi tekrar bekliyor (kutu 1-2)</p>
    <b>Verilen</b>${chips('given',[['v1','V1 + Türkçe → V2, V3'],['tr','Türkçe → V1, V2, V3'],['mix','Karışık (V1/V2/V3)']],icfg.given)}
    <b>Fiiller</b>${chips('scope',[['all','Hepsi'],['same','Aynı biçimli'],['weak','Zayıf (kutu 1-2)'],['new','Yeni']],icfg.scope)}
    <b>Oturum</b>${chips('size',[[10,'10'],[20,'20'],[999,'Tümü']],icfg.size)}
    <button class="btn primary" id="go" style="width:100%;margin-top:6px">Başla</button></div>`;
    bindChips(icfg);$('#go').onclick=startIrr;return;
  }
  const q=normTr(icfg.q),match=v=>!q||normTr([v.v1,...v.v2,...v.v3,v.tr].join(' ')).includes(q);
  const list=IRRV.filter(match);
  let body;
  if(!list.length)body='<p class="muted center">Sonuç yok.</p>';
  else if(icfg.view==='az')body=`<div class="card">${list.map(irrRow).join('')}</div>`;
  else body=GROUPS.map(([t,name,ex])=>{const g=list.filter(v=>v.type===t);return g.length?`<details class="card" open><summary>${name} <span class="muted">${g.length} · ${ex}</span></summary><div class="in">${g.map(irrRow).join('')}</div></details>`:''}).join('');
  app.innerHTML=`<div class="card"><h2>Düzensiz Fiiller</h2>${tabs}
    <input type="text" id="irq" class="inp" style="margin:0 0 12px;text-align:left" placeholder="Ara: fiil biçimi veya Türkçe" value="${esc(icfg.q)}" autocomplete="off" autocapitalize="off" spellcheck="false">
    ${chips('view',[['az','A–Z'],['grp','Gruplu']],icfg.view)}<p class="muted" style="margin:0">${list.length}/${IRRV.length} fiil · 🔊 V1, V2, V3 sırayla okur</p></div>${body}`;
  bindChips(icfg);
  const inp=$('#irq');inp.oninput=()=>{icfg.q=inp.value;const pos=inp.selectionStart;verbsView().then(()=>{const n=$('#irq');if(n){n.focus();n.setSelectionRange(pos,pos)}})};
}
function startIrr(){
  let pool=IRRV.slice();
  if(icfg.scope==='same')pool=pool.filter(v=>v.type==='AAA');
  if(icfg.scope==='weak')pool=pool.filter(v=>irrBox(v.id)>0&&irrBox(v.id)<3);
  if(icfg.scope==='new')pool=pool.filter(v=>!irrBox(v.id));
  if(!pool.length){app.insertAdjacentHTML('afterbegin','<div class="fb bad">Bu kapsamda fiil yok.</div>');return}
  pool=shuffle(pool).sort((a,b)=>irrBox(a.id)-irrBox(b.id)).slice(0,icfg.size);
  IS={queue:shuffle(pool),first:{},wrong:{},total:pool.length,done:0,moves:[]};irrStep();
}
const irrGiven=v=>{const k=icfg.given==='tr'?'tr':icfg.given==='v1'?'v1':['v1','v2','v3','tr'][Math.random()*4|0];
  const f=k==='tr'?v.tr:forms(v,k)[Math.random()*forms(v,k).length|0];return{k,f}};
function irrStep(){
  if(!IS.queue.length)return irrSummary();
  const v=IS.queue[0],retry=IS.first[v.id]!==undefined;
  if(!IS.cur||IS.cur.v!==v){IS.cur={v,g:irrGiven(v)}}   // new prompt each time it comes up
  const g=IS.cur.g,want=icfg.given==='tr'?['v1','v2','v3']:['v1','v2','v3'].filter(k=>k!==g.k);
  const lab={v1:'V1',v2:'V2 (past simple)',v3:'V3 (past participle)'};
  const head=`<div class="bar"><i style="width:${IS.done/IS.total*100}%"></i></div><p class="muted center">${IS.done}/${IS.total}${retry?' · tekrar':''} · kutu ${irrBox(v.id)||'yeni'}</p>`;
  const given=g.k==='tr'?`<div class="big">${esc(v.tr)}</div>`:`<div class="big">${esc(g.f)}</div><p class="muted center">${g.k==='v1'?'V1 · '+esc(v.tr):g.k.toUpperCase()}</p><div class="center">${spk(g.f)}</div>`;
  app.innerHTML=`<div class="card">${head}${given}${want.map(k=>`<label class="muted">${lab[k]}</label><input type="text" class="inp" data-k="${k}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">`).join('')}<div id="fb"></div><button class="btn primary" id="chk" style="width:100%">Kontrol et</button></div>`;
  const ins=[...app.querySelectorAll('input.inp')];ins[0].focus();let checked=false;
  const go=()=>{
    if(checked){irrNext();return}
    if(ins.some(i=>!i.value.trim()))return;checked=true;
    let all=true;
    ins.forEach(i=>{const ok=forms(v,i.dataset.k).includes(i.value.trim().toLowerCase().replace(/’/g,"'"));if(!ok)all=false;
      i.disabled=true;i.style.borderColor=ok?'var(--ok)':'var(--bad)'});
    irrGrade(v,all);
    $('#fb').innerHTML=`<div class="fb ${all?'ok':'bad'}">${all?'Doğru! ✓':'Yanlış.'} ${esc(v.v1)} – ${esc(showForm(v.v2))} – ${esc(showForm(v.v3))}</div>`;
    $('#chk').textContent='Devam';$('#chk').focus();IS.lastOk=all;
    say([v.v1,v.v2[0],v.v3[0]].join(', '))};
  $('#chk').onclick=go;
  ins.forEach((inp,n)=>inp.onkeydown=e=>{if(e.key==='Enter'){if(n<ins.length-1&&!inp.disabled&&!ins[n+1].value)ins[n+1].focus();else go()}});
}
function irrGrade(v,ok){
  if(IS.first[v.id]!==undefined)return;
  IS.first[v.id]=ok;const old=irrBox(v.id),nb=ok?Math.min(5,old+1):1,p=IR();p.box[v.id]=nb;IS.moves.push({v,old,nb});
  p.total++;if(ok)p.correct++;const d=p.days[today()]||(p.days[today()]={n:0,c:0});d.n++;if(ok)d.c++;
  if(!ok)IS.wrong[v.id]=v;save();
}
function irrNext(){
  const v=IS.queue.shift();
  if(!IS.lastOk)IS.queue.push(v);   // wrong ones return at the end of the session until answered correctly
  IS.cur=null;IS.done=IS.total-new Set(IS.queue.map(x=>x.id)).size;irrStep();
}
function irrSummary(){
  const ok=Object.values(IS.first).filter(Boolean).length,n=IS.total,w=Object.values(IS.wrong);
  app.innerHTML=`<div class="card center"><h2>Oturum bitti 🎉</h2><div class="big">${ok}/${n}</div><p class="muted">İlk denemede doğruluk: %${Math.round(ok/n*100)}</p></div>
  ${w.length?`<div class="card"><h3>Tekrar edilecekler</h3>${w.map(irrRow).join('')}</div>`:''}
  <div class="card"><h3>Kutu hareketleri</h3><p class="muted">${IS.moves.map(m=>`${esc(m.v.v1)}: ${m.old||'yeni'}→${m.nb}`).join(' · ')}</p></div>
  <button class="btn primary" id="again" style="width:100%">Yeni oturum</button>`;
  $('#again').onclick=()=>{IS=null;render()};IS=null;
}
function irrProgress(){
  if(!IRRV)return '';
  const p=IR(),seen=IRRV.filter(v=>irrBox(v.id)>0).length,acc=p.total?Math.round(p.correct/p.total*100):0;
  const dist=[0,1,2,3,4,5].map(b=>IRRV.filter(v=>irrBox(v.id)===b).length),mx=Math.max(1,...dist);
  return `<div class="card"><h3>Düzensiz fiiller</h3><p class="muted">${seen}/${IRRV.length} çalışıldı · %${acc} doğruluk · ${dist[5]} öğrenildi (kutu 5)</p>
  <div class="cols">${dist.map((n,b)=>`<div class="col">${n}<div class="b" style="height:${n/mx*100}px"></div>${b?'Kutu '+b:'Yeni'}</div>`).join('')}</div></div>`;
}

/* ---------- writing ---------- */
let WRT=null,wrTask=0,wrRes=null;   // WRT: data/writing.json, wrTask: selected task index, wrRes: last check result
const WR=()=>S.wr||(S.wr=[]);        // history: [{u,t,text,ts,wc,used,n,g}]
const WD=()=>S.wd||(S.wd={});        // unsaved drafts by task id
const wrNorm=t=>t.replace(/[’‘`]/g,"'");
const wrWords=t=>wrNorm(t).match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g)||[];
const reEsc=w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
function wrCheck(k,text){
  const t=wrNorm(text),wc=wrWords(t).length;
  const used=k.words.filter(w=>new RegExp('(^|[^a-z])'+reEsc(w)+'(s|es|ed|d|ing)?(?![a-z])','i').test(t));
  let m=null;try{m=t.match(new RegExp(k.grammar.re,'i'))}catch(e){}
  return{wc,used,g:!!m,snip:m&&m[0].trim()||''};
}
async function writeView(){
  if(!WRT){
    app.innerHTML='<div class="card center muted">Yükleniyor…</div>';
    try{WRT=await (await fetch('data/writing.json')).json()}catch(e){app.innerHTML='<div class="fb bad">Yazma görevleri yüklenemedi.</div>';return}
    if(tab!=='write')return;
  }
  const tasks=WRT[S.unit]||[];if(!tasks.length){app.innerHTML='<div class="card muted">Bu ünite için görev yok.</div>';return}
  if(wrTask>=tasks.length)wrTask=0;
  const k=tasks[wrTask],hist=WR().filter(h=>h.u===S.unit).sort((a,b)=>b.ts-a.ts),doneIds=new Set(hist.map(h=>h.t));
  const draft=WD()[k.id]||'';
  app.innerHTML=`<div class="card"><h2>Yazma</h2><p class="muted">${doneIds.size}/${tasks.length} görev yazıldı · ${hist.length} yazı kaydedildi</p>
  <div class="chips">${tasks.map((t,i)=>`<button class="chip ${i===wrTask?'on':''}" data-wt="${i}">${i+1}. ${esc(t.title)}${doneIds.has(t.id)?' ✓':''}</button>`).join('')}</div>
  <p>${esc(k.prompt)}</p>
  <p class="muted">Önerilen kelimeler:</p><div class="tags">${k.words.map(w=>`<span class="tag">${esc(w)}</span>`).join('')}</div>
  <p class="muted">Hedef kalıp: <b>${esc(k.grammar.label)}</b> · En az <b>${k.min}</b> kelime</p>
  <textarea id="wtxt" class="inp txt" rows="7" placeholder="İngilizce yaz…" autocomplete="off" autocapitalize="sentences" spellcheck="false">${esc(draft)}</textarea>
  <p class="muted" id="wcnt"></p>
  <button class="btn primary" id="wchk" style="width:100%">Kontrol et</button><div id="wres"></div></div>
  ${hist.length?`<div class="card"><h3>Geçmiş yazılar</h3>${hist.map(h=>{const tk=tasks.find(x=>x.id===h.t);return `<details class="wh"><summary>${esc(tk?tk.title:h.t)} <small class="muted">${new Date(h.ts).toLocaleDateString('tr-TR')} · ${h.wc} kelime</small></summary><div class="in"><p class="wtext">${esc(h.text)}</p><p class="muted">Önerilen kelime: ${h.used}/${h.n} · Kalıp: ${h.g?'✓':'✗'}</p><button class="btn" data-wdel="${h.ts}">Sil</button></div></details>`}).join('')}</div>`:''}`;
  const ta=$('#wtxt'),cnt=()=>{$('#wcnt').textContent=wrWords(ta.value).length+' kelime'};cnt();
  ta.oninput=()=>{WD()[k.id]=ta.value;save();cnt()};
  app.querySelectorAll('[data-wt]').forEach(b=>b.onclick=()=>{wrTask=+b.dataset.wt;wrRes=null;render()});
  app.querySelectorAll('[data-wdel]').forEach(b=>b.onclick=()=>{if(confirm('Bu yazı silinsin mi?')){S.wr=WR().filter(h=>String(h.ts)!==b.dataset.wdel);save();render()}});
  const show=r=>{
    const row=(ok,t)=>`<div class="fb ${ok?'ok':'bad'}">${ok?'✓':'✗'} ${t}</div>`;
    $('#wres').innerHTML=row(r.wc>=k.min,`Kelime sayısı: <b>${r.wc}</b> / ${k.min}`)
      +row(r.used.length>0,`Önerilen kelimeler: <b>${r.used.length}/${k.words.length}</b>${r.used.length?' — '+r.used.map(esc).join(', '):''}`)
      +row(r.g,`Hedef kalıp (${esc(k.grammar.label)}): ${r.g?(r.snip?'bulundu: “'+esc(r.snip)+'”':'bulundu'):'bulunamadı'}`)
      +`<div class="card sample"><h3>Örnek cevap</h3><p>${esc(k.sample)}</p>${spk(k.sample)}</div>`;
  };
  if(wrRes&&wrRes.id===k.id)show(wrRes);
  $('#wchk').onclick=()=>{
    const text=ta.value.trim();if(!text){$('#wres').innerHTML='<div class="fb bad">Önce bir şeyler yaz.</div>';return}
    const r=wrCheck(k,text);wrRes={id:k.id,...r};
    WR().push({u:S.unit,t:k.id,text,ts:Date.now(),wc:r.wc,used:r.used.length,n:k.words.length,g:r.g});
    save();
    render();$('#wres').scrollIntoView({behavior:'smooth',block:'nearest'});
  };
}
function writeProgress(){
  const all=WR(),n=new Set(all.map(h=>h.u+'/'+h.t)).size,u=new Set(all.filter(h=>h.u===S.unit).map(h=>h.t)).size,tot=WRT&&WRT[S.unit]?WRT[S.unit].length:4;
  return `<div class="card"><h3>Yazma</h3><p class="muted">${u}/${tot} görev bu ünitede yazıldı · toplam ${n} görev (${all.length} yazı)</p></div>`;
}

/* ---------- progress ---------- */
function progressView(){
  const p=P(),seen=U.vocab.filter(v=>boxOf(v.id)>0).length,acc=p.total?Math.round(p.correct/p.total*100):0;
  const dist=[0,1,2,3,4,5].map(b=>U.vocab.filter(v=>boxOf(v.id)===b).length),mx=Math.max(1,...dist);
  const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const r=p.days[today(d)]||{n:0,c:0};return{l:['Pz','Pt','Sa','Ça','Pe','Cu','Ct'][d.getDay()],...r}}),dm=Math.max(1,...days.map(d=>d.n));
  app.innerHTML=`<div class="stats"><div class="card stat"><b>${seen}/${U.vocab.length}</b>çalışılan kelime</div><div class="card stat"><b>%${acc}</b>doğruluk</div><div class="card stat"><b>${streak()} 🔥</b>gün serisi</div><div class="card stat"><b>${dist[5]}</b>öğrenilen (kutu 5)</div></div>
  <div class="card"><h3>Leitner kutuları</h3><div class="cols">${dist.map((n,b)=>`<div class="col">${n}<div class="b" style="height:${n/mx*100}px"></div>${b?'Kutu '+b:'Yeni'}</div>`).join('')}</div></div>
  ${irrProgress()}
  ${writeProgress()}
  <div class="card"><h3>Son 7 gün</h3><div class="cols">${days.map(d=>`<div class="col" title="${d.c}/${d.n} doğru">${d.n}<div class="b" style="height:${d.n/dm*100}px"></div>${d.l}</div>`).join('')}</div></div>`;
}

/* ---------- settings ---------- */
const dlg=$('#settings');
$('#setBtn').onclick=()=>{$('#autoSpeak').checked=S.auto;$('#rate').value=S.rate;pickVoice();dlg.showModal()};
$('#closeSet').onclick=()=>dlg.close();
$('#autoSpeak').onchange=e=>{S.auto=e.target.checked;save()};
$('#rate').oninput=e=>{S.rate=+e.target.value;save()};
$('#resetBtn').onclick=()=>{if(confirm('Tüm ilerleme silinsin mi?')){const {auto,rate,unit,wr,wd}=S;S={units:{},auto,rate,unit,wr,wd};IS=null;save();dlg.close();render()}};

const ioMsg=(t,bad)=>{const m=$('#ioMsg');m.textContent=t;m.style.color=bad?'#f87171':''};
$('#expBtn').onclick=()=>{
  const blob=new Blob([JSON.stringify({app:'englishfile',version:1,exported:new Date().toISOString(),data:S},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ingilizce-ilerleme-'+today()+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);ioMsg('İlerleme indirildi.');
};
$('#impBtn').onclick=()=>{ioMsg('');$('#impFile').click()};
$('#impFile').onchange=e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const r=new FileReader();
  r.onerror=()=>ioMsg('Dosya okunamadı.',1);
  r.onload=()=>{
    let d;
    try{d=JSON.parse(r.result);if(d&&d.app==='englishfile'&&d.data)d=d.data}catch(_){d=null}
    if(!d||typeof d!=='object'||Array.isArray(d)||!d.units||typeof d.units!=='object'||Array.isArray(d.units)){
      ioMsg('Geçersiz dosya: bu uygulamanın ilerleme yedeği değil.',1);return}
    if(!confirm('Mevcut ilerleme silinecek ve bu dosyadaki veriyle değiştirilecek. Devam edilsin mi?'))return;
    S=d;if(typeof S.auto!=='boolean')S.auto=true;if(typeof S.rate!=='number')S.rate=0.9;if(!S.unit)S.unit='unit1';
    IS=null;save();$('#autoSpeak').checked=S.auto;$('#rate').value=S.rate;ioMsg('İlerleme yüklendi.');render();
  };
  r.readAsText(f);
};

if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
init();
