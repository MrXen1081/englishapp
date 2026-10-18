'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const today=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

/* ---------- storage ---------- */
const KEY='englishfile:v1';
let S=load();
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s)return s}catch(e){}return{box:{},days:{},auto:true,rate:0.9,unit:'unit1',total:0,correct:0}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function record(ok){
  S.total++;if(ok)S.correct++;
  const d=S.days[today()]||(S.days[today()]={n:0,c:0});d.n++;if(ok)d.c++;save();
}
function streak(){let n=0,d=new Date();if(!S.days[today()])d.setDate(d.getDate()-1);
  while(S.days[today(d)]){n++;d.setDate(d.getDate()-1)}return n}

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
async function init(){
  UNITS=await (await fetch('data/units.json')).json();
  const sel=$('#unitSel');sel.innerHTML=UNITS.map(u=>`<option value="${u.id}">${esc(u.title)}</option>`).join('');
  if(!UNITS.find(u=>u.id===S.unit))S.unit=UNITS[0].id;sel.value=S.unit;
  sel.onchange=()=>{S.unit=sel.value;save();loadUnit().then(render)};
  await loadUnit();render();
}
async function loadUnit(){const u=UNITS.find(x=>x.id===S.unit);U=await (await fetch(u.file)).json()}
const app=$('#app');
function render(){({cards:cardsHome,quiz:quizHome,grammar:grammarView,progress:progressView}[tab])()}
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;tab=b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));window.speechSynthesis?.cancel();render();scrollTo(0,0)};
const boxOf=id=>S.box[id]||0;

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
  C.first[v.id]=ok;const old=boxOf(v.id),nb=ok?Math.min(5,old+1):1;S.box[v.id]=nb;C.moves.push({v,old,nb,ok});record(ok);
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
const fullText=(e,a)=>e.type==='order'?e.answer:e.q.replace(/___+/,a);
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
    let pool=shuffle(e.words.map((w,i)=>({w,i}))),sel=[];
    const draw=()=>{app.innerHTML=`<div class="card">${head}<p class="muted center">Kelimeleri doğru sıraya diz</p><div class="words" id="sel">${sel.map(x=>`<button class="w" data-i="${x.i}">${esc(x.w)}</button>`).join('')}</div><div class="words" id="pool" style="border-style:solid">${pool.map(x=>`<button class="w" data-i="${x.i}">${esc(x.w)}</button>`).join('')}</div><div id="fb"></div><div id="ctl" style="display:flex;gap:10px"><button class="btn" id="clr">Temizle</button><button class="btn primary" id="chk" style="flex:1" ${pool.length?'disabled':''}>Kontrol et</button></div></div>`;
      $('#pool').onclick=ev=>{const b=ev.target.closest('.w');if(!b)return;const x=pool.find(p=>p.i==b.dataset.i);pool=pool.filter(p=>p!==x);sel.push(x);draw()};
      $('#sel').onclick=ev=>{const b=ev.target.closest('.w');if(!b)return;const x=sel.find(p=>p.i==b.dataset.i);sel=sel.filter(p=>p!==x);pool.push(x);draw()};
      $('#clr').onclick=()=>{pool=pool.concat(sel);sel=[];draw()};
      $('#chk').onclick=()=>{const g=sel.map(x=>x.w).join(' ');const ok=normEn(g)===normEn(e.answer);app.querySelectorAll('.w').forEach(x=>x.disabled=true);$('#ctl').remove();done(ok,g,e.answer)};
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

/* ---------- progress ---------- */
function progressView(){
  const seen=U.vocab.filter(v=>boxOf(v.id)>0).length,acc=S.total?Math.round(S.correct/S.total*100):0;
  const dist=[0,1,2,3,4,5].map(b=>U.vocab.filter(v=>boxOf(v.id)===b).length),mx=Math.max(1,...dist);
  const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const r=S.days[today(d)]||{n:0,c:0};return{l:['Pz','Pt','Sa','Ça','Pe','Cu','Ct'][d.getDay()],...r}}),dm=Math.max(1,...days.map(d=>d.n));
  app.innerHTML=`<div class="stats"><div class="card stat"><b>${seen}/${U.vocab.length}</b>çalışılan kelime</div><div class="card stat"><b>%${acc}</b>doğruluk</div><div class="card stat"><b>${streak()} 🔥</b>gün serisi</div><div class="card stat"><b>${dist[5]}</b>öğrenilen (kutu 5)</div></div>
  <div class="card"><h3>Leitner kutuları</h3><div class="cols">${dist.map((n,b)=>`<div class="col">${n}<div class="b" style="height:${n/mx*100}px"></div>${b?'Kutu '+b:'Yeni'}</div>`).join('')}</div></div>
  <div class="card"><h3>Son 7 gün</h3><div class="cols">${days.map(d=>`<div class="col" title="${d.c}/${d.n} doğru">${d.n}<div class="b" style="height:${d.n/dm*100}px"></div>${d.l}</div>`).join('')}</div></div>`;
}

/* ---------- settings ---------- */
const dlg=$('#settings');
$('#setBtn').onclick=()=>{$('#autoSpeak').checked=S.auto;$('#rate').value=S.rate;pickVoice();dlg.showModal()};
$('#closeSet').onclick=()=>dlg.close();
$('#autoSpeak').onchange=e=>{S.auto=e.target.checked;save()};
$('#rate').oninput=e=>{S.rate=+e.target.value;save()};
$('#resetBtn').onclick=()=>{if(confirm('Tüm ilerleme silinsin mi?')){const {auto,rate,unit}=S;S={box:{},days:{},auto,rate,unit,total:0,correct:0};save();dlg.close();render()}};

if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
init();
