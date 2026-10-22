'use strict';
/* ---------- Big Bass Kelime: vocabulary slot (virtual coins only) ---------- */
const SL_TIERS=[[.2,40,'🐟'],[.5,28,'🐠'],[1,18,'🐡'],[2,8,'🦑'],[5,5,'🦈'],[10,1,'🐳']];
const SL_BETS=[10,20,50,100],SL_P={fish:.15,wild:.03,scat:.03,fsWild:.08},SL_REEL='🌊🐚⚓🪝🫧'.match(/./gu);
const SL=()=>S.slot||(S.slot={coins:1000,bet:10,best:0,spins:0});
let slFS=null,slBusy=false,slGrid=null;     // free-spin state, spin lock, last grid (column-major, 15 cells)

function slTier(){let r=Math.random()*100;for(let i=0;i<SL_TIERS.length;i++){if((r-=SL_TIERS[i][1])<0)return i}return 0}
function slGen(free){
  const words=shuffle(U.vocab),g=[];let wi=0;
  const pw=free?SL_P.fsWild:SL_P.wild,ps=free?0:SL_P.scat;
  for(let i=0;i<15;i++){
    const r=Math.random();
    if(r<pw)g.push({k:'wild'});
    else if(r<pw+ps)g.push({k:'scat'});
    else if(r<pw+ps+SL_P.fish){const t=slTier();g.push({k:'fish',t,v:SL_TIERS[t][0],w:words[wi++%words.length]})}
    else g.push({k:'sea'});
  }
  return g;
}
const slCell=c=>c.k==='wild'?`<span class="ic">🎣</span><small>WILD</small>`
  :c.k==='scat'?`<span class="ic">🧰</span><small>BONUS</small>`
  :c.k==='fish'?`<span class="ic">${SL_TIERS[c.t][2]}</span><small>${esc(c.w.en)}</small><em>×${c.v}</em>`
  :`<span class="ic dim">${SL_REEL[(Math.random()*SL_REEL.length)|0]}</span>`;
const slAttr=c=>c.k==='fish'?` data-say="${esc(c.w.en)}"`:'';
function slDraw(g,hit){
  $('#slGrid').innerHTML=[0,1,2,3,4].map(c=>`<div class="reel">${[0,1,2].map(r=>{const x=g[c*3+r];
    return `<div class="cell ${x.k} ${hit&&(x.k==='wild'||(x.k==='fish'&&hit.fish))?'hit':''}"${slAttr(x)}>${slCell(x)}</div>`}).join('')}</div>`).join('');
}
let slAC=null;
function slBeep(f,d,type){
  try{slAC=slAC||new (window.AudioContext||window.webkitAudioContext)();const o=slAC.createOscillator(),a=slAC.createGain();
    o.type=type||'sine';o.frequency.value=f;a.gain.value=.04;a.gain.exponentialRampToValueAtTime(.0001,slAC.currentTime+d);
    o.connect(a);a.connect(slAC.destination);o.start();o.stop(slAC.currentTime+d)}catch(e){}
}
const slWait=ms=>new Promise(r=>setTimeout(r,ms));
async function slAnimate(final){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){slDraw(final);return}
  const reels=[...document.querySelectorAll('#slGrid .reel')],stop=reels.map((_,i)=>Date.now()+500+i*260);
  await new Promise(done=>{
    const iv=setInterval(()=>{
      if(tab!=='slot'){clearInterval(iv);done();return}
      reels.forEach((rl,i)=>{
        if(Date.now()>=stop[i]){if(!rl.dataset.s){rl.dataset.s=1;[0,1,2].forEach(r=>{rl.children[r].className='cell '+final[i*3+r].k;rl.children[r].innerHTML=slCell(final[i*3+r]);
          if(final[i*3+r].k==='fish')rl.children[r].setAttribute('data-say',final[i*3+r].w.en);else rl.children[r].removeAttribute('data-say')});slBeep(300+i*60,.08)}}
        else [...rl.children].forEach(c=>{c.className='cell spin';c.innerHTML=`<span class="ic">${SL_TIERS[(Math.random()*6)|0][2]}</span>`;c.removeAttribute('data-say')});
      });
      if(reels.every(r=>r.dataset.s)){clearInterval(iv);done()}
    },70);
  });
}
function slInfo(){
  const s=SL();
  $('#slCoins').textContent=s.coins.toLocaleString('tr-TR');
  $('#slBest').textContent=s.best.toLocaleString('tr-TR');
  const b=$('#slSpin');
  b.textContent=slFS?`🎣 Bedava dönüş (${slFS.left})`:'🎣 DÖNDÜR';
  b.disabled=slBusy||(!slFS&&s.coins<s.bet);
  document.querySelectorAll('[data-bet]').forEach(x=>{x.classList.toggle('on',+x.dataset.bet===s.bet);x.disabled=slBusy||!!slFS||+x.dataset.bet>s.coins});
  $('#slRefill').style.display=!slFS&&s.coins<SL_BETS[0]&&!slBusy?'':'none';
  $('#slFs').innerHTML=slFS?`<div class="fb ok">🧰 Bedava dönüşler · çarpan <b>×${slFS.mult}</b> · toplam <b>${slFS.total}</b> coin</div>`:'';
}
function slWords(g,caught){
  const fish=g.filter(c=>c.k==='fish');
  $('#slWords').innerHTML=fish.length?`<h3>${caught?'Yakalanan':'Kaçan'} kelimeler</h3>`+fish.sort((a,b)=>b.v-a.v).map(c=>`<div class="ex"><div><b>${esc(c.w.en)}</b><small>${esc(c.w.tr)}</small></div><span class="tag">×${c.v}</span>${spk(c.w.en)}</div>`).join(''):'';
}
function slQuiz(v,win){
  return new Promise(res=>{
    const opts=shuffle([v,...shuffle(U.vocab.filter(x=>x.id!==v.id&&normTr(x.tr)!==normTr(v.tr))).filter((x,i,a)=>a.findIndex(y=>normTr(y.tr)===normTr(x.tr))===i).slice(0,3)]);
    $('#slQ').innerHTML=`<div class="card sample"><h3>🎣 Kancayı çek! +${win} coin</h3><p>En büyük balığın kelimesi: <b class="big" style="display:inline">${esc(v.en)}</b> ${spk(v.en)}</p><p class="muted">Türkçesini bil, kazancın tamamını al. Yanlışta yarısı gider.</p>
      <div class="opts two" id="slOpts" style="flex-basis:100%">${opts.map(o=>`<button class="opt" data-id="${o.id}">${esc(o.tr)}</button>`).join('')}</div></div>`;
    if(S.auto)say(v.en);
    $('#slOpts').onclick=e=>{const b=e.target.closest('.opt');if(!b||b.disabled)return;const ok=b.dataset.id===v.id;
      const old=boxOf(v.id);P().box[v.id]=ok?Math.min(5,old+1):1;record(ok);
      document.querySelectorAll('#slOpts .opt').forEach(x=>{x.disabled=true;if(x.dataset.id===v.id)x.classList.add('ok')});if(!ok)b.classList.add('bad');
      setTimeout(()=>{$('#slQ').innerHTML='';res(ok)},ok?700:1600)};
  });
}
function slMsg(t,ok){$('#slMsg').innerHTML=t?`<div class="fb ${ok?'ok':'bad'}">${t}</div>`:''}
async function slSpin(){
  if(slBusy||tab!=='slot')return;
  const s=SL();if(!slFS&&s.coins<s.bet)return;
  slBusy=true;slMsg('');$('#slQ').innerHTML='';
  const bet=slFS?slFS.bet:s.bet;
  if(slFS)slFS.left--;else{s.coins-=bet;s.spins++}
  save();slInfo();slBeep(220,.1,'triangle');
  const g=slGen(!!slFS);slGrid=g;
  await slAnimate(g);if(tab!=='slot'){slBusy=false;return}
  const wilds=g.filter(c=>c.k==='wild').length,fish=g.filter(c=>c.k==='fish'),scat=g.filter(c=>c.k==='scat').length;
  if(slFS){slFS.wilds+=wilds;slFS.mult=1+Math.floor(slFS.wilds/4)}
  const sum=wilds&&fish.length?fish.reduce((a,c)=>a+c.v,0):0;
  const win=Math.round(sum*bet*(slFS?slFS.mult:1));
  slDraw(g,win?{fish:true}:null);slWords(g,!!win);
  if(win){
    slBeep(660,.15);setTimeout(()=>slBeep(880,.2),120);
    if(slFS){s.coins+=win;slFS.total+=win;slMsg(`🎣 ${wilds} olta ${fish.length} balığı topladı: +${win} coin (×${slFS.mult})`,1)}
    else{
      const top=fish.reduce((a,c)=>c.v>a.v?c:a);
      slMsg(`🎣 ${wilds} olta ${fish.length} balığı topladı: ${win} coin!`,1);
      const ok=await slQuiz(top.w,win);if(tab!=='slot'){slBusy=false;return}
      const pay=ok?win:Math.floor(win/2);s.coins+=pay;
      slMsg(ok?`✓ Doğru! +${pay} coin`:`✗ Yanlış: <b>${esc(top.w.en)}</b> = <b>${esc(top.w.tr)}</b> · +${pay} coin`,ok);
    }
    s.best=Math.max(s.best,win);
  }else if(!slFS)slMsg(wilds?'Olta var ama balık yok…':'Bu sefer olta çıkmadı.',0);
  else slMsg('Bu turda kazanç yok.',0);
  if(!slFS&&scat>=3){slFS={bet,left:8+(scat-3)*2,wilds:0,mult:1,total:0};slMsg(`🧰 ${scat} bonus sandığı! ${slFS.left} bedava dönüş kazandın. Oltalar çarpanı artırır.`,1);slBeep(520,.3,'square')}
  else if(slFS&&slFS.left<=0){slMsg(`🏁 Bedava dönüşler bitti: toplam ${slFS.total} coin kazandın.`,1);slFS=null}
  save();slBusy=false;if(tab==='slot')slInfo();
}
function slotView(){
  const s=SL();
  app.innerHTML=`<div class="card slot"><h2>🎣 Big Bass Kelime</h2>
  <p class="muted">Oltalar (🎣) ekrandaki balıkların değerini toplar. Her balık bir kelime taşır; kazancı almak için en büyük balığın Türkçesini bil. 🧰 ×3 = 8 bedava dönüş. Sadece sanal coin, gerçek para yok.</p>
  <div class="slbar"><div><small>Coin</small><b id="slCoins"></b></div><div><small>En büyük kazanç</small><b id="slBest"></b></div></div>
  <div id="slFs"></div><div id="slGrid" class="slgrid"></div><div id="slMsg" role="status"></div><div id="slQ"></div>
  <div class="chips" style="margin-top:12px">${SL_BETS.map(b=>`<button class="chip" data-bet="${b}">Bahis ${b}</button>`).join('')}</div>
  <button class="btn primary" id="slSpin" style="width:100%"></button>
  <button class="btn" id="slRefill" style="width:100%;margin-top:8px">🎁 Coinin bitti: 500 coin al</button></div>
  <div class="card" id="slWords"></div>`;
  slDraw(slGrid||Array.from({length:15},()=>({k:'sea'})));
  if(slGrid)slWords(slGrid,false);
  document.querySelectorAll('[data-bet]').forEach(b=>b.onclick=()=>{s.bet=+b.dataset.bet;save();slInfo()});
  $('#slSpin').onclick=slSpin;
  $('#slRefill').onclick=()=>{s.coins+=500;save();slInfo()};
  slInfo();
}
