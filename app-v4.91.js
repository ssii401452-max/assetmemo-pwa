
(function(){
'use strict';


var state=null, currentPage='', investTab='nisa', lifeTab='special', nisaChartRange='1y', dashMode='latest', dashBreakdown='asset', editingSpecialId='', editingFixedCostId='', editingTransactionId='', pageScrolls={}, programmaticScroll=false, scrollSaveTimer=null, nextAction=null, amountHighlightPlayed=true, amountHighlightPending=false, pendingConfirmAction=null, tabSwitchTimer=null, pageTransitionSeq=0, pageTransitionBusy=false, pendingPageRequest=null, salaryLogYear=(new Date()).getFullYear(), salaryLogMonth=(new Date()).getMonth()+1, mutationBusy=false;
function $(id){return document.getElementById(id)}
function setDebug(t){var d=$('debug');if(d)d.textContent=t||''}
window.onerror=function(msg,src,line,col,err){setDebug('エラー: '+msg+'\nline: '+line+' col: '+col); return false};
function uid(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),function(x){return x.toString(16).padStart(2,'0')}).join('')}
function localDateString(d){d=d instanceof Date?d:new Date(d||Date.now()); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function today(){return localDateString(new Date())}
function ym(d){return String(d||today()).slice(0,7)}
function nextYearDate(){var d=new Date(); d.setFullYear(d.getFullYear()+1); return localDateString(d)}
function n(v){var x=Number(String(v||'').replace(/[,円¥％%月か年\s]/g,'')); return isFinite(x)?x:0}
function yen(v){return n(v).toLocaleString('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0})}
function pct(v){return (isFinite(v)?v:0).toFixed(1)+'%'}
function monthText(v){v=Number(v); if(!isFinite(v)||v<0)v=0; return v.toFixed(1)+'か月分'}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var addFlowTimer=null, addFlowHideTimer=null, toastTimer=null;
function toast(t){var el=$('status'); if(!el)return; el.textContent=t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){el.classList.remove('show')},1500)}
function labelForField(el){
  var prev=el.previousElementSibling;
  if(prev&&prev.tagName==='LABEL')return (prev.textContent||'').trim();
  var wrap=el.parentElement;
  if(wrap){
    for(var i=0;i<wrap.children.length;i++){
      var c=wrap.children[i];
      if(c===el)break;
      if(c.tagName==='LABEL')return (c.textContent||'').trim();
    }
  }
  return '';
}
function displayValueForField(f,v){
  if(f.type==='date')return v;
  if(f.tagName==='SELECT')return v;
  var lab=labelForField(f);
  if(/金額|額面|手取り|賞与|税|保険|年金|手当|残高|元本|評価額|入金|目標額|積立額|返済額/.test(lab)){
    var num=n(v); if(num||String(v).replace(/[,円¥\s]/g,'')==='0')return Math.round(num).toLocaleString('ja-JP')+'円';
  }
  return v;
}
function hideAddFlow(){
  var layer=$('addFlowLayer'); if(!layer||!layer.classList.contains('show'))return;
  clearTimeout(addFlowTimer); clearTimeout(addFlowHideTimer);
  layer.classList.add('hiding');
  addFlowHideTimer=setTimeout(function(){layer.classList.remove('show','hiding');layer.setAttribute('aria-hidden','true')},360);
}
function playAddFlow(title,items){
  var layer=$('addFlowLayer'); if(!layer)return;
  $('addFlowTitle').textContent=title||'追加しました';
  var detail=$('addFlowDetail'); detail.innerHTML=(items||[]).slice(0,3).map(function(item){return '<div class="add-flow-row"><span class="add-flow-row-label">'+esc(item.label)+'</span><span class="add-flow-row-value">'+esc(item.value)+'</span></div>'}).join('');
  clearTimeout(addFlowTimer); clearTimeout(addFlowHideTimer);
  layer.classList.remove('show','hiding'); void layer.offsetWidth; layer.classList.add('show'); layer.setAttribute('aria-hidden','false');
  addFlowTimer=setTimeout(hideAddFlow,5000);
}
function moneyText(v){return Math.round(n(v)).toLocaleString('ja-JP')+'円'}
function dateText(v){var p=salaryRecordYM({date:v}); if(p)return p.year+'/'+p.month+'/'+(p.day||1); return String(v||'')}
function monthDisplay(y,m){return Number(y)+'年'+Number(m)+'月'}
function showSavedVisual(title,items){playAddFlow(title,(items||[]).filter(function(x){return x&&x.label&&String(x.value||'')!==''}).slice(0,3))}
document.addEventListener('click',function(e){var layer=$('addFlowLayer');if(layer&&layer.classList.contains('show')){e.preventDefault();e.stopPropagation();hideAddFlow()}},true);


function emptyState(){return {version:'4.71',settings:{currentAge:24,birthYearEstimate:0,retireAge:65,nisaAnnualReturn:5,nisaSafety:100,cashNow:0,pointsNow:0,studentLoanBalance:0,studentLoanRate:0,studentLoanMonthly:10000,studentLoanPrepay:0,studentLoanPrepayMonth:1,defenseMonths:6,monthlyExpenseManual:0,monthlyBudget:0,netIncomeManual:0,rent:0,housingAllowanceGross:0,housingAllowanceNet:0,housingAllowanceNetRate:80,rentRatioLimit:26,studentLoanPlanRegistered:false,studentLoanPlanStart:'',studentLoanOpeningBalance:0,studentLoanTargetMonths:240,studentLoanBonus:0,furusatoRemainingBonusEstimate:0,furusatoDonatedAmount:0,furusatoFinalConfirmed:false,furusatoTrackingYear:Number(today().slice(0,4))},transactions:[],salary:[],nisa:[],otherInvest:[],specials:[],subs:[],fixedCosts:[],budgets:[]}}

function normalizeState(){
  var base=emptyState();
  if(!state||typeof state!=='object')state=base;
  if(!state.settings)state.settings={};
  Object.keys(base.settings).forEach(function(k){if(state.settings[k]===undefined||state.settings[k]===null)state.settings[k]=base.settings[k]});
  var currentTrackingYear=Number(today().slice(0,4));
  if(Number(state.settings.furusatoTrackingYear||0)!==currentTrackingYear){
    state.settings.furusatoTrackingYear=currentTrackingYear;
    state.settings.furusatoRemainingBonusEstimate=0;
    state.settings.furusatoDonatedAmount=0;
    state.settings.furusatoFinalConfirmed=false;
  }
  ['transactions','salary','nisa','otherInvest','specials','subs','fixedCosts','budgets'].forEach(function(k){if(!Array.isArray(state[k]))state[k]=[]});
  if(!state.specials.length)state.specials=base.specials;
  if((state.fixedCosts||[]).length===0 && (state.subs||[]).length){
    state.fixedCosts=(state.subs||[]).map(function(s){return {id:s.id||uid(),name:s.name||'サブスク',kind:'サブスク',cycle:s.cycle||'月額',amount:n(s.amount),active:s.active!==false}});
  }
  state.version='4.91';
}


if(window.top!==window.self){document.body.textContent='資産メモを直接開いてください。';throw new Error('Embedded frame blocked');}
const security = window.AssetMemoSecurity;
const vault = new security.Vault();
var lastGoodState = null, stateReady = false, backupCache = null;
function cloneState(value){ return JSON.parse(JSON.stringify(value)); }
function visibleError(message){
  var banner=$('saveError');
  if(!banner){banner=document.createElement('div');banner.id='saveError';banner.className='warning-box';banner.setAttribute('role','alert');document.body.insertBefore(banner,$('app'));}
  banner.textContent=message;
}
async function save(){
  if(!stateReady||!state)return false;
  try{
    var clean=security.validateState(state);
    await vault.save(clean);
    lastGoodState=cloneState(clean);
    var error=$('saveError');if(error)error.remove();
    return true;
  }catch(e){
    if(lastGoodState)state=cloneState(lastGoodState);
    visibleError(e.message||'保存できませんでした。前の保存データは残っています。');
    return false;
  }
}

function unlock(){
  amountHighlightPlayed=true;
  amountHighlightPending=false;
  $('lockscreen').classList.add('hidden');
  $('nav').classList.remove('hidden');
  currentPage='dash';
  activateNav('dash');
  updateBrandmark('dash');
  renderPage('dash');
  enhanceInputs();
  pageScrolls.dash=0;
  window.scrollTo(0,0);
}
async function startPasswordless(){
  stateReady=false;
  $('app').textContent='保存データを確認しています…';
  try{
    var loaded=await vault.load();
    var legacy=window.localStorage.getItem(security.LEGACY_STORE);
    var migrated=false;
    if(loaded){state=loaded;}
    else if(legacy){state=security.decryptLegacy(security.parse(legacy));migrated=true;}
    else{state=emptyState();}
    normalizeState();
    state=security.validateState(state);
    if(!loaded){await vault.save(state);}
    lastGoodState=cloneState(state);
    // Remove weak old copies only after the new transaction has committed.
    if(migrated){window.localStorage.removeItem(security.LEGACY_STORE);}
    window.localStorage.removeItem(security.LEGACY_PASSWORD_STORE);
    stateReady=true;
    unlock();
    toast(migrated?'保存データを安全な形式へ移行しました':'開きました');
    if(loaded&&legacy){visibleError('旧版の記録も残っています。旧版のタブを閉じてください。旧版の記録は自動上書き・削除していません。');var rescue=document.createElement('button');rescue.textContent='旧版の元データを保存';rescue.setAttribute('data-click','downloadRecovery()');$('saveError').appendChild(rescue);}
  }catch(e){showRecovery(e);}
}
function showRecovery(e){
  stateReady=false;
  $('nav').classList.add('hidden');
  $('app').innerHTML='<div class="card"><h2>保存データを開けませんでした</h2><p id="recoveryMessage"></p><p class="small">元の記録は上書きしていません。再読み込みするか、バックアップから復元できます。</p><div class="btnrow"><button data-click="retryStartup()">再読み込み</button><button class="secondary" data-click="downloadRecovery()">元データを保存</button><button class="secondary" data-click="importBackup(false)">バックアップ読込</button></div></div>';
  $('recoveryMessage').textContent=e.message||'保存領域にアクセスできません。';
}
window.retryStartup=function(){window.location.reload();};
function downloadText(text,filename){
  var url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  var link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url)},10000);
}
window.downloadRecovery=async function(){
  try{
    var legacy=null;try{legacy=window.localStorage.getItem(security.LEGACY_STORE)}catch(_){}
    downloadText(await vault.recoveryBundle(legacy),'assetmemo-recovery-ciphertext.json');
  }catch(e){visibleError(e.message);}
};

function pageIconSvg(page){
  var icons={
    dash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5"></path><path d="M5.5 10.5V20h13V10.5"></path></svg>',
    entry:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h9l3 3V19.5H6z"></path><path d="M15 4.5v3h3"></path><path d="M9 11h6"></path><path d="M9 15h6"></path></svg>',
    salary:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2.5"></rect><path d="M7 10.5h4"></path><path d="M7 14h2"></path></svg>',
    invest:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18.5h14"></path><path d="M7 15l3-3 2.5 2.5L18 9"></path><path d="M14.5 9H18v3.5"></path></svg>',
    life:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5s-6.5-3.8-6.5-8.5A3.8 3.8 0 0 1 12 8.4a3.8 3.8 0 0 1 6.5 2.6c0 4.7-6.5 8.5-6.5 8.5z"></path></svg>',
    tools:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M7 12h10"></path><path d="M10 17h4"></path></svg>'
  };
  return icons[page]||icons.dash;
}
function updateBrandmark(page){var bm=$('brandmarkIcon'); if(bm)bm.innerHTML=pageIconSvg(page||currentPage||'dash')}

function setTitle(t,sub){$('title').textContent=t; $('subtitle').textContent=sub||'ahamo風フラットUI v4.91'}
function setMenuOpen(on){
  var gm=$('globalMenu'), btn=$('menuBtn');
  if(!gm||!btn){document.body.classList.remove('menu-open');return;}
  gm.classList.toggle('open',!!on);
  document.body.classList.toggle('menu-open',!!on);
  gm.setAttribute('aria-hidden',on?'false':'true');
  btn.setAttribute('aria-expanded',on?'true':'false');
  btn.setAttribute('aria-label',on?'メニューを閉じる':'メニューを開く');
}
window.openMenu=function(){setMenuOpen(true)}
window.closeMenu=function(){setMenuOpen(false)}
window.toggleMenu=function(){var gm=$('globalMenu'); setMenuOpen(!(gm&&gm.classList.contains('open')))}
window.menuGo=function(page){closeMenu(); show(page)}

function getScrollY(){return window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0}
function maxScrollY(){
  var d=document.documentElement||{}, b=document.body||{};
  return Math.max(0, Math.max(d.scrollHeight||0,b.scrollHeight||0,d.offsetHeight||0,b.offsetHeight||0)-(window.innerHeight||d.clientHeight||0));
}
function clampScrollY(y){return Math.min(maxScrollY(),Math.max(0,n(y)))}
function saveCurrentScroll(page){
  var p=page||currentPage;
  if(!p||programmaticScroll)return;
  pageScrolls[p]=clampScrollY(getScrollY());
}
function activateNav(page){
  var buttons=document.querySelectorAll('nav button');
  for(var i=0;i<buttons.length;i++)buttons[i].classList.toggle('active',buttons[i].getAttribute('data-page')===page);
  var menuItems=document.querySelectorAll('.menu-card');
  for(var j=0;j<menuItems.length;j++)menuItems[j].classList.toggle('active',menuItems[j].getAttribute('data-page')===page);
}

function playPageTransition(){
  // v4.66: transitionToPage controls the only page animation.
}

function renderPage(page){
  if(page==='dash')dash();
  else if(page==='entry')entry();
  else if(page==='salary')salaryPage();
  else if(page==='invest')invest();
  else if(page==='life')life();
  else if(page==='tools')tools();
  else dash();
}
function nextFrame(){
  return new Promise(function(resolve){
    (window.requestAnimationFrame||function(cb){return setTimeout(cb,16)})(function(){resolve()});
  });
}
function waitMs(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function setScrollImmediate(page,y,remember){
  var target=Math.max(0,Math.min(maxScrollY(),n(y)));
  programmaticScroll=true;
  if(remember!==false)pageScrolls[page]=target;
  var root=document.documentElement, body=document.body;
  var oldRoot=root&&root.style?root.style.scrollBehavior:'';
  var oldBody=body&&body.style?body.style.scrollBehavior:'';
  if(root&&root.style)root.style.scrollBehavior='auto';
  if(body&&body.style)body.style.scrollBehavior='auto';
  window.scrollTo(0,target);
  if(root)root.scrollTop=target;
  if(body)body.scrollTop=target;
  if(root&&root.style)root.style.scrollBehavior=oldRoot;
  if(body&&body.style)body.style.scrollBehavior=oldBody;
}
function ensurePageTransitionCover(){
  var cover=$('pageTransitionCover');
  if(cover)return cover;
  cover=document.createElement('div');
  cover.id='pageTransitionCover';
  cover.className='page-transition-cover';
  cover.setAttribute('aria-hidden','true');
  document.body.appendChild(cover);
  return cover;
}
function targetYAfterRender(request){
  if(request.targetId){
    var el=$(request.targetId);
    if(el&&el.getBoundingClientRect){
      return Math.max(0,el.getBoundingClientRect().top+getScrollY()-116);
    }
    return 0;
  }
  if(request.restore!==false&&Object.prototype.hasOwnProperty.call(pageScrolls,request.page)){
    return pageScrolls[request.page];
  }
  return 0;
}
async function performPageTransition(request){
  var cover=ensurePageTransitionCover(), app=$('app');
  if(!cover||!app)return;

  document.body.classList.add('page-transition-running');
  cover.classList.remove('cover-leave');
  cover.classList.add('cover-show');
  await nextFrame();
  await nextFrame();
  await waitMs(86);

  currentPage=request.page;
  if(request.page==='invest'&&request.tab)investTab=request.tab;
  activateNav(request.page);
  updateBrandmark(request.page);

  app.style.visibility='hidden';
  app.style.opacity='1';
  app.style.transform='none';
  renderPage(request.page);
  enhanceInputs();

  await nextFrame();
  await nextFrame();

  var y=targetYAfterRender(request);
  setScrollImmediate(request.page,y,true);

  await nextFrame();
  await nextFrame();

  app.style.visibility='';
  cover.classList.remove('cover-show');
  cover.classList.add('cover-leave');

  await waitMs(190);
  cover.classList.remove('cover-leave');
  document.body.classList.remove('page-transition-running');
  programmaticScroll=false;
}
async function drainPageTransitions(){
  if(pageTransitionBusy)return;
  pageTransitionBusy=true;
  try{
    while(pendingPageRequest){
      var request=pendingPageRequest;
      pendingPageRequest=null;
      try{
        await performPageTransition(request);
      }catch(e){
        document.body.classList.remove('page-transition-running');
        var cover=$('pageTransitionCover');
        if(cover)cover.className='page-transition-cover';
        var app=$('app');
        if(app)app.style.visibility='';
        programmaticScroll=false;
        setDebug(String(e&&e.stack||e));
      }
    }
  }finally{
    pageTransitionBusy=false;
  }
}
function requestPageTransition(request){
  pendingPageRequest=request;
  drainPageTransitions();
}
function smoothScrollToPageY(page,target,duration){
  var start=getScrollY(), end=Math.max(0,n(target)), change=end-start;
  var startTime=null, raf=window.requestAnimationFrame||function(cb){return setTimeout(function(){cb(Date.now())},16)};
  duration=Math.max(180,n(duration)||340);
  pageScrolls[page]=end;
  programmaticScroll=true;
  function ease(t){return 1-Math.pow(1-t,3)}
  function step(ts){
    if(currentPage!==page){programmaticScroll=false;return}
    if(startTime===null)startTime=ts;
    var p=Math.min(1,(ts-startTime)/duration);
    window.scrollTo(0,start+change*ease(p));
    if(p<1){raf(step)}else{
      window.scrollTo(0,end);
      pageScrolls[page]=end;
      setTimeout(function(){programmaticScroll=false},30);
    }
  }
  raf(step);
}
function topCurrentPage(page){
  pageScrolls[page]=0;
  smoothScrollToPageY(page,0,340);
}
window.show=function(page){
  try{
    if(!state)return;
    closeMenu();
    var app=$('app');
    var samePage=(page===currentPage&&app&&app.innerHTML.trim());
    if(samePage){topCurrentPage(page);return}
    saveCurrentScroll(currentPage);
    requestPageTransition({page:page,restore:true,targetId:'',tab:''});
  }catch(e){
    document.body.classList.remove('page-transition-running');
    toast('画面を開けませんでした');
    setDebug(String(e&&e.stack||e));
  }
}
window.jumpTo=function(page,targetId,tab){
  try{
    if(!state)return;
    closeMenu();
    if(page==='life'){
      if(targetId==='fixedCostTitle')lifeTab='fixed';
      else if(targetId==='specialTitle')lifeTab='special';
    }
    saveCurrentScroll(currentPage);
    requestPageTransition({page:page,restore:false,targetId:targetId||'',tab:tab||''});
  }catch(e){
    document.body.classList.remove('page-transition-running');
    toast('移動できませんでした');
    setDebug(String(e&&e.stack||e));
  }
}
window.addEventListener('scroll',function(){
  if(!state||programmaticScroll||!currentPage)return;
  if(scrollSaveTimer)clearTimeout(scrollSaveTimer);
  scrollSaveTimer=setTimeout(function(){saveCurrentScroll(currentPage)},80);
},{passive:true});



function thisMonth(){return today().slice(0,7)}
function txMonth(m){return (state.transactions||[]).filter(function(r){return ym(r.date)===m})}
function incomeMonth(m){return txMonth(m).filter(function(r){return r.type==='収入'}).reduce(function(a,r){return a+n(r.amount)},0)}
function expenseMonth(m){return txMonth(m).filter(function(r){return r.type==='支出'}).reduce(function(a,r){return a+n(r.amount)},0)}
function fixedExpenseMonth(m){return txMonth(m).filter(function(r){return r.type==='支出'&&r.kind==='固定費'}).reduce(function(a,r){return a+n(r.amount)},0)}
function latestByDate(arr){arr=arr||[]; if(!arr.length)return {}; return arr.slice().sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))})[0]||{}}
function latestNisa(){return latestByDate(state.nisa)}
function nisaPrincipal(){return (state.nisa||[]).reduce(function(a,r){return a+n(r.contribution)},0)}
function nisaValue(){var l=latestNisa(); return n(l.value)}
function nisaProfit(){return nisaValue()-nisaPrincipal()}
function calendarSalaryProjection(y){
  y=String(y||today().slice(0,4));
  var rows=(state.salary||[]).filter(function(r){return String(r.date||'').slice(0,4)===y});
  var actual=0, actualSocial=0, grossByMonth={}, socialByMonth={}, anyMonths={};
  rows.forEach(function(r){
    var month=String(r.date||'').slice(0,7);
    if(month)anyMonths[month]=true;
    actual+=n(r.gross)+n(r.bonus);
    actualSocial+=n(r.health)+n(r.pension)+n(r.employment);
    if(month){
      grossByMonth[month]=n(grossByMonth[month])+n(r.gross);
      socialByMonth[month]=n(socialByMonth[month])+n(r.health)+n(r.pension)+n(r.employment);
    }
  });
  var grossMonths=Object.keys(grossByMonth).filter(function(k){return n(grossByMonth[k])>0});
  var socialMonths=Object.keys(socialByMonth).filter(function(k){return n(socialByMonth[k])>0});
  var avgGross=grossMonths.length?grossMonths.reduce(function(a,k){return a+n(grossByMonth[k])},0)/grossMonths.length:0;
  var avgSocial=socialMonths.length?socialMonths.reduce(function(a,k){return a+n(socialByMonth[k])},0)/socialMonths.length:0;
  var missing=Math.max(0,12-grossMonths.length);
  var remainingBonus=n(state.settings.furusatoRemainingBonusEstimate);
  var projected=actual+avgGross*missing+remainingBonus;
  var projectedSocial=actualSocial+avgSocial*missing;
  var enteredMonths=Object.keys(anyMonths).length;
  return {
    year:y,rows:rows,actual:actual,actualSocial:actualSocial,
    grossMonths:grossMonths.length,enteredMonths:enteredMonths,
    avgGross:avgGross,missingMonths:missing,remainingBonus:remainingBonus,
    projected:projected,projectedSocial:projectedSocial,
    complete:grossMonths.length>=12
  };
}
function annualIncomeEstimate(){return calendarSalaryProjection(today().slice(0,4)).projected}
function salaryDeduction(income,year){
  income=n(income); year=Number(year||today().slice(0,4));
  if(year>=2026){
    if(income<=1900000)return Math.min(income,740000);
    if(income<=2200000)return income*.30+80000;
  }else if(year>=2025){
    if(income<=1900000)return Math.min(income,650000);
  }else{
    if(income<=1625000)return Math.min(income,550000);
    if(income<=1800000)return income*.40-100000;
  }
  if(income<=3600000)return income*.30+80000;
  if(income<=6600000)return income*.20+440000;
  if(income<=8500000)return income*.10+1100000;
  return 1950000;
}
function incomeTaxBasicDeduction(totalIncome,year){
  totalIncome=Math.max(0,n(totalIncome)); year=Number(year||today().slice(0,4));
  if(year>=2026){
    if(totalIncome<=1320000)return 1040000;
    if(totalIncome<=3360000)return 620000;
    if(totalIncome<=4890000)return 680000;
    if(totalIncome<=6550000)return 670000;
    if(totalIncome<=23500000)return 620000;
  }else if(year>=2025){
    if(totalIncome<=1320000)return 950000;
    if(totalIncome<=3360000)return 880000;
    if(totalIncome<=4890000)return 680000;
    if(totalIncome<=6550000)return 630000;
    if(totalIncome<=23500000)return 580000;
  }
  if(totalIncome<=24000000)return 480000;
  if(totalIncome<=24500000)return 320000;
  if(totalIncome<=25000000)return 160000;
  return 0;
}
function incomeTaxMarginalRate(taxable){
  taxable=Math.max(0,n(taxable));
  if(taxable<=1950000)return .05;
  if(taxable<=3300000)return .10;
  if(taxable<=6950000)return .20;
  if(taxable<=9000000)return .23;
  if(taxable<=18000000)return .33;
  if(taxable<=40000000)return .40;
  return .45;
}
function simpleIncomeTax(taxable){
  taxable=Math.max(0,taxable);
  var rows=[[1950000,.05,0],[3300000,.10,97500],[6950000,.20,427500],[9000000,.23,636000],[18000000,.33,1536000],[40000000,.40,2796000],[1e15,.45,4796000]];
  for(var i=0;i<rows.length;i++){if(taxable<=rows[i][0])return taxable*rows[i][1]-rows[i][2]}
  return 0;
}
function furusatoLimit(income,socialInsurance,year){
  income=n(income); year=Number(year||today().slice(0,4));
  if(income<=0)return 0;
  var emp=salaryDeduction(income,year);
  var salaryIncome=Math.max(0,income-emp);
  var social=n(socialInsurance)||income*.15;
  var basic=incomeTaxBasicDeduction(salaryIncome,year);
  var taxable=Math.max(0,salaryIncome-social-basic);
  var rate=incomeTaxMarginalRate(taxable)*1.021;
  var residentTaxable=Math.max(0,salaryIncome-social-430000);
  var residentIncomeLevy=residentTaxable*.10;
  var denominator=Math.max(.05,.90-rate);
  return Math.max(0,Math.floor((residentIncomeLevy*.20)/denominator+2000));
}
function furusatoProjection(){
  var p=calendarSalaryProjection(today().slice(0,4));
  var limit=furusatoLimit(p.projected,p.projectedSocial,p.year);
  var safety=p.complete?.95:(p.grossMonths>=10?.90:(p.grossMonths>=6?.80:.70));
  var safe=Math.max(0,Math.floor(limit*safety/1000)*1000);
  var decMonth=p.year+'-12';
  var decemberSalary=(p.rows||[]).some(function(r){
    return String(r.date||'').slice(0,7)===decMonth && (n(r.gross)>0||n(r.net)>0);
  });
  var confirmed=state.settings.furusatoFinalConfirmed===true;
  var finalReady=decemberSalary&&confirmed;
  var finalGuide=Math.max(0,Math.floor(Math.max(0,limit-3000)/1000)*1000);
  var donated=Math.max(0,n(state.settings.furusatoDonatedAmount));
  var usableLimit=finalReady?finalGuide:safe;
  var remaining=Math.max(0,usableLimit-donated);
  var over=Math.max(0,donated-usableLimit);
  p.limit=limit;
  p.safetyRate=safety;
  p.safeLimit=safe;
  p.decemberSalary=decemberSalary;
  p.finalConfirmed=confirmed;
  p.finalReady=finalReady;
  p.finalGuide=finalGuide;
  p.donated=donated;
  p.usableLimit=usableLimit;
  p.remaining=remaining;
  p.over=over;
  return p;
}
function monthlySubs(){return 0}
function monthlyFixedCosts(){return (state.fixedCosts||[]).filter(function(s){return s.active!==false}).reduce(function(sum,s){return sum+(s.cycle==='年額'?n(s.amount)/12:n(s.amount))},0)}
function fixedLoanItems(){return (state.fixedCosts||[]).filter(function(s){return s.active!==false && (s.kind==='ローン返済'||n(s.loanBalance)>0)})}
function fixedLoanBalanceTotal(){return fixedLoanItems().reduce(function(sum,s){return sum+n(s.loanBalance)},0)}
function monthsUntilLoanEnd(endDate){
  if(!endDate)return 9999;
  var now=new Date();
  var end=new Date(String(endDate)+'T00:00:00');
  if(isNaN(end.getTime()))return 9999;
  var months=(end.getFullYear()-now.getFullYear())*12+(end.getMonth()-now.getMonth())+1;
  return Math.max(0,months);
}
function fixedLoanPayments(months){
  months=Math.max(1,Math.round(n(months)||12));
  var total=0;
  fixedLoanItems().forEach(function(s){
    var monthly=s.cycle==='年額'?n(s.amount)/12:n(s.amount);
    var bonus=n(s.loanBonus);
    var bal=n(s.loanBalance);
    var effectiveMonths=Math.min(months,monthsUntilLoanEnd(s.loanEnd));
    var t=0;
    for(var i=0;i<effectiveMonths;i++){
      var d=new Date(); d.setMonth(d.getMonth()+i);
      var pay=monthly;
      var m=d.getMonth()+1;
      if(m===1||m===7)pay+=bonus;
      t+=pay;
    }
    total+=Math.min(bal||t,t);
  });
  return total;
}

function monthlyExpenseBase(){return expenseMonth(thisMonth())||monthlyFixedCosts()}
function defenseAsset(){return n(state.settings.cashNow)+n(state.settings.pointsNow)+nisaValue()}
function defenseMonths(){var exp=monthlyExpenseBase(); return exp>0?defenseAsset()/exp:0}

function monthEndDate(monthStr){var p=String(monthStr||thisMonth()).split('-'); return localDateString(new Date(Number(p[0]),Number(p[1]),0))}
function addMonthsToYM(ymstr,delta){var p=String(ymstr||thisMonth()).split('-'); var d=new Date(Number(p[0]),Number(p[1])-1+delta,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function latestNisaBefore(date){var arr=(state.nisa||[]).filter(function(r){return String(r.date||'')<=date}); return latestByDate(arr)}
function nisaPrincipalBefore(date){return (state.nisa||[]).filter(function(r){return String(r.date||'')<=date}).reduce(function(a,r){return a+n(r.contribution)},0)}
function nisaValueBefore(date){return n(latestNisaBefore(date).value)}
function otherInvestValue(){return (state.otherInvest||[]).reduce(function(a,r){return a+n(r.value)},0)}
function otherInvestPrincipal(){return (state.otherInvest||[]).reduce(function(a,r){return a+n(r.principal)},0)}
function totalAssetsCurrent(){return n(state.settings.cashNow)+n(state.settings.pointsNow)+nisaValue()+otherInvestValue()}
function totalDebtCurrent(){return loanBalanceNow()+fixedLoanBalanceTotal()}
function netWorthCurrent(){return totalAssetsCurrent()-totalDebtCurrent()}
function totalAssetsAt(date){return n(state.settings.cashNow)+n(state.settings.pointsNow)+nisaValueBefore(date)+otherInvestValue()}
function compareInfo(mode){var cur=totalAssetsCurrent(); if(mode==='mom'){var d=monthEndDate(addMonthsToYM(thisMonth(),-1)); var prev=totalAssetsAt(d); return {label:'前月末比',main:cur-prev,sub:'最新総資産 '+yen(cur),note:'比較日は '+d+'。現金・ポイント・国債等は最新値で比較します。'}} if(mode==='yoy'){var y=Number(today().slice(0,4))-1; var d=y+'-12-31'; var prev=totalAssetsAt(d); return {label:'前年末比',main:cur-prev,sub:'最新総資産 '+yen(cur),note:'比較日は '+d+'。現金・ポイント・国債等は最新値で比較します。'}} return {label:'総資産',main:cur,sub:'純資産 '+yen(netWorthCurrent()),note:'負債は奨学金残高を差し引いて純資産に反映します。'} }
function salaryRecordYM(r){
  r=r||{};
  var raw=String(r.date||r.payDate||r.salaryDate||r.targetDate||r.ym||r.yearMonth||'').trim();
  var hit=raw.match(/^(\d{4})\D?\s*(\d{1,2})(?:\D\s*(\d{1,2}))?/);
  var year=hit?Number(hit[1]):Number(r.year||r.targetYear||r.salaryYear||0);
  var month=hit?Number(hit[2]):Number(r.month||r.targetMonth||r.salaryMonth||0);
  var day=hit&&hit[3]?Number(hit[3]):Number(r.day||1);
  if(!isFinite(year)||year<1900||year>2200||!isFinite(month)||month<1||month>12)return null;
  if(!isFinite(day)||day<1||day>31)day=1;
  return {year:year,month:month,day:day,key:year+'-'+String(month).padStart(2,'0')};
}
function salaryRowHasMonthlyPay(r){return !!(n(r&&r.gross)||n(r&&r.net)||n(r&&r.housing)||n(r&&r.incomeTax)||n(r&&r.residentTax)||n(r&&r.health)||n(r&&r.pension)||n(r&&r.employment))}
function salaryRowsForYear(y){y=Number(y);return (state.salary||[]).filter(function(r){var p=salaryRecordYM(r);return p&&p.year===y})}
function salaryRowsForMonth(y,m){y=Number(y);m=Number(m);return salaryRowsForYear(y).filter(function(r){var p=salaryRecordYM(r);return p&&p.month===m})}
function salaryMonthMap(y){var out={};salaryRowsForYear(y).forEach(function(r){var p=salaryRecordYM(r);if(p&&salaryRowHasMonthlyPay(r))out[p.month]=true});return out}
function yearTotal(y){return salaryRowsForYear(Number(y||today().slice(0,4))).reduce(function(a,r){return a+n(r.gross)+n(r.bonus)},0)}
function fiscalTotal(y){y=Number(y||today().slice(0,4)); return (state.salary||[]).filter(function(r){var p=salaryRecordYM(r);return p&&((p.year===y&&p.month>=4)||(p.year===y+1&&p.month<=3))}).reduce(function(a,r){return a+n(r.gross)+n(r.bonus)},0)}
function currentFiscalYear(){var d=new Date(); return d.getMonth()+1>=4?d.getFullYear():d.getFullYear()-1}
function fiscalSalaryRows(fy){
  fy=Number(fy||currentFiscalYear());
  return (state.salary||[]).filter(function(r){
    var p=salaryRecordYM(r);
    return p&&((p.year===fy&&p.month>=4)||(p.year===fy+1&&p.month<=3));
  });
}
function fiscalSalaryMonthCount(fy){
  var months={};
  fiscalSalaryRows(fy).forEach(function(r){
    if(n(r.gross)||n(r.net)||n(r.bonus)){
      var p=salaryRecordYM(r), k=p&&p.key;
      if(k)months[k]=true;
    }
  });
  return Object.keys(months).length;
}
function salarySummaryHtml(){
  var y=Number(salaryLogYear||today().slice(0,4));
  var count=Object.keys(salaryMonthMap(y)).length;
  if(count<12){
    return '<div class="card salary-summary-waiting"><h2>年収サマリー</h2><div class="summary-grid split-summary"><div class="summary-row"><div class="summary-item"><span>対象年</span><b>'+y+'年</b></div><div class="summary-item"><span>入力状況</span><b>'+count+' / 12か月</b></div></div></div><div class="bar"><i style="width:'+Math.min(100,count/12*100)+'%"></i></div><p class="small salary-summary-note">1月から12月までの給与明細が揃うと、暦年の年収を表示します。同じ月の複数明細は1か月として集計します。</p></div>';
  }
  return '<div class="card salary-summary-complete"><h2>年収サマリー</h2><div class="summary-grid split-summary"><div class="summary-row"><div class="summary-item"><span>'+y+'年の年収</span><b>'+yen(yearTotal(y))+'</b></div><div class="summary-item"><span>入力状況</span><b>12 / 12か月</b></div></div></div><p class="small salary-summary-note">1月から12月までの給与・賞与を合算しています。</p></div>';
}
function goldenBudgets(){var net=n(state.settings.netIncomeManual)||incomeMonth(thisMonth()); return {net:net,rent:net*.26,lifeExRent:net*.24,free:net*.3,save:net*.2}}
function actualMonthlyBudget(){return monthlyFixedCosts()+expenseMonth(thisMonth())}
function budgetRemain(){var g=goldenBudgets(); return g.lifeExRent-actualMonthlyBudget()}
function budgetRatio(){var g=goldenBudgets(); return g.lifeExRent? actualMonthlyBudget()/g.lifeExRent*100:0}

function deltaClass(v){v=n(v); return v>0?'delta-pos':(v<0?'delta-neg':'delta-zero')}
function signedYen(v){v=n(v); var sign=v>0?'+':(v<0?'-':'±'); return sign+yen(Math.abs(v))}
function signedPct(v){v=n(v); var sign=v>0?'+':(v<0?'-':'±'); return sign+pct(Math.abs(v))}
function deltaChip(v){v=n(v); var cls=v>0?'pos':(v<0?'neg':'zero'); return '<span class="delta-chip '+cls+'">'+signedYen(v)+'</span>'}
function deltaText(v){return '<span class="delta-number '+deltaClass(v)+'">'+signedYen(v)+'</span>'}
function deltaPctText(v){return '<span class="'+deltaClass(v)+'">'+signedPct(v)+'</span>'}
function amortizeLoan(balance, annualRate, monthlyPay, prepay, prepayMonth){
  balance=Math.max(0,n(balance)); annualRate=Math.max(0,n(annualRate)); monthlyPay=Math.max(0,n(monthlyPay)); prepay=Math.max(0,n(prepay)); prepayMonth=Math.max(1,Math.round(n(prepayMonth)||1));
  var r=annualRate/100/12, month=0, interest=0, total=0, rows=[], safety=0;
  if(balance<=0)return {months:0,interest:0,total:0,lastBalance:0,rows:[]};
  if(monthlyPay<=0)return {months:0,interest:0,total:0,lastBalance:balance,rows:[]};
  while(balance>1 && safety<1200){
    safety++; month++;
    var intr=balance*r; interest+=intr; balance+=intr;
    var pay=monthlyPay;
    if(prepay>0 && month===prepayMonth) pay+=prepay;
    pay=Math.min(pay,balance);
    balance-=pay; total+=pay;
    if(month<=12 || month%12===0 || balance<=1){rows.push({month:month,balance:balance,interest:interest,total:total});}
    if(r>0 && monthlyPay<=intr && prepay===0){return {months:Infinity,interest:Infinity,total:Infinity,lastBalance:balance,rows:rows,warning:'毎月返済額が利息以下のため完済できません。'};}
  }
  return {months:month,interest:interest,total:total,lastBalance:Math.max(0,balance),rows:rows};
}
function monthLabelFromCount(m){if(!isFinite(m))return '完済不可'; var y=Math.floor(m/12), mo=m%12; if(y&&mo)return y+'年'+mo+'か月'; if(y)return y+'年'; return mo+'か月'}

function inputMoney(v){v=n(v); return v?Math.round(v).toLocaleString('ja-JP'):''}
function formatNumericInput(el){
  if(!el||el.tagName!=='INPUT')return;
  var id=el.id||'';
  var isRate=/rate|safe|ratio|return|percent/i.test(id);
  var isMonth=/month|def|retire|age/i.test(id);
  if(el.getAttribute('inputmode')==='numeric' || el.getAttribute('inputmode')==='decimal'){
    if(el.value==='0')el.value='';
    if(!isRate&&!isMonth&&el.type!=='date'){
      var num=n(el.value);
      if(num)el.value=Math.round(num).toLocaleString('ja-JP');
      if(!el.placeholder)el.placeholder='円';
    }else if(isRate && !el.placeholder){el.placeholder='%'}
    else if(isMonth && !el.placeholder){el.placeholder='月数'}
  }
}
function enhanceInputs(){var inputs=document.querySelectorAll('input[inputmode="numeric"],input[inputmode="decimal"]'); for(var i=0;i<inputs.length;i++){formatNumericInput(inputs[i]);} var dates=document.querySelectorAll('input[type="date"]'); for(var j=0;j<dates.length;j++){dates[j].classList.add('smart-date'); dates[j].removeAttribute('readonly'); dates[j].removeAttribute('inputmode');}}
document.addEventListener('focusin',function(e){if(e.target&&e.target.tagName==='INPUT'&&e.target.value==='0')e.target.value='';});
document.addEventListener('blur',function(e){formatNumericInput(e.target);},true);
document.addEventListener('input',function(e){if((e.target&&e.target.id==='set_rent')||(e.target&&e.target.id==='set_housegross')||(e.target&&e.target.id==='set_houserate')){autoHousingNet();}});
function monthsBetweenDates(start,end){if(!start)return 0; var s=new Date(start), e=end?new Date(end):new Date(); if(isNaN(s.getTime())||isNaN(e.getTime()))return 0; return Math.max(0,(e.getFullYear()-s.getFullYear())*12+(e.getMonth()-s.getMonth()));}
function isBonusMonthFromStart(start,idx){var d=start?new Date(start):new Date(); if(isNaN(d.getTime()))d=new Date(); d.setMonth(d.getMonth()+idx); var m=d.getMonth()+1; return m===1||m===7;}
function simulateCombinedLoan(balance, annualRate, monthlyPay, bonusPay, months, startDate){
  balance=Math.max(0,n(balance)); annualRate=Math.max(0,n(annualRate)); monthlyPay=Math.max(0,n(monthlyPay)); bonusPay=Math.max(0,n(bonusPay)); months=Math.max(0,Math.round(n(months)||0));
  var r=annualRate/100/12, interest=0,total=0, rows=[];
  for(var i=0;i<months && balance>0.5;i++){
    var intr=balance*r; interest+=intr; balance+=intr;
    var pay=monthlyPay+(isBonusMonthFromStart(startDate,i)?bonusPay:0);
    pay=Math.min(pay,balance); balance-=pay; total+=pay;
    if(i<12 || (i+1)%12===0 || balance<=0.5){rows.push({month:i+1,balance:Math.max(0,balance),interest:interest,total:total,bonus:isBonusMonthFromStart(startDate,i)});}
  }
  return {months:months,interest:interest,total:total,lastBalance:Math.max(0,balance),rows:rows};
}
function solveBonusPayment(balance, annualRate, monthlyPay, targetMonths, startDate){
  balance=Math.max(0,n(balance)); targetMonths=Math.min(240,Math.max(1,Math.round(n(targetMonths)||240)));
  if(balance<=0)return 0;
  var noBonus=simulateCombinedLoan(balance,annualRate,monthlyPay,0,targetMonths,startDate);
  if(noBonus.lastBalance<=1)return 0;
  var lo=0, hi=Math.max(balance,100000);
  for(var h=0;h<40;h++){var test=simulateCombinedLoan(balance,annualRate,monthlyPay,hi,targetMonths,startDate); if(test.lastBalance<=1)break; hi*=2;}
  for(var i=0;i<50;i++){var mid=(lo+hi)/2; var sim=simulateCombinedLoan(balance,annualRate,monthlyPay,mid,targetMonths,startDate); if(sim.lastBalance>1)lo=mid; else hi=mid;}
  return Math.ceil(hi);
}
function loanBalanceNow(){
  var s=state&&state.settings?state.settings:{};
  if(s.studentLoanPlanRegistered&&s.studentLoanPlanStart){
    var elapsed=monthsBetweenDates(s.studentLoanPlanStart,new Date());
    var sim=simulateCombinedLoan(s.studentLoanOpeningBalance||s.studentLoanBalance,s.studentLoanRate||0,s.studentLoanMonthly||0,s.studentLoanBonus||0,elapsed,s.studentLoanPlanStart);
    return Math.max(0,sim.lastBalance);
  }
  return n(s.studentLoanBalance);
}

function nextLoanPayments(months){
  var s=state&&state.settings?state.settings:{};
  months=Math.max(1,Math.round(n(months)||12));
  var balance=loanBalanceNow();
  var total=0;
  if(balance>0){
    var monthly=n(s.studentLoanMonthly);
    var bonus=n(s.studentLoanBonus);
    for(var i=0;i<months;i++){
      var d=new Date();
      d.setMonth(d.getMonth()+i);
      var pay=monthly;
      var m=d.getMonth()+1;
      if(m===1||m===7)pay+=bonus;
      total+=pay;
    }
    total=Math.min(balance,total);
  }
  return total;
}
function nextDebtPayments(months){return nextLoanPayments(months)+fixedLoanPayments(months)}

function practicalNetWorthCurrent(){return totalAssetsCurrent()-nextDebtPayments(12)}

function autoHousingNet(){
  var rent=$('set_rent'), gross=$('set_housegross'), rate=$('set_houserate'), net=$('set_house');
  if(!rent||!gross||!rate||!net)return;
  var calc=Math.min(n(rent.value), n(gross.value)*(n(rate.value)||80)/100);
  net.value=calc?Math.round(calc).toLocaleString('ja-JP'):'';
}

function currentAutoAge(){
  var s=state&&state.settings?state.settings:{};
  if(s.birthYearEstimate){
    var d=new Date(), y=d.getFullYear(), passed=(d.getMonth()+1>9 || (d.getMonth()+1===9 && d.getDate()>=10));
    return Math.max(0, y - n(s.birthYearEstimate) - (passed?0:1));
  }
  return n(s.currentAge);
}

function pad2(v){return String(v).padStart(2,'0')}
function formatDateTime(v){
  if(!v)return '未実施';
  var d=new Date(v);
  if(isNaN(d.getTime()))return '未実施';
  return d.getFullYear()+'/'+pad2(d.getMonth()+1)+'/'+pad2(d.getDate())+' '+pad2(d.getHours())+':'+pad2(d.getMinutes());
}
function daysSince(v){
  if(!v)return null;
  var d=new Date(v);
  if(isNaN(d.getTime()))return null;
  return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000));
}
function hasThisMonth(arr){
  var m=thisMonth();
  return (arr||[]).some(function(r){return ym(r.date)===m});
}
function countThisMonth(arr){
  var m=thisMonth();
  return (arr||[]).filter(function(r){return ym(r.date)===m}).length;
}
function backupFreshText(){
  var at=state&&state.settings?state.settings.lastBackupAt:'';
  var d=daysSince(at);
  if(d===null)return {ok:false,label:'未実施',sub:'まだバックアップ記録がありません'};
  return {ok:d<=14,label:d===0?'今日':d+'日前',sub:'最終バックアップ '+formatDateTime(at)};
}
function taskButton(done,title,sub,action){
  var mark=done
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l4.2 4.2L19.5 6.8"></path></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5v9"></path><path d="M12 18.5h.01"></path></svg>';
  var arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l6 7-6 7"></path></svg>';
  return '<button class="ux-task-row '+(done?'done':'todo')+'" type="button" data-click="'+action+'"><span class="ux-task-mark">'+mark+'</span><span class="ux-task-copy"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></span><span class="ux-task-chevron">'+arrow+'</span></button>';
}
function monthlyStatusCard(){
  var tx=countThisMonth(state.transactions), sal=hasThisMonth(state.salary), ni=hasThisMonth(state.nisa);
  var html='<div class="card ux-status-card"><div class="status-title-block"><h2>今月の入力状況</h2><span>'+esc(thisMonth().replace('-','/'))+'</span></div><div class="ux-task-list">';
  html+=taskButton(tx>0,'収支入力',tx>0?tx+'件入力済み':'今月の収支が未入力です','jumpTo(\'entry\',\'txInputTitle\')');
  html+=taskButton(sal,'給与明細',sal?'今月分を入力済み':'今月の給与明細が未入力です','jumpTo(\'salary\',\'salaryTitle\')');
  html+=taskButton(ni,'NISA月次',ni?'今月分を入力済み':'今月のNISA月次が未入力です','jumpTo(\'invest\',\'nisaInputTitle\',\'nisa\')');
  html+='</div></div>';
  return html;
}
function actionCard(page){
  return '';
}
window.dismissAction=function(){nextAction=null;}
function setAction(page,title,buttons){nextAction=null;}
function findById(arr,id){return (state[arr]||[]).filter(function(x){return x.id===id})[0]||null}
function ensureAppConfirm(){
  var modal=$('appConfirm');
  if(modal)return modal;
  return null;
}
function showAppConfirm(message,onConfirm,options){
  var modal=ensureAppConfirm();
  if(!modal){
    visibleError('確認画面を開けないため、操作を中止しました。');
    return;
  }
  options=options||{};
  pendingConfirmAction=typeof onConfirm==='function'?onConfirm:null;
  var msg=$('appConfirmMessage'), title=$('appConfirmTitle');
  var confirmBtn=modal.querySelector?modal.querySelector('.app-confirm-actions .danger'):null;
  if(msg)msg.textContent=message||'この項目を削除しますか？';
  if(title)title.textContent=options.title||'削除しますか？';
  if(confirmBtn)confirmBtn.textContent=options.confirmLabel||'削除';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('confirm-open');
}
window.resolveAppConfirm=async function(ok){
  var modal=ensureAppConfirm();
  if(modal){modal.classList.add('hidden');modal.setAttribute('aria-hidden','true')}
  document.body.classList.remove('confirm-open');
  var action=pendingConfirmAction;
  pendingConfirmAction=null;
  if(ok&&typeof action==='function')await action();
}
function findRenderedItemById(id){
  var nodes=document.querySelectorAll('[data-id]');
  for(var i=0;i<nodes.length;i++){
    if(String(nodes[i].dataset&&nodes[i].dataset.id||'')!==String(id))continue;
    var row=nodes[i].closest&&nodes[i].closest('.listitem,.salary-history-item,.investment-history-item,.special-item,.fixed-item,.tx-item,.repayment-row');
    if(row)return row;
  }
  return null;
}
function animateItemRemoval(id,done){
  var row=findRenderedItemById(id);
  if(!row){if(typeof done==='function')done();return}
  var rect=row.getBoundingClientRect();
  row.style.height=Math.max(1,rect.height)+'px';
  row.style.maxHeight=Math.max(1,rect.height)+'px';
  row.style.overflow='hidden';
  row.style.transformOrigin='center center';
  void row.offsetHeight;
  requestAnimationFrame(function(){row.classList.add('item-removing')});
  setTimeout(function(){if(typeof done==='function')done()},175);
}
function deleteItem(arr,id,message,after){
  showAppConfirm(message||'この項目を削除しますか？',async function(){
    await new Promise(function(resolve){animateItemRemoval(id,resolve)});
    state[arr]=(state[arr]||[]).filter(function(x){return x.id!==id});
    if(arr==='salary')state.settings.furusatoFinalConfirmed=false;
    if(!await save()){renderPage(currentPage);return;}
    toast('削除しました');
    if(typeof after==='function')await after();
  });
}
window.resetAllInputData=function(){
  showAppConfirm('入力情報をすべて初期状態に戻します。先にバックアップを保存してください。',async function(){
    var candidate=security.validateState(emptyState());
    try{await vault.save(candidate);state=candidate;normalizeState();lastGoodState=cloneState(state);backupCache=null;pageScrolls={};editingSpecialId='';editingFixedCostId='';editingTransactionId='';tools();toast('入力情報をリセットしました');}
    catch(e){visibleError(e.message);}
  },{title:'入力情報をリセットしますか？',confirmLabel:'リセット'});
};

function birthYearFromAge(age){
  var d=new Date(), y=d.getFullYear(), passed=(d.getMonth()+1>9 || (d.getMonth()+1===9 && d.getDate()>=10));
  return y - n(age) - (passed?0:1);
}
window.setDashMode=function(m){dashMode=m; dash();}
function animateTwoChoice(selector,toRight,done){
  var el=document.querySelector(selector);
  if(!el){if(typeof done==='function')done();return;}
  if(tabSwitchTimer)clearTimeout(tabSwitchTimer);
  el.classList.toggle('choice-right',!!toRight);
  el.classList.toggle('choice-left',!toRight);
  var buttons=el.querySelectorAll('button');
  if(buttons.length>=2){
    buttons[0].classList.toggle('active',!toRight);
    buttons[0].setAttribute('aria-selected',toRight?'false':'true');
    buttons[1].classList.toggle('active',!!toRight);
    buttons[1].setAttribute('aria-selected',toRight?'true':'false');
  }
  tabSwitchTimer=setTimeout(function(){tabSwitchTimer=null;if(typeof done==='function')done();},210);
}
window.setDashBreakdown=function(m){
  if(m===dashBreakdown)return;
  animateTwoChoice('.breakdown-card .animated-choice',m==='goal',function(){dashBreakdown=m;dash();});
}
window.openNisa=function(){jumpTo('invest',null,'nisa')}
window.openOtherInvest=function(){jumpTo('invest',null,'other')}
window.goInvestGraph=function(){jumpTo('invest','nisaGraphCard','nisa')}

function playAmountHighlightOnce(){
  if(amountHighlightPlayed||!amountHighlightPending)return;
  var amount=document.querySelector('.hero-amount b.highlight-pending');
  if(!amount)return;
  amountHighlightPlayed=true;
  amountHighlightPending=false;
  amount.getBoundingClientRect();
  amount.classList.add('opening-highlight');
}

function dash(){
  setTitle('資産','すべての資産が、一目で分かる');
  var m=thisMonth(), inc=incomeMonth(m), exp=expenseMonth(m), net=inc-exp;
  var cash=n(state.settings.cashNow), points=n(state.settings.pointsNow), loan=loanBalanceNow(), otherDebt=fixedLoanBalanceTotal(), principal=nisaPrincipal(), value=nisaValue(), profit=value-principal;
  var other=otherInvestValue(), otherPrincipal=otherInvestPrincipal();
  var total=totalAssetsCurrent(), accountingNet=netWorthCurrent(), practical=practicalNetWorthCurrent(), debt12=nextDebtPayments(12), debts=totalDebtCurrent(), totalProfit=profit+(other-otherPrincipal);
  var mom=compareInfo('mom'), yoy=compareInfo('yoy');
  function cmpClass(v){return n(v)>=0?'':'down'}
  function mini(label,val){return '<div class="mini"><span>'+label+'</span><b class="'+deltaClass(val)+'">'+signedYen(val)+'</b></div>'}
  function heroStat(label,val,cls){return '<div class="hero-stat"><span>'+label+'</span><b class="'+(cls||'')+'">'+val+'</b></div>'}
  var html='';
  var amountClass=' permanent-highlight';
  html+='<div class="hero card practical-card"><div class="hero-amount"><div class="label">生活上の実質資産</div><b class="'+amountClass+'"><span>'+yen(practical)+'</span></b></div><div class="compare-mini">'+mini('前月末比',mom.main)+mini('前年末比',yoy.main)+'</div></div>';
  html+='<div class="card asset-summary-card"><h2 class="center-topic-title">資産サマリー</h2><div class="summary-grid"><div class="summary-row"><div class="summary-item"><span>総資産</span><b>'+yen(total)+'</b></div><div class="summary-item"><span>1年間での返済額</span><b class="dangerText">-'+yen(debt12)+'</b></div></div><div class="summary-row"><div class="summary-item"><span>会計上の純資産</span><b>'+yen(accountingNet)+'</b></div><div class="summary-item"><span>負債残高合計</span><b class="dangerText">-'+yen(debts)+'</b></div></div></div><div class="explain-box">生活上の実質資産＝総資産−1年間での返済額。会計上の純資産＝総資産−負債残高合計です。負債には奨学金と、固定費の「ローン返済」に登録した残高を含めます。</div><div style="text-align:center"><button class="graph-btn" data-click="goInvestGraph()">グラフを確認する</button></div></div>';
  html+='<p class="small compare-note" style="margin:0 4px 8px">前月末比・前年末比は、NISA月次データの月末評価額を使った概算です。現金・ポイント・その他投資は最新値で比較します。</p>';
  html+=monthlyStatusCard();
  html+='<div class="card segment-card breakdown-card"><h2 class="breakdown-title">内訳</h2><div class="switch animated-choice '+(dashBreakdown==='goal'?'choice-right':'choice-left')+'"><button class="'+(dashBreakdown==='asset'?'active':'')+'" data-click="setDashBreakdown(\'asset\')">資産ごと</button><button class="'+(dashBreakdown==='goal'?'active':'')+'" data-click="setDashBreakdown(\'goal\')">目的ごと</button></div><div style="padding:0 14px 14px"><button class="wide-blue" data-click="show(\'entry\')">＋ 入力を追加する</button></div>';
  if(dashBreakdown==='asset'){
    html+='<div style="padding:0 14px 12px">';
    html+='<div class="asset-card has-open"><button class="asset-open" type="button" aria-label="NISAを開く" data-click="openNisa()"><svg class="jump-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l6 7-6 7"></path></svg></button><div class="name">NISA</div><div class="value">'+yen(value)+'</div><div class="sub">評価損益 '+deltaText(profit)+'</div></div>';
    html+='<div class="asset-card"><div class="name">現金預金</div><div class="value">'+yen(cash)+'</div><div class="sub">生活防衛資金に含める現金</div></div>';
    html+='<div class="asset-card"><div class="name">ポイント</div><div class="value">'+yen(points)+'</div><div class="sub">現金相当として総資産に含めます</div></div>';
    html+='<div class="asset-card has-open"><button class="asset-open" type="button" aria-label="国債・個別株などを開く" data-click="openOtherInvest()"><svg class="jump-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l6 7-6 7"></path></svg></button><div class="name">国債・個別株など</div><div class="value">'+yen(other)+'</div><div class="sub">評価損益 '+deltaText(other-otherPrincipal)+'</div></div>';
    html+='<div class="asset-card"><div class="name">奨学金残高</div><div class="value dangerText">-'+yen(loan)+'</div><div class="sub">純資産では差し引き</div></div><div class="asset-card"><div class="name">その他ローン残高</div><div class="value dangerText">-'+yen(otherDebt)+'</div><div class="sub">固定費のローン返済から反映</div></div>';
    html+='<div class="asset-card"><div class="name">生活防衛資金</div><div class="value">'+monthText(defenseMonths())+'</div><div class="sub">NISA評価額100%込み</div></div>';
    html+='</div>';
  }else{
    var target=monthlyExpenseBase()*n(state.settings.defenseMonths); var short=Math.max(0,target-defenseAsset());
    var specials=(state.specials||[]).map(function(s){var need=Math.max(0,n(s.target)-n(s.current)); return '<div class="goal-card"><span class="small">特別支出</span><b>'+esc(s.name||'項目')+'</b><div class="small">現在 '+yen(s.current)+' / 目標 '+yen(s.target)+' / 不足 '+yen(need)+'</div></div>'}).join('') || '<p class="small">目的別の積立はまだありません。</p>';
    html+='<div class="goal-panel"><div class="goal-card"><span class="small">生活防衛資金</span><b>'+monthText(defenseMonths())+'</b><div class="small">目標まで残り '+yen(short)+'。NISA評価額100%込みで計算しています。</div></div><div class="goal-card"><span class="small">NISA積立</span><b>'+yen(latestNisa().contribution||0)+'/月</b><div class="small">積立増額シミュレーションは設定ページで確認できます。</div></div>'+specials+'<div class="btnrow"><button data-click="show(\'life\')">積立・サブスクを編集</button></div></div>';
  }
  html+='</div>';
  html+='<div class="card quick-tools-card"><h2 class="centered-section-title">よく使う機能</h2><div class="shortcut-grid"><button class="secondary" data-click="jumpTo(\'invest\',\'nisaInputTitle\',\'nisa\')">NISA入力へ</button><button class="secondary" data-click="jumpTo(\'salary\',\'salaryTitle\')">給与明細へ</button><button class="secondary" data-click="jumpTo(\'tools\',\'furusatoTitle\')">ふるさと納税へ</button><button class="secondary" data-click="jumpTo(\'tools\',\'taxSimTitle\')">税金試算へ</button><button class="secondary" data-click="jumpTo(\'life\',\'specialTitle\')">特別支出積立へ</button><button class="secondary" data-click="jumpTo(\'life\',\'fixedCostTitle\')">固定費へ</button></div><p class="shortcut-note">各ボタンを押すと、該当項目のタイトルが見える上部位置へ直接移動します。</p></div>';
  html+='<div class="card nisa-trend-card"><h2 class="centered-section-title">NISA推移</h2>'+nisaChart()+'<p class="small">縦軸は金額、横軸は年月です。</p></div>';
  $('app').innerHTML=html;
}



function entry(){
  setTitle('収支','収支入力・最近の収支');
  var html='';
  html+=actionCard('entry');
  html+='<div id="txInputCard" class="card"><h2 id="txInputTitle">収支入力</h2><div class="quick-preset"><button type="button" data-click="fillTxPreset(\'昼食\',\'食費\',\'変動費\',\'支出\')">昼食</button><button type="button" data-click="fillTxPreset(\'ガソリン\',\'車\',\'変動費\',\'支出\')">ガソリン</button><button type="button" data-click="fillTxPreset(\'医療費\',\'医療費\',\'変動費\',\'支出\')">医療費</button><button type="button" data-click="fillTxPreset(\'日用品\',\'日用品\',\'変動費\',\'支出\')">日用品</button><button type="button" data-click="fillTxPreset(\'外食\',\'食費\',\'変動費\',\'支出\')">外食</button><button type="button" data-click="fillTxPreset(\'サブスク\',\'固定費\',\'固定費\',\'支出\')">サブスク</button></div><div class="row"><div><label>日付</label><input id="tx_date" type="date" value="'+today()+'"></div><div><label>収入/支出</label><select id="tx_type"><option>支出</option><option>収入</option></select></div></div><div class="row"><div><label>カテゴリ</label><input id="tx_cat" placeholder="食費・スマホ・給与など"></div><div><label>固定費/変動費</label><select id="tx_kind"><option>変動費</option><option>固定費</option></select></div></div><label>金額</label><input id="tx_amount" inputmode="numeric" placeholder="円"><label>メモ</label><input id="tx_memo" placeholder="任意"><div class="btnrow"><button data-click="addTx()">追加</button></div></div>';
  html+='<div class="card"><h2>最近の収支</h2>'+listTx()+'</div>';
  $('app').innerHTML=html;
}
function salaryPage(){
  setTitle('給与','給与明細・年収サマリー');
  var html='';
  html+=actionCard('salary');
  html+='<div id="salaryCard" class="card"><h2 id="salaryTitle">給与明細</h2><div class="row"><div><label>年月日</label><input id="sal_date" type="date" value="'+today()+'"></div><div><label>額面</label><input id="sal_gross" inputmode="numeric" placeholder="円"></div></div><div class="row"><div><label>手取り</label><input id="sal_net" inputmode="numeric" placeholder="円"></div><div><label>賞与</label><input id="sal_bonus" inputmode="numeric" placeholder="円"></div></div><div class="row"><div><label>所得税</label><input id="sal_tax" inputmode="numeric" placeholder="円"></div><div><label>住民税</label><input id="sal_resident" inputmode="numeric" placeholder="円"></div></div><div class="row"><div><label>健康保険</label><input id="sal_health" inputmode="numeric" placeholder="円"></div><div><label>厚生年金</label><input id="sal_pension" inputmode="numeric" placeholder="円"></div></div><div class="row"><div><label>雇用保険</label><input id="sal_employ" inputmode="numeric" placeholder="円"></div><div><label>住宅手当</label><input id="sal_house" inputmode="numeric" placeholder="円"></div></div><label>メモ</label><input id="sal_memo" placeholder="任意"><div class="btnrow"><button type="button" data-click="addSalary()">給与明細を追加</button></div></div>';
  html+='<div class="card salary-period-card"><h2>給与明細ログ</h2>'+salaryPeriodSelectorHtml()+'<div id="salaryLogResults">'+listSalary()+'</div></div>';
  html+=salarySummaryHtml();
  $('app').innerHTML=html;
  setTimeout(function(){enhanceInputs();centerSelectedSalaryMonth()},0);
}
window.fillTxPreset=function(memo,cat,kind,type){
  var m=$('tx_memo'), c=$('tx_cat'), k=$('tx_kind'), t=$('tx_type'), a=$('tx_amount');
  if(c)c.value=cat||'';
  if(k)k.value=kind||'変動費';
  if(t)t.value=type||'支出';
  if(m)m.value=memo||'';
  if(a)a.focus();
}
window.addTx=async function(){
  var row={id:uid(),date:$('tx_date').value||today(),type:$('tx_type').value||'支出',amount:n($('tx_amount').value),category:$('tx_cat').value||'',kind:$('tx_kind').value||'変動費',memo:$('tx_memo').value||''};
  state.transactions.push(row);if(!await save())return;
  setAction('entry','収支を保存しました',[{label:'続けて入力',action:'jumpTo(\'entry\',\'txInputTitle\')'},{label:'トップへ',action:'show(\'dash\')'}]);entry();enhanceInputs();
  showSavedVisual('収支を追加しました',[{label:'日付',value:dateText(row.date)},{label:'金額',value:moneyText(row.amount)},{label:'カテゴリ',value:row.category||'未分類'}]);toast('収支を追加しました');
}
window.editTxById=function(id){editingTransactionId=id;entry();setTimeout(function(){var el=$('edit_tx_'+id);if(el&&el.scrollIntoView)el.scrollIntoView({block:'center'})},30)}
window.cancelTxEdit=function(){editingTransactionId='';entry()}
window.saveTxEdit=async function(btn){
  var id=btn&&btn.dataset?btn.dataset.id:'', before=(state.transactions||[]).map(function(r){return Object.assign({},r)});
  var date=$('edit_tx_date_'+id),type=$('edit_tx_type_'+id),category=$('edit_tx_cat_'+id),kind=$('edit_tx_kind_'+id),amount=$('edit_tx_amount_'+id),memo=$('edit_tx_memo_'+id);
  state.transactions=(state.transactions||[]).map(function(r){if(r.id===id){r.date=(date&&date.value)||r.date||today();r.type=(type&&type.value)||r.type||'支出';r.category=(category&&category.value)||'';r.kind=(kind&&kind.value)||'変動費';r.amount=n(amount&&amount.value);r.memo=(memo&&memo.value)||''}return r});
  if(!await save()){state.transactions=before;entry();return}
  editingTransactionId='';entry();toast('収支を保存しました');
}
window.delTxById=function(id){var r=findById('transactions',id); var msg='この収支を削除しますか？\n\n'+(r?(r.date+' '+(r.type||'')+' '+(r.category||'未分類')+' '+yen(r.amount)):'選択した収支'); deleteItem('transactions',id,msg,function(){if(editingTransactionId===id)editingTransactionId='';entry()})}
function listTx(){
  var arr=(state.transactions||[]).slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date))}).slice(0,20);
  if(!arr.length)return '<p class="small">入力なし</p>';
  return arr.map(function(r){
    if(editingTransactionId===r.id){
      return '<div id="edit_tx_'+esc(r.id)+'" class="listitem tx-item fixed-editing"><div class="edit-box fixed-edit-box"><label>日付</label><input id="edit_tx_date_'+esc(r.id)+'" type="date" value="'+esc(r.date||today())+'"><div class="row"><div><label>収入/支出</label><select id="edit_tx_type_'+esc(r.id)+'"><option'+(r.type==='支出'?' selected':'')+'>支出</option><option'+(r.type==='収入'?' selected':'')+'>収入</option></select></div><div><label>固定費/変動費</label><select id="edit_tx_kind_'+esc(r.id)+'"><option'+(r.kind==='変動費'?' selected':'')+'>変動費</option><option'+(r.kind==='固定費'?' selected':'')+'>固定費</option></select></div></div><label>カテゴリ</label><input id="edit_tx_cat_'+esc(r.id)+'" value="'+esc(r.category||'')+'"><label>金額</label><input id="edit_tx_amount_'+esc(r.id)+'" inputmode="numeric" value="'+inputMoney(r.amount)+'" placeholder="円"><label>メモ</label><input id="edit_tx_memo_'+esc(r.id)+'" value="'+esc(r.memo||'')+'"><div class="btnrow"><button type="button" data-id="'+esc(r.id)+'" data-click="saveTxEdit(this)">保存</button><button class="secondary" type="button" data-click="cancelTxEdit()">キャンセル</button></div></div></div>';
    }
    var sign=r.type==='収入'?'+':'-';
    var cls=r.type==='収入'?'delta-pos':'delta-neg';
    var typeTag=r.type==='収入'?'<span class="pill income-pill">収入</span>':'';
    return '<div class="listitem tx-item"><div class="tx-head"><div>'+typeTag+'<b class="tx-title">'+esc(r.category||'未分類')+'</b></div><b class="right '+cls+'">'+sign+yen(r.amount)+'</b></div><div class="small">'+esc(r.date)+' / '+esc(r.kind||'')+(r.memo?' / '+esc(r.memo):'')+'</div><div class="item-actions"><button class="secondary" type="button" data-id="'+esc(r.id)+'" data-click="editTxById(this.dataset.id)">編集</button><button class="secondary" type="button" data-id="'+esc(r.id)+'" data-click="delTxById(this.dataset.id)">削除</button></div></div>';
  }).join('');
}
window.addSalary=async function(){
  var salaryDate=$('sal_date').value||today();
  var row={id:uid(),date:salaryDate,gross:n($('sal_gross').value),net:n($('sal_net').value),incomeTax:n($('sal_tax').value),residentTax:n($('sal_resident').value),health:n($('sal_health').value),pension:n($('sal_pension').value),employment:n($('sal_employ').value),housing:n($('sal_house').value),bonus:n($('sal_bonus').value),memo:$('sal_memo').value||''};
  state.salary.push(row);
  if(String(salaryDate).slice(0,4)===today().slice(0,4))state.settings.furusatoFinalConfirmed=false;
  if(!await save())return;
  var p=salaryRecordYM(row);salaryLogYear=p.year;salaryLogMonth=p.month;
  setAction('salary','給与明細を保存しました',[{label:'税金試算へ',action:'jumpTo(\'tools\',\'taxSimTitle\')'},{label:'トップへ',action:'show(\'dash\')'}]); salaryPage();
  showSavedVisual('給与明細を追加しました',[{label:'対象月',value:monthDisplay(p.year,p.month)},{label:'手取り',value:moneyText(row.net)},{label:'支給額',value:moneyText(n(row.gross)+n(row.bonus))}]);toast('給与明細を追加しました');
}
window.delSalaryById=function(id){var r=findById('salary',id);deleteItem('salary',id,'この給与明細を削除しますか？'+(r?'\n'+r.date+' 手取り '+yen(r.net):''),salaryPage);}
function salaryPeriodSelectorHtml(){
  var months='';
  for(var m=1;m<=12;m++)months+='<button type="button" class="salary-month-button '+(m===Number(salaryLogMonth)?'selected':'')+'" data-month="'+m+'" aria-pressed="'+(m===Number(salaryLogMonth)?'true':'false')+'" data-click="selectSalaryMonth">'+m+'月</button>';
  return '<div class="salary-year-row"><label class="salary-year-select-wrap" aria-label="表示年を選択"><span class="salary-year-cue" aria-hidden="true">›</span><select id="salaryYearSelect" class="salary-year-select" data-change="selectSalaryYear(this.value)">'+salaryYearOptionsHtml()+'</select></label></div><div class="salary-month-strip" id="salaryMonthStrip">'+months+'</div>';
}
function salaryYearOptionsHtml(){
  var current=(new Date()).getFullYear(), years={};
  for(var y=current-5;y<=current+1;y++)years[y]=true;
  (state.salary||[]).forEach(function(r){var p=salaryRecordYM(r);if(p)years[p.year]=true});
  years[Number(salaryLogYear)]=true;
  return Object.keys(years).map(Number).sort(function(a,b){return b-a}).map(function(y){return '<option value="'+y+'"'+(y===Number(salaryLogYear)?' selected':'')+'>'+y+'年</option>'}).join('');
}
function centerSelectedSalaryMonth(){var strip=$('salaryMonthStrip'),sel=strip&&strip.querySelector('.salary-month-button.selected');if(!strip||!sel)return;var left=sel.offsetLeft-(strip.clientWidth-sel.offsetWidth)/2;try{strip.scrollTo({left:Math.max(0,left),behavior:'smooth'})}catch(e){strip.scrollLeft=Math.max(0,left)}}
window.selectSalaryMonth=function(month,btn){
  month=Math.max(1,Math.min(12,Number(month)||1));
  var old=document.querySelector('.salary-month-button.selected');
  if(old===btn)return;
  if(old){old.classList.remove('selected');old.setAttribute('aria-pressed','false')}
  salaryLogMonth=month;
  if(btn){btn.classList.add('selected');btn.setAttribute('aria-pressed','true')}
  var results=$('salaryLogResults');if(results)results.innerHTML=listSalary();
  enhanceInputs();
}
window.selectSalaryYear=function(year){
  salaryLogYear=Math.max(1900,Math.min(2200,Number(year)||Number(salaryLogYear)));
  var map=salaryMonthMap(salaryLogYear), available=Object.keys(map).map(Number).sort(function(a,b){return a-b});
  if(available.length&&available.indexOf(Number(salaryLogMonth))<0)salaryLogMonth=available[available.length-1];
  else if(!available.length&&salaryLogYear===(new Date()).getFullYear())salaryLogMonth=(new Date()).getMonth()+1;
  salaryPage();
}
function listSalary(){
  var arr=salaryRowsForMonth(salaryLogYear,salaryLogMonth).slice().sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))});
  if(!arr.length)return '<div class="salary-empty">この月の給与明細はありません。</div>';
  return '<div class="salary-history-list">'+arr.map(function(r){
    return '<div class="salary-history-item"><div class="salary-history-head"><span class="salary-history-date">'+esc(r.date)+'</span><b class="salary-history-value">手取り '+yen(r.net)+'</b></div><div class="salary-history-main"><span>額面 '+yen(r.gross)+'</span>'+(n(r.bonus)?'<span>賞与 '+yen(r.bonus)+'</span>':'')+'</div><div class="salary-history-meta"><span>所得税 '+yen(r.incomeTax)+'</span><span>住民税 '+yen(r.residentTax)+'</span><span>健康保険 '+yen(r.health)+'</span><span>厚生年金 '+yen(r.pension)+'</span><span>雇用保険 '+yen(r.employment)+'</span><span>住宅手当 '+yen(r.housing)+'</span></div>'+(r.memo?'<div class="salary-history-memo">'+esc(r.memo)+'</div>':'')+'<div class="salary-history-actions"><button class="secondary" type="button" data-id="'+esc(r.id)+'" data-click="delSalaryById(this.dataset.id)">削除</button></div></div>';
  }).join('')+'</div>';
}
function metric(label,value,cls){return '<div class="metric"><span>'+esc(label)+'</span><b class="'+(cls||'')+'">'+value+'</b></div>'}
window.showNisaPoint=function(date,label,amount,ev){
  try{
    if(ev){if(ev.preventDefault)ev.preventDefault();if(ev.stopPropagation)ev.stopPropagation()}
    var info=$('nisaPointInfo');
    if(!info)return;
    info.innerHTML='<span class="nisa-point-date">'+esc(date)+'</span><span class="nisa-point-label">'+esc(label)+'</span><b>'+esc(amount)+'</b>';
    info.classList.add('show');
  }catch(e){setDebug(String(e&&e.stack||e))}
}
window.showNisaPointFromEl=function(el,ev){
  if(!el)return;
  var all=document.querySelectorAll('.nisa-chart .chart-hit');
  for(var i=0;i<all.length;i++){
    all[i].classList.remove('selected');
    all[i].setAttribute('aria-pressed','false');
  }
  el.classList.add('selected');
  el.setAttribute('aria-pressed','true');
  window.showNisaPoint(el.getAttribute('data-date')||'',el.getAttribute('data-label')||'',el.getAttribute('data-amount')||'',ev);
}
function nisaRangeTabsHtml(){
  return '<div class="nisa-range-tabs" role="tablist" aria-label="NISAグラフ表示期間">'
    +'<button type="button" role="tab" aria-selected="'+(nisaChartRange==='1y'?'true':'false')+'" class="'+(nisaChartRange==='1y'?'active':'')+'" data-click="setNisaChartRange(\'1y\')">1年</button>'
    +'<button type="button" role="tab" aria-selected="'+(nisaChartRange==='3y'?'true':'false')+'" class="'+(nisaChartRange==='3y'?'active':'')+'" data-click="setNisaChartRange(\'3y\')">3年</button>'
    +'<button type="button" role="tab" aria-selected="'+(nisaChartRange==='all'?'true':'false')+'" class="'+(nisaChartRange==='all'?'active':'')+'" data-click="setNisaChartRange(\'all\')">全期間</button>'
    +'</div>';
}
window.setNisaChartRange=function(range){
  if(['1y','3y','all'].indexOf(range)<0||range===nisaChartRange)return;
  nisaChartRange=range;
  if(currentPage==='dash')dash();
  else invest();
}
function nisaChart(){
  var controls=nisaRangeTabsHtml();
  var all=(state.nisa||[]).slice().sort(function(a,b){return String(a.date).localeCompare(String(b.date))});
  if(all.length<2)return controls+'<p class="small">NISA月次を2件以上入力すると表示されます。</p>';
  var cumulative=0,monthlyLatest={};
  all.forEach(function(row){
    cumulative+=n(row.contribution);
    var key=ym(row.date);
    monthlyLatest[key]={row:row,principal:cumulative,month:key};
  });
  var monthly=Object.keys(monthlyLatest).sort().map(function(key){return monthlyLatest[key]});
  if(monthly.length<2)return controls+'<p class="small">異なる月のNISA記録を2か月以上入力すると表示されます。</p>';
  function monthNumber(key){var p=String(key).split('-');return Number(p[0])*12+Number(p[1])-1}
  var endMonth=monthNumber(monthly[monthly.length-1].month);
  var rangeMonths=nisaChartRange==='1y'?12:(nisaChartRange==='3y'?36:0);
  var arr=rangeMonths?monthly.filter(function(item){return monthNumber(item.month)>=endMonth-rangeMonths+1}):monthly;
  if(arr.length<2)return controls+'<p class="small">選択した期間内に、異なる月の記録が2件以上必要です。</p>';
  var W=640,H=320,L=72,R=26,T=46,B=58;
  var vals=[],ptsPrincipal=[],ptsValue=[],labels=[];
  for(var i=0;i<arr.length;i++){
    vals.push(arr[i].principal,n(arr[i].row.value));
    ptsPrincipal.push(arr[i].principal);
    ptsValue.push(n(arr[i].row.value));
    labels.push(arr[i].month);
  }
  var max=Math.max.apply(null,vals.concat([1])),min=Math.min.apply(null,vals.concat([0]));
  if(max===min){max+=1;min-=1}
  var span=max-min;max+=span*.16;min-=span*.10;
  function xy(v,i){var x=L+(W-L-R)*(i/(arr.length-1));var y=T+(H-T-B)*(1-(v-min)/(max-min||1));return [x,y]}
  function poly(list){return list.map(function(v,i){var p=xy(v,i);return p[0].toFixed(1)+','+p[1].toFixed(1)}).join(' ')}
  function yPos(v){return T+(H-T-B)*(1-(v-min)/(max-min||1))}
  function shortY(v){var a=Math.abs(v);if(a>=100000000)return (v/100000000).toFixed(1)+'億';if(a>=10000)return Math.round(v/10000)+'万';return Math.round(v).toString()}
  var ticks=[min,(min+max)/2,max],grid='';
  for(var t=0;t<ticks.length;t++){
    var y=yPos(ticks[t]);
    grid+='<line x1="'+L+'" y1="'+y.toFixed(1)+'" x2="'+(W-R)+'" y2="'+y.toFixed(1)+'" class="chart-grid"/><text x="'+(L-10)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" class="chart-axis-label">'+shortY(ticks[t])+'</text>';
  }
  var xlabels='',step=Math.max(1,Math.ceil(labels.length/4));
  for(var j=0;j<labels.length;j+=step){var p=xy(ptsPrincipal[j],j);xlabels+='<text x="'+p[0].toFixed(1)+'" y="'+(H-22)+'" text-anchor="middle" class="chart-axis-label">'+esc(labels[j].slice(2).replace('-','/'))+'</text>'}
  var last=labels.length-1;
  if((last%step)!==0){var p2=xy(ptsPrincipal[last],last);xlabels+='<text x="'+p2[0].toFixed(1)+'" y="'+(H-22)+'" text-anchor="middle" class="chart-axis-label">'+esc(labels[last].slice(2).replace('-','/'))+'</text>'}
  var points='';
  var maxMarkers=nisaChartRange==='1y'?12:18;
  var markerCount=Math.min(maxMarkers,arr.length),markerIndexes={};
  for(var marker=0;marker<markerCount;marker++){
    var markerIndex=markerCount===1?0:Math.round(marker*(arr.length-1)/(markerCount-1));
    markerIndexes[markerIndex]=true;
  }
  for(var k=0;k<arr.length;k++){
    if(!markerIndexes[k])continue;
    var pv=xy(ptsValue[k],k),pp=xy(ptsPrincipal[k],k);
    points+='<g class="chart-hit" role="button" tabindex="0" aria-pressed="false" data-date="'+esc(arr[k].row.date)+'" data-label="元本" data-amount="'+esc(yen(ptsPrincipal[k]))+'" aria-label="'+esc(arr[k].row.date)+' 元本 '+yen(ptsPrincipal[k])+'" data-click="showNisaPointFromEl(this,event)" data-keydown="nisaPointKey"><circle cx="'+pp[0].toFixed(1)+'" cy="'+pp[1].toFixed(1)+'" r="17" class="chart-hit-target"></circle><circle cx="'+pp[0].toFixed(1)+'" cy="'+pp[1].toFixed(1)+'" r="4.8" class="chart-point principal"></circle></g>';
    points+='<g class="chart-hit" role="button" tabindex="0" aria-pressed="false" data-date="'+esc(arr[k].row.date)+'" data-label="評価額" data-amount="'+esc(yen(ptsValue[k]))+'" aria-label="'+esc(arr[k].row.date)+' 評価額 '+yen(ptsValue[k])+'" data-click="showNisaPointFromEl(this,event)" data-keydown="nisaPointKey"><circle cx="'+pv[0].toFixed(1)+'" cy="'+pv[1].toFixed(1)+'" r="17" class="chart-hit-target"></circle><circle cx="'+pv[0].toFixed(1)+'" cy="'+pv[1].toFixed(1)+'" r="4.8" class="chart-point value"></circle></g>';
  }
  var svg='<div class="ahamo-chart-wrap"><div class="chart-legend"><span class="principal">元本</span><span class="value">評価額</span></div><div id="nisaPointInfo" class="nisa-point-info" aria-live="polite"><span>グラフの点をタップ</span><span>入力日と金額を表示します</span></div><svg class="nisa-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="NISA元本と評価額の推移">'+grid+xlabels+'<polyline points="'+poly(ptsPrincipal)+'" class="chart-line principal"/><polyline points="'+poly(ptsValue)+'" class="chart-line value"/>'+points+'</svg></div>';
  return controls+svg+'<p class="small chart-note">各月の最新記録を表示します。長期表示では見やすさのためタップ用の点を間引いています。</p>';

}
function invest(){var isNisa=investTab==='nisa'; setTitle('投資',isNisa?'表示中：NISA専用':'表示中：国債・個別株など'); var html='<div class="invest-tabs compact animated-choice '+(isNisa?'choice-left':'choice-right')+'" role="tablist" aria-label="投資ページ切替"><button type="button" role="tab" aria-selected="'+(isNisa?'true':'false')+'" class="'+(isNisa?'active':'')+'" data-click="showNisaTab()"><span class="tab-main">NISA</span><span class="tab-sub">月次入力・推移</span></button><button type="button" role="tab" aria-selected="'+(!isNisa?'true':'false')+'" class="'+(!isNisa?'active':'')+'" data-click="showOtherTab()"><span class="tab-main">国債・個別株</span><span class="tab-sub">その他投資</span></button></div>'; html+=isNisa?nisaPage():otherPage(); $('app').innerHTML=html; setTimeout(enhanceInputs,0)}
window.showNisaTab=function(){
  if(investTab==='nisa')return;
  animateTwoChoice('.invest-tabs.animated-choice',false,function(){investTab='nisa';invest();});
}
window.showOtherTab=function(){
  if(investTab==='other')return;
  animateTwoChoice('.invest-tabs.animated-choice',true,function(){investTab='other';invest();});
}
function nisaPage(){
  var l=latestNisa(), principal=nisaPrincipal(), value=nisaValue(), profit=nisaProfit();
  var yStart=today().slice(0,4)+'-01-01'; var startVal=nisaValueBefore(yStart); var ytd=startVal?((value-startVal-n((state.nisa||[]).filter(function(r){return String(r.date||'')>=yStart}).reduce(function(a,r){return a+n(r.contribution)},0)))/startVal*100):0;
  var r=n(state.settings.nisaAnnualReturn)/100/12, years=Math.min(130,Math.max(0,n(state.settings.retireAge)-currentAutoAge())), months=years*12, future=value, futurePrincipal=principal;
  var monthly=n(l.contribution); for(var i=0;i<months;i++){future=future*(1+r)+monthly; futurePrincipal+=monthly} var futureProfit=future-futurePrincipal;
  return actionCard('invest')+'<div id="nisaTopCard" class="grid nisa-metrics"><div class="metric"><span>累計元本</span><b>'+yen(principal)+'</b></div><div class="metric"><span>評価額</span><b>'+yen(value)+'</b></div><div class="metric"><span>損益</span><b class="'+deltaClass(profit)+'">'+signedYen(profit)+'</b></div><div class="metric"><span>損益率</span><b>'+pct(principal?profit/principal*100:0)+'</b></div><div class="metric"><span>年初来 概算</span><b class="'+deltaClass(ytd)+'">'+signedPct(ytd)+'</b></div><div class="metric"><span>65歳概算</span><b>'+yen(future)+'</b></div></div><div id="nisaInputCard" class="card"><h2 id="nisaInputTitle">NISA月次入力</h2><div class="row"><div><label>日付</label><input id="nisa_date" type="date" value="'+today()+'"></div><div><label>今月の入金額</label><input id="nisa_contrib" inputmode="numeric" placeholder="円"></div></div><label>現在評価額</label><input id="nisa_value" inputmode="numeric" placeholder="円" value="'+inputMoney(l.value)+'"><div class="btnrow"><button data-click="addNisa()">NISA月次を追加</button></div><p class="small">65歳概算：元本 '+yen(futurePrincipal)+' / 運用益 '+yen(futureProfit)+' / 総額 '+yen(future)+'。今月入金額を変えると次回計算に反映されます。</p></div><div class="card" id="nisaGraphCard"><h2>元本・評価額グラフ</h2>'+nisaChart()+'</div><div class="card"><h2>履歴</h2>'+listNisa()+'</div>'
}
window.delNisaById=function(id){var r=findById('nisa',id); var msg='このNISA月次データを削除しますか？\n\n'+(r?(r.date+' 入金 '+yen(r.contribution)+' / 評価額 '+yen(r.value)):'選択したNISAデータ'); deleteItem('nisa',id,msg,invest)}
window.addNisa=async function(){var row={id:uid(),date:$('nisa_date').value||today(),contribution:n($('nisa_contrib').value),value:n($('nisa_value').value)};state.nisa.push(row);if(!await save())return;setAction('invest','NISA月次を保存しました',[{label:'グラフを見る',action:'jumpTo(\'invest\',\'nisaGraphCard\',\'nisa\')'},{label:'トップへ',action:'show(\'dash\')'}]);invest();showSavedVisual('NISA月次を追加しました',[{label:'日付',value:dateText(row.date)},{label:'評価額',value:moneyText(row.value)},{label:'種類',value:'NISA'}]);toast('NISAを追加しました')}
function listNisa(){
  var arr=(state.nisa||[]).slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date))}).slice(0,12);
  if(!arr.length)return '<p class="small">入力なし</p>';
  var cum=0, asc=(state.nisa||[]).slice().sort(function(a,b){return String(a.date).localeCompare(String(b.date))});
  var cmap={};
  for(var i=0;i<asc.length;i++){cum+=n(asc[i].contribution); cmap[asc[i].id]=cum}
  return '<div class="investment-history-list nisa-history-list">'+arr.map(function(r){
    var p=n(r.value)-n(cmap[r.id]);
    return '<div class="investment-history-item nisa-history-item"><div class="investment-history-head"><span class="investment-history-date">'+esc(r.date)+'</span><b class="investment-history-value">'+yen(r.value)+'</b></div><div class="investment-history-main">入金 '+yen(r.contribution)+'</div><div class="investment-history-meta">累計元本 '+yen(cmap[r.id])+' / 損益 '+signedYen(p)+'</div><div class="investment-history-actions"><button class="secondary" type="button" data-id="'+esc(r.id)+'" data-click="delNisaById(this.dataset.id)">削除</button></div></div>';
  }).join('')+'</div>';
}
function otherPage(){return '<div id="otherInvestCard" class="card"><h2>国債・個別株・その他投資</h2><div class="row"><div><label>日付</label><input id="oi_date" type="date" value="'+today()+'"></div><div><label>種類</label><select id="oi_type"><option>国債</option><option>個別株</option><option>投資信託</option><option>その他</option></select></div></div><label>名称</label><input id="oi_name" placeholder="個人向け国債・銘柄名など"><div class="row"><div><label>元本/買付額</label><input id="oi_principal" inputmode="numeric"></div><div><label>現在評価額</label><input id="oi_value" inputmode="numeric"></div></div><div class="btnrow"><button data-click="addOtherInvest()">追加</button></div></div><div class="card"><h2>一覧</h2>'+listOtherInvest()+'</div>'}
window.delOtherInvestById=function(id){var r=findById('otherInvest',id); var msg='この投資項目を削除しますか？\n\n'+(r?((r.type||'')+' '+(r.name||'名称なし')+' / 評価額 '+yen(r.value)):'選択した投資項目'); deleteItem('otherInvest',id,msg,invest)}
window.addOtherInvest=async function(){var row={id:uid(),date:$('oi_date').value||today(),type:$('oi_type').value,name:$('oi_name').value||'',principal:n($('oi_principal').value),value:n($('oi_value').value)};state.otherInvest.push(row);if(!await save())return;invest();showSavedVisual('投資を追加しました',[{label:'日付',value:dateText(row.date)},{label:'評価額',value:moneyText(row.value)},{label:'種類',value:row.type||'その他'}]);toast('追加しました')}
function listOtherInvest(){
  var arr=(state.otherInvest||[]).slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date))});
  if(!arr.length)return '<p class="small">入力なし。国債を買うか迷っている間は空欄でOKです。</p>';
  return '<div class="investment-history-list other-invest-history-list">'+arr.map(function(r){
    var profit=n(r.value)-n(r.principal);
    return '<div class="investment-history-item other-invest-history-item"><div class="investment-history-head"><div><b class="investment-history-name">'+esc(r.name||'名称なし')+'</b><span class="investment-history-type">'+esc(r.type||'その他')+'</span></div><b class="investment-history-value">'+yen(r.value)+'</b></div><div class="investment-history-meta">'+esc(r.date)+' / 元本 '+yen(r.principal)+' / 損益 '+signedYen(profit)+'</div><div class="investment-history-actions"><button class="secondary" type="button" data-id="'+esc(r.id)+'" data-click="delOtherInvestById(this.dataset.id)">削除</button></div></div>';
  }).join('')+'</div>';
}
function specialCardHtml(){
  return '<div id="specialCard" class="card"><h2 id="specialTitle">特別支出積立</h2><div class="row"><div><label>項目名</label><input id="sp_name" value="旅行"></div><div><label>予定日</label><input id="sp_due" type="date" value="'+nextYearDate()+'"></div></div><div class="row"><div><label>目標額</label><input id="sp_target" inputmode="numeric" placeholder="円"></div><div><label>今月の入金額</label><input id="sp_deposit" inputmode="numeric" placeholder="円"></div></div><div class="btnrow"><button type="button" data-click="addSpecial()">項目を追加</button></div>'+listSpecials()+'</div>';
}
function fixedCostCardHtml(){
  return '<div id="fixedCostCard" class="card"><h2 id="fixedCostTitle">固定費（サブスク含む）</h2><div class="grid"><div class="metric full"><span>月換算合計</span><b>'+yen(monthlyFixedCosts())+'</b></div></div><div class="row"><div><label>項目名</label><input id="fix_name" placeholder="スマホ・iCloud・保険など"></div><div><label>種類</label><select id="fix_kind"><option>固定費</option><option>サブスク</option><option>ローン返済</option></select></div></div><div class="row"><div><label>周期</label><select id="fix_cycle"><option>月額</option><option>年額</option></select></div><div><label>金額</label><input id="fix_amount" inputmode="numeric" placeholder="円"></div></div><div class="row"><div><label>ローン残高</label><input id="fix_balance" inputmode="numeric" placeholder="ローン返済の場合・円"></div><div><label>ボーナス返済額</label><input id="fix_bonus" inputmode="numeric" placeholder="任意・円"></div></div><label>返済完了予定日</label><input id="fix_end" type="date"><div class="explain-box">種類をローン返済にして残高と返済完了予定日を入れると、固定費に月額を反映しつつ、負債残高・生活上の実質資産・会計上の純資産にも自動反映します。1年間での返済額は、現在から1年間に支払う予定額を合計します。</div><div class="btnrow"><button type="button" data-click="addFixedCost()">項目を追加</button></div>'+listFixedCosts()+'</div>';
}
function life(){
  setTitle('生活',lifeTab==='fixed'?'固定費・サブスク':'特別支出積立');
  var asset=defenseAsset(), months=defenseMonths();
  var defense='<div class="card defense-summary-card"><h2>生活防衛資金</h2><div class="summary-grid"><div class="summary-row"><div class="summary-item"><span>現在の資産額</span><b>'+yen(asset)+'</b></div><div class="summary-item"><span>確保月数</span><b>'+monthText(months)+'</b></div></div></div><p class="small defense-summary-note">NISA評価額は100%として生活防衛資金に含めています。</p></div>';
  var tabs='<div class="invest-tabs compact animated-choice life-tabs '+(lifeTab==='fixed'?'choice-right':'choice-left')+'" role="tablist"><button type="button" role="tab" aria-selected="'+(lifeTab==='special'?'true':'false')+'" class="'+(lifeTab==='special'?'active':'')+'" data-click="showSpecialTab()"><span class="tab-main">特別支出</span><span class="tab-sub">積立・入金</span></button><button type="button" role="tab" aria-selected="'+(lifeTab==='fixed'?'true':'false')+'" class="'+(lifeTab==='fixed'?'active':'')+'" data-click="showFixedTab()"><span class="tab-main">固定費</span><span class="tab-sub">サブスク・ローン</span></button></div>';
  $('app').innerHTML=defense+tabs+(lifeTab==='fixed'?fixedCostCardHtml():specialCardHtml());
  setTimeout(enhanceInputs,0);
}
window.showSpecialTab=function(){if(lifeTab==='special')return;animateTwoChoice('.life-tabs',false,function(){lifeTab='special';life()})}
window.showFixedTab=function(){if(lifeTab==='fixed')return;animateTwoChoice('.life-tabs',true,function(){lifeTab='fixed';life()})}
function monthsUntil(d){return Math.max(1,Math.ceil((new Date(d)-new Date())/(864e5*30.44)))}
window.addSpecial=async function(){
  if(mutationBusy)return;mutationBusy=true;
  var row={id:uid(),name:$('sp_name').value||'特別支出',target:n($('sp_target').value),current:n($('sp_deposit').value),due:$('sp_due').value||nextYearDate(),createdAt:today()};
  state.specials.push(row);editingSpecialId='';
  if(!await save()){mutationBusy=false;return}
  mutationBusy=false;life();showSavedVisual('積立項目を追加しました',[{label:'積立項目',value:row.name},{label:'目標額',value:moneyText(row.target)},{label:'初回入金',value:moneyText(row.current)}]);toast('特別支出項目を追加しました');
}
window.addSpecialDeposit=async function(btn){
  if(mutationBusy)return;
  var id=btn&&btn.dataset?btn.dataset.id:'', el=$('dep_'+id), amount=n(el&&el.value), target=findById('specials',id);
  if(!target){toast('積立項目が見つかりません');return}
  if(amount<=0){toast('入金額を入力してください');return}
  mutationBusy=true;
  var before=n(target.current), historyKey=Array.isArray(target.history)?'history':(Array.isArray(target.deposits)?'deposits':'');
  target.current=before+amount;
  if(historyKey)target[historyKey].push({id:uid(),date:today(),amount:amount,balance:target.current});
  if(!await save()){mutationBusy=false;return}
  mutationBusy=false;var name=target.name||'特別支出';var after=target.current;life();showSavedVisual('積立へ入金しました',[{label:'積立項目',value:name},{label:'入金額',value:moneyText(amount)},{label:'積立後',value:moneyText(after)}]);toast('入金しました');
}
window.editSpecialById=function(id){editingSpecialId=id; life()}
window.cancelSpecialEdit=function(){editingSpecialId=''; life()}
window.saveSpecialEdit=async function(btn){
  var id=btn&&btn.dataset?btn.dataset.id:'';
  var name=$('edit_name_'+id), due=$('edit_due_'+id), target=$('edit_target_'+id), current=$('edit_current_'+id);
  var before=(state.specials||[]).map(function(r){return Object.assign({},r)});
  state.specials=(state.specials||[]).map(function(r){
    if(r.id===id){
      r.name=(name&&name.value)||r.name||'特別支出';
      r.due=(due&&due.value)||r.due||nextYearDate();
      r.target=n(target&&target.value);
      r.current=n(current&&current.value);
    }
    return r;
  });
  editingSpecialId='';
  if(!await save()){state.specials=before;life();return}
  life();
  toast('特別支出項目を保存しました');
}
window.delSpecialById=function(id){var r=findById('specials',id); var msg='この特別支出積立を削除しますか？\n\n'+(r?((r.name||'項目')+' / 現在 '+yen(r.current)+' / 目標 '+yen(r.target)):'選択した積立項目'); deleteItem('specials',id,msg,function(){if(editingSpecialId===id)editingSpecialId=''; life();})}
function listSpecials(){
  var arr=state.specials||[];
  if(!arr.length)return '<p class="small">登録なし</p>';
  return arr.map(function(r){
    var need=Math.max(0,n(r.target)-n(r.current));
    var yearlyTarget=Math.max(0,Math.round(n(r.target)));
    var regularMonthly=Math.floor(yearlyTarget/12/100)*100;
    var firstMonthly=yearlyTarget-regularMonthly*11;
    var prog=Math.min(100,n(r.current)/Math.max(1,n(r.target))*100);
    var history=Array.isArray(r.history)?r.history:(Array.isArray(r.deposits)?r.deposits:[]);
    var historyHtml=history.length?'<div class="small special-history"><span>最近の入金</span>'+history.slice(-3).map(function(h){return '<span>'+esc((h.date||'日付未設定')+' '+moneyText(h.amount))+'</span>'}).join('')+'</div>':'';
    var html='<div class="listitem special-item"><div class="special-head"><b>'+esc(r.name)+'</b><span class="right">'+yen(r.current)+' / '+yen(r.target)+'</span></div><div class="bar"><i style="width:'+prog+'%"></i></div><div class="small special-detail-list"><span><em>目標日</em><b>'+esc(r.due)+'</b></span><span><em>初回</em><b>'+yen(firstMonthly)+'</b></span><span><em>2回目以降</em><b>'+yen(regularMonthly)+'</b></span><span><em>残り</em><b>'+yen(need)+'</b></span></div>'+historyHtml;
    html+='<div class="deposit-row"><input id="dep_'+esc(r.id)+'" inputmode="numeric" placeholder="今月の入金額"><button type="button" data-id="'+esc(r.id)+'" data-click="addSpecialDeposit(this)">入金</button></div>';
    if(editingSpecialId===r.id){
      html+='<div class="edit-box"><label>項目名</label><input id="edit_name_'+esc(r.id)+'" value="'+esc(r.name)+'"><label>予定日</label><input id="edit_due_'+esc(r.id)+'" type="date" value="'+esc(r.due)+'"><label>目標額</label><input id="edit_target_'+esc(r.id)+'" inputmode="numeric" value="'+inputMoney(r.target)+'" placeholder="円"><label>現在の積立額</label><input id="edit_current_'+esc(r.id)+'" inputmode="numeric" value="'+inputMoney(r.current)+'" placeholder="円"><div class="btnrow"><button type="button" data-id="'+esc(r.id)+'" data-click="saveSpecialEdit(this)">保存</button><button class="secondary" type="button" data-click="cancelSpecialEdit()">キャンセル</button></div></div>';
    }else{
      html+='<div class="btnrow"><button class="secondary" type="button" data-id="'+esc(r.id)+'" data-click="editSpecialById(this.dataset.id)">編集</button><button class="secondary" type="button" data-id="'+esc(r.id)+'" data-click="delSpecialById(this.dataset.id)">削除</button></div>';
    }
    html+='</div>';
    return html;
  }).join('');
}
window.addSub=function(){addFixedCost()}
function listSubs(){return ''}
window.addFixedCost=async function(){
  if(mutationBusy)return;mutationBusy=true;
  var row={id:uid(),name:$('fix_name').value||'固定費',kind:$('fix_kind').value||'固定費',cycle:$('fix_cycle').value||'月額',amount:n($('fix_amount').value),loanBalance:n($('fix_balance').value),loanBonus:n($('fix_bonus').value),loanEnd:$('fix_end').value||'',active:true};
  editingFixedCostId='';state.fixedCosts.push(row);
  if(!await save()){mutationBusy=false;return}
  mutationBusy=false;life();showSavedVisual('固定費を追加しました',[{label:'項目',value:row.name},{label:'金額',value:moneyText(row.amount)},{label:'種類',value:row.kind}]);toast('固定費を追加しました');
}
window.editFixedCostById=function(id){
  editingFixedCostId=id;
  life();
  setTimeout(function(){
    var el=$('edit_fixed_'+id);
    if(el&&el.scrollIntoView)el.scrollIntoView({block:'center'});
  },30);
}
window.cancelFixedCostEdit=function(){
  editingFixedCostId='';
  life();
}
window.saveFixedCostEdit=async function(btn){
  var id=btn&&btn.dataset?btn.dataset.id:'';
  var name=$('edit_fixed_name_'+id);
  var kind=$('edit_fixed_kind_'+id);
  var cycle=$('edit_fixed_cycle_'+id);
  var amount=$('edit_fixed_amount_'+id);
  var balance=$('edit_fixed_balance_'+id);
  var bonus=$('edit_fixed_bonus_'+id);
  var end=$('edit_fixed_end_'+id);

  var before=(state.fixedCosts||[]).map(function(r){return Object.assign({},r)});
  state.fixedCosts=(state.fixedCosts||[]).map(function(r){
    if(r.id===id){
      r.name=(name&&name.value)||r.name||'固定費';
      r.kind=(kind&&kind.value)||r.kind||'固定費';
      r.cycle=(cycle&&cycle.value)||r.cycle||'月額';
      r.amount=n(amount&&amount.value);
      r.loanBalance=n(balance&&balance.value);
      r.loanBonus=n(bonus&&bonus.value);
      r.loanEnd=(end&&end.value)||'';
    }
    return r;
  });
  editingFixedCostId='';
  if(!await save()){state.fixedCosts=before;life();return}
  life();
  toast('固定費を保存しました');
}
function listFixedCosts(){
  var arr=state.fixedCosts||[];
  if(!arr.length)return '<p class="small">登録なし</p>';
  return arr.map(function(r){
    var monthly=r.cycle==='年額'?n(r.amount)/12:n(r.amount);
    var leftMonths=monthsUntilLoanEnd(r.loanEnd);
    var count=Math.min(12,leftMonths);
    var loan12=Math.min(n(r.loanBalance)||monthly*count, monthly*count+n(r.loanBonus)*Math.ceil(count/6));
    var loanInfo=(r.kind==='ローン返済'||n(r.loanBalance)>0)?'<div class="loan-mini"><span>ローン残高 '+yen(r.loanBalance)+'</span><span>完了予定 '+(r.loanEnd?esc(r.loanEnd):'未設定')+'</span><span>ボーナス返済 '+yen(r.loanBonus)+'</span><span>1年間の返済予定 '+yen(loan12)+'</span></div>':'';
    var kindTag='<span class="fixed-kind-label">'+esc(r.kind||'固定費')+'</span>';

    if(editingFixedCostId===r.id){
      return '<div id="edit_fixed_'+esc(r.id)+'" class="listitem fixed-item fixed-editing"><div class="edit-box fixed-edit-box">'
        +'<label>項目名</label><input id="edit_fixed_name_'+esc(r.id)+'" value="'+esc(r.name)+'">'
        +'<div class="row"><div><label>種類</label><select id="edit_fixed_kind_'+esc(r.id)+'">'
        +'<option'+(r.kind==='固定費'?' selected':'')+'>固定費</option>'
        +'<option'+(r.kind==='サブスク'?' selected':'')+'>サブスク</option>'
        +'<option'+(r.kind==='ローン返済'?' selected':'')+'>ローン返済</option>'
        +'</select></div><div><label>周期</label><select id="edit_fixed_cycle_'+esc(r.id)+'">'
        +'<option'+(r.cycle==='月額'?' selected':'')+'>月額</option>'
        +'<option'+(r.cycle==='年額'?' selected':'')+'>年額</option>'
        +'</select></div></div>'
        +'<label>金額</label><input id="edit_fixed_amount_'+esc(r.id)+'" inputmode="numeric" value="'+inputMoney(r.amount)+'" placeholder="円">'
        +'<div class="row"><div><label>ローン残高</label><input id="edit_fixed_balance_'+esc(r.id)+'" inputmode="numeric" value="'+inputMoney(r.loanBalance)+'" placeholder="円"></div>'
        +'<div><label>ボーナス返済額</label><input id="edit_fixed_bonus_'+esc(r.id)+'" inputmode="numeric" value="'+inputMoney(r.loanBonus)+'" placeholder="円"></div></div>'
        +'<label>返済完了予定日</label><input id="edit_fixed_end_'+esc(r.id)+'" type="date" value="'+esc(r.loanEnd||'')+'">'
        +'<div class="btnrow"><button type="button" data-id="'+esc(r.id)+'" data-click="saveFixedCostEdit(this)">保存</button><button class="secondary" type="button" data-click="cancelFixedCostEdit()">キャンセル</button></div>'
        +'</div></div>';
    }

    return '<div class="listitem fixed-item"><div class="fixed-head"><b class="fixed-name">'+esc(r.name)+'</b><span class="right">'+yen(monthly)+'/月</span></div><div class="fixed-meta-row">'+kindTag+'</div>'+loanInfo+'<div class="item-actions"><button class="secondary" type="button" data-id="'+esc(r.id)+'" data-click="editFixedCostById(this.dataset.id)">編集</button><button class="secondary" type="button" data-id="'+esc(r.id)+'" data-click="delFixedCostById(this.dataset.id)">削除</button></div></div>';
  }).join('');
}
window.delFixedCostById=function(id){var r=findById('fixedCosts',id); var msg='この固定費を削除しますか？\n\n'+(r?((r.name||'項目')+' / '+(r.cycle||'')+' '+yen(r.amount)):'選択した固定費'); deleteItem('fixedCosts',id,msg,function(){if(editingFixedCostId===id)editingFixedCostId='';life();})}
function tools(){
  setTitle('設定・試算','手取り・ふるさと納税・バックアップ');
  var fur=furusatoProjection(), inc=fur.projected, limit=fur.limit;
  var net=n(state.settings.netIncomeManual)||incomeMonth(thisMonth());
  var g=goldenBudgets();
  var actualLiving=actualMonthlyBudget();
  var actualRent=n(state.settings.rent);
  var rentSurplus=g.rent-actualRent;
  var livingSurplus=g.lifeExRent-actualLiving;
  var rentRatio=net?n(state.settings.rent)/net*100:0;
  var loanNow=loanBalanceNow();
  var planText=state.settings.studentLoanPlanRegistered?'<div class="loan-plan-badge">登録中の返済計画から、現在の奨学金残高を自動推計しています。現在推計残高：<b>'+yen(loanNow)+'</b></div>':'<p class="small">返済計画を登録すると、奨学金残高は時間経過に応じて自動推計されます。</p>';
  $('app').innerHTML='<div class="card"><h2>基本設定</h2><div class="row"><div><label>年齢</label><input id="set_age" inputmode="numeric" value="'+(currentAutoAge()||'')+'"></div><div><label>退職年齢</label><input id="set_retire" inputmode="numeric" value="'+(n(state.settings.retireAge)||'')+'"></div></div><div class="row"><div><label>奨学金残高</label><input id="set_loan" inputmode="numeric" value="'+inputMoney(loanNow)+'" placeholder="円"></div><div><label>手取り月収（見込み）</label><input id="set_net" inputmode="numeric" value="'+inputMoney(state.settings.netIncomeManual)+'" placeholder="円"></div></div><div class="row"><div><label>家賃</label><input id="set_rent" inputmode="numeric" value="'+inputMoney(state.settings.rent)+'" placeholder="円" data-input="autoHousingNet()"></div><div><label>給与に支払われる住宅手当</label><input id="set_housegross" inputmode="numeric" value="'+inputMoney(state.settings.housingAllowanceGross)+'" placeholder="円" data-input="autoHousingNet()"></div></div><div class="row"><div><label>手当の手取り換算率%</label><input id="set_houserate" inputmode="numeric" value="'+(n(state.settings.housingAllowanceNetRate)||80)+'" placeholder="%" data-input="autoHousingNet()"></div><div><label>住宅手当の実質手取り相当額</label><input id="set_house" inputmode="numeric" value="'+inputMoney(state.settings.housingAllowanceNet)+'" placeholder="円"></div></div><div class="btnrow"><button data-click="saveSettings()">設定を保存</button></div><div class="explain-box">NISA評価額は100%として生活防衛資金に含めます。月予算は手入力せず、手取り月収から黄金比で自動表示します。</div></div>';
  $('app').innerHTML+='<div class="card"><h2>実質家賃率</h2><div class="grid"><div class="metric full"><span>実質家賃率</span><b>'+pct(rentRatio)+'</b></div></div></div>';
  $('app').innerHTML+='<div id="goldenBudgetCard" class="card"><h2>黄金比予算</h2><div class="grid"><div class="metric"><span>家賃26%</span><b>'+yen(g.rent)+'</b></div><div class="metric"><span>生活費24%（家賃除く）</span><b>'+yen(g.lifeExRent)+'</b></div><div class="metric"><span>自由費30%</span><b>'+yen(g.free)+'</b></div><div class="metric"><span>貯蓄/投資20%</span><b>'+yen(g.save)+'</b></div></div><div class="budget-compare"><div class="budget-line"><span>実際の家賃</span><b>'+yen(actualRent)+'</b></div><div class="budget-line"><span>'+(rentSurplus>=0?'家賃の余剰':'家賃の超過')+'</span><b class="'+(rentSurplus>=0?'okText':'dangerText')+'">'+yen(Math.abs(rentSurplus))+'</b></div><div class="budget-line"><span>実際の生活費（固定費＋今月支出）</span><b>'+yen(actualLiving)+'</b></div><div class="budget-line"><span>'+(livingSurplus>=0?'生活費の余剰':'生活費の超過')+'</span><b class="'+(livingSurplus>=0?'okText':'dangerText')+'">'+yen(Math.abs(livingSurplus))+'</b></div></div><div class="explain-box">黄金比は、家賃26%・生活費24%（家賃除く）・自由費30%・貯蓄/投資20%で表示します。これにより、家賃と家賃以外の生活費を分けて確認できます。</div></div>';
  $('app').innerHTML+='<div id="furusatoCard" class="card furusato-card"><h2 id="furusatoTitle">ふるさと納税上限 概算</h2>'
    +'<div class="furusato-mode '+(fur.finalReady?'final':'safe')+'"><span>'+(fur.finalReady?'最終調整モード':'安全運用モード')+'</span><b>'+(fur.finalReady?'年内分の確定確認済み':'途中の見込み額で計算中')+'</b></div>'
    +'<div class="summary-grid"><div class="summary-row"><div class="summary-item"><span>入力済み年収</span><b>'+yen(fur.actual)+'</b></div><div class="summary-item"><span>年収見込み</span><b>'+yen(fur.projected)+'</b></div></div>'
    +'<div class="summary-row"><div class="summary-item"><span>上限概算</span><b>'+yen(fur.limit)+'</b></div><div class="summary-item"><span>'+(fur.finalReady?'最終寄附目安':'安全寄附目安')+'</span><b>'+yen(fur.usableLimit)+'</b></div></div>'
    +'<div class="summary-row remaining-row"><div class="summary-item"><span>今年の寄附済み額</span><b>'+yen(fur.donated)+'</b></div><div class="summary-item"><span>'+(fur.finalReady?'最終調整可能額':'安全にあと寄附できる目安')+'</span><b class="'+(fur.over?'dangerText':'')+'">'+(fur.over?'超過 '+yen(fur.over):yen(fur.remaining))+'</b></div></div></div>'
    +'<div class="furusato-progress"><span>'+fur.year+'年の給与入力</span><b>'+fur.grossMonths+' / 12か月</b></div>'
    +'<div class="furusato-checks"><div><span>12月給与</span><b class="'+(fur.decemberSalary?'ready':'waiting')+'">'+(fur.decemberSalary?'入力済み':'未入力')+'</b></div><label class="confirm-check"><input id="furusato_final_confirmed" type="checkbox" '+(fur.finalConfirmed?'checked':'')+'><span>今年の給与・賞与・年末調整がすべて確定した</span></label></div>'
    +'<label>今年すでに寄附した金額</label><input id="furusato_donated_amount" inputmode="numeric" value="'+inputMoney(fur.donated)+'" placeholder="円">'
    +'<label>まだ給与明細に入力していない賞与の見込み合計</label><input id="furusato_bonus_remaining" inputmode="numeric" value="'+inputMoney(fur.remainingBonus)+'" placeholder="分からない間は0円">'
    +'<p class="small bonus-guidance">冬賞与の金額がある程度分かる10〜11月頃に入力します。実際の賞与を給与明細へ登録した後は、その賞与分をここから減らしてください。</p>'
    +'<div class="btnrow"><button class="secondary" data-click="saveFurusatoForecast()">ふるさと納税情報を保存</button></div>'
    +'<p class="small">'+(fur.finalReady?'12月給与と年内分の確定を確認したため、上限概算から3,000円の余裕を残して最終寄附目安を表示しています。':'給与・賞与が確定するまでは、入力月数に応じて上限概算の70〜95%に抑えた安全寄附目安を表示します。')+' 扶養、住宅ローン控除、医療費控除などは完全には反映できないため、最終的には源泉徴収票や公式計算でも確認してください。</p></div></div><div id="taxSimCard" class="card"><h2 id="taxSimTitle">手取り・税金シミュレーター</h2><label>年収</label><input id="sim_income" inputmode="numeric" value="'+inputMoney(inc)+'" placeholder="円"><div class="btnrow"><button data-click="runTaxSim()">試算</button></div><div id="taxResult"></div></div><div class="card"><h2>NISA積立増額シミュレーション</h2><div class="row"><div><label>現在の月積立</label><input id="sim_now" inputmode="numeric" value="'+inputMoney(latestNisa().contribution||0)+'" placeholder="円"></div><div><label>増額後</label><input id="sim_up" inputmode="numeric" value="50,000" placeholder="円"></div></div><label>想定年利%</label><input id="sim_return" inputmode="decimal" value="'+n(state.settings.nisaAnnualReturn)+'" placeholder="%"><div class="btnrow"><button data-click="runNisaSim()">65歳時点を試算</button></div><div id="nisaSimResult"></div></div>'+loanToolHtml(planText)+'<div class="card"><h2>CSV簡易取込</h2><label>取込先</label><select id="csv_target"><option value="tx">収支</option><option value="nisa">NISA</option></select><label>CSVテキスト</label><textarea id="csv_text" placeholder="収支: 日付,収入/支出,金額,カテゴリ,固定費/変動費,メモ\nNISA: 日付,入金額,評価額,メモ"></textarea><div class="btnrow"><button data-click="importCsvText()">CSVを取り込む</button></div><p class="small">銀行・証券CSVは形式が違うため、まずは必要列だけ貼り付ける簡易取込です。</p></div><div class="card"><h2 id="backupTitle">バックアップ</h2><span id="backupLastLine" class="small">最終バックアップ：'+formatDateTime(state.settings.lastBackupAt)+'</span><div class="btnrow"><button class="backup-file-button" data-click="saveBackupAsFile()"><span>ファイルとして</span><span>保存</span></button><button class="secondary" data-click="exportBackup()">JSONを表示</button><button class="secondary" data-click="importBackup(false)">バックアップ読込</button></div><p class="small">バックアップの作成・復元時だけパスワードを入力します。アプリ起動時の入力は不要です。作成後に「共有・ファイルに保存」またはダウンロードを選んでください。</p><div id="backupOut"></div></div><div class="card reset-data-card"><h2>入力情報のリセット</h2><p class="small">収支、給与、NISA、投資、特別支出、固定費、各設定を初期状態に戻します。実行前にバックアップを保存してください。</p><button class="reset-data-button" type="button" data-click="resetAllInputData()">入力されている情報をリセット</button></div>';
  setTimeout(enhanceInputs,0);
}
function loanToolHtml(planText){
  var s=state.settings, loanNow=loanBalanceNow();
  return '<div class="card"><h2>奨学金返還シミュレーション</h2>'+planText+'<div class="row"><div><label>現在残高</label><input id="loan_balance" inputmode="numeric" value="'+inputMoney(loanNow)+'" placeholder="円"></div><div><label>年利%</label><input id="loan_rate" inputmode="decimal" value="'+(n(s.studentLoanRate)||'')+'" placeholder="%"></div></div><div class="row"><div><label>返済開始日</label><input id="loan_start" type="date" value="'+esc(s.studentLoanPlanStart||today())+'"></div><div><label>返済期間（月数・最大240）</label><input id="loan_months" inputmode="numeric" value="'+(n(s.studentLoanTargetMonths)||240)+'" placeholder="月"></div></div><div class="row"><div><label>月々の返済額</label><input id="loan_monthly" inputmode="numeric" value="'+inputMoney(s.studentLoanMonthly||10000)+'" placeholder="円"></div><div><label>ボーナス支払額</label><input id="loan_bonus" inputmode="numeric" value="'+inputMoney(s.studentLoanBonus)+'" placeholder="自動計算" disabled></div></div><div class="btnrow loan-action-row"><button class="loan-action-button" data-click="runLoanSim()"><span>ボーナス額を</span><span>自動計算</span></button><button class="secondary loan-action-button" data-click="registerLoanPlan()"><span>この返済計画で</span><span>登録</span></button></div><div id="loanResult" class="loan-result"></div><p class="loan-note">JASSOの定額返還は貸与総額・割賦方法に応じて返還期間が決まり、代表例では最大20年・240回です。ここでは返済期間を最大240か月として、月々の返済額を先に決め、1月・7月のボーナス支払額を自動計算します。利息は概算です。</p></div>';
}
window.saveFurusatoForecast=async function(){
  var bonus=$('furusato_bonus_remaining');
  var donated=$('furusato_donated_amount');
  var confirmed=$('furusato_final_confirmed');
  state.settings.furusatoTrackingYear=Number(today().slice(0,4));
  state.settings.furusatoRemainingBonusEstimate=n(bonus&&bonus.value);
  state.settings.furusatoDonatedAmount=Math.max(0,n(donated&&donated.value));
  state.settings.furusatoFinalConfirmed=!!(confirmed&&confirmed.checked);
  if(!await save())return;
  tools();
  toast('ふるさと納税情報を保存しました');
}
window.saveSettings=async function(){
  Object.assign(state.settings,{
    currentAge:n($('set_age').value),birthYearEstimate:birthYearFromAge(n($('set_age').value)),retireAge:n($('set_retire').value),
    studentLoanBalance:n($('set_loan').value),
    nisaSafety:100,monthlyExpenseManual:0,monthlyBudget:0,
    netIncomeManual:n($('set_net').value),rent:n($('set_rent').value),housingAllowanceGross:n($('set_housegross').value),housingAllowanceNetRate:n($('set_houserate').value)||80,
    housingAllowanceNet:n($('set_house').value)
  });
  if(!await save())return; tools(); toast('保存しました');
}
window.saveLoanSettings=async function(){
  state.settings.studentLoanBalance=n($('loan_balance').value);
  state.settings.studentLoanRate=n($('loan_rate').value);
  state.settings.studentLoanMonthly=n($('loan_monthly').value);
  state.settings.studentLoanTargetMonths=Math.min(240,Math.max(1,n($('loan_months').value)||240));
  state.settings.studentLoanBonus=n($('loan_bonus').value);
  state.settings.studentLoanPlanStart=$('loan_start').value||today();
  if(!await save())return;
  toast('奨学金条件を保存しました');
}
function loanPaymentDateLabel(startDate,monthIndex){
  var parts=String(startDate||today()).split('-');
  var y=Number(parts[0])||new Date().getFullYear();
  var m=(Number(parts[1])||1)-1;
  var day=Number(parts[2])||1;
  var first=new Date(y,m+Math.max(0,n(monthIndex)),1);
  var lastDay=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  var d=new Date(first.getFullYear(),first.getMonth(),Math.min(day,lastDay));
  return d.getFullYear()+'/'+pad2(d.getMonth()+1)+'/'+pad2(d.getDate());
}
window.runLoanSim=function(){
  var bal=n($('loan_balance').value), rate=n($('loan_rate').value), monthly=n($('loan_monthly').value), months=Math.min(240,Math.max(1,n($('loan_months').value)||240)), start=$('loan_start').value||today();
  var bonus=solveBonusPayment(bal,rate,monthly,months,start);
  $('loan_bonus').value=bonus?Math.round(bonus).toLocaleString('ja-JP'):'0';
  var sim=simulateCombinedLoan(bal,rate,monthly,bonus,months,start);
  var base=simulateCombinedLoan(bal,rate,monthly,0,months,start);
  var finalOk=sim.lastBalance<=1;
  var html='<div class="grid"><div class="metric"><span>月々の返済額</span><b>'+yen(monthly)+'</b></div><div class="metric"><span>1月・7月の追加額</span><b>'+yen(bonus)+'</b></div><div class="metric"><span>返済期間</span><b>'+monthLabelFromCount(months)+'</b></div><div class="metric"><span>概算利息</span><b>'+yen(sim.interest)+'</b></div></div>';
  html+='<p class="small '+(finalOk?'okText':'warnText')+'">'+(finalOk?'この条件なら指定期間内に概算で完済できます。':'この条件では指定期間内に残高が残る可能性があります。')+' 月々だけの場合の残高目安：'+yen(base.lastBalance)+'</p>';
  var rows=sim.rows.slice(-6).map(function(r){var payDate=loanPaymentDateLabel(start,r.month-1);return '<div class="loan-progress-item"><div class="loan-progress-head"><span><span class="loan-month-label">'+r.month+'か月目</span><span class="loan-date-label">'+payDate+'</span>'+(r.bonus?'<span class="loan-bonus-label">ボーナス月</span>':'')+'</span><b>'+yen(r.balance)+'</b></div><div class="small">累計利息 '+yen(r.interest)+' / 累計返済 '+yen(r.total)+'</div></div>'}).join('');
  html+='<div class="loan-progress-section"><h3>返済推移</h3><div class="loan-progress-list">'+(rows||'<p class="small">条件を入力してください。</p>')+'</div></div>';
  $('loanResult').innerHTML=html;
}
window.registerLoanPlan=async function(){
  runLoanSim();
  state.settings.studentLoanPlanRegistered=true;
  state.settings.studentLoanPlanStart=$('loan_start').value||today();
  state.settings.studentLoanOpeningBalance=n($('loan_balance').value);
  state.settings.studentLoanBalance=n($('loan_balance').value);
  state.settings.studentLoanRate=n($('loan_rate').value);
  state.settings.studentLoanMonthly=n($('loan_monthly').value);
  state.settings.studentLoanTargetMonths=Math.min(240,Math.max(1,n($('loan_months').value)||240));
  state.settings.studentLoanBonus=n($('loan_bonus').value);
  if(!await save())return;
  toast('返済計画を登録しました');
  tools();
}
window.runTaxSim=function(){var income=n($('sim_income').value); var emp=salaryDeduction(income), social=income*.15, taxable=Math.max(0,income-emp-social-480000), it=simpleIncomeTax(taxable), rt=Math.max(0,income-emp-social-430000)*.10, net=income-social-it-rt; $('taxResult').innerHTML='<div class="grid"><div class="metric"><span>概算手取り</span><b>'+yen(net)+'</b></div><div class="metric"><span>月換算</span><b>'+yen(net/12)+'</b></div><div class="metric"><span>所得税</span><b>'+yen(it)+'</b></div><div class="metric"><span>住民税</span><b>'+yen(rt)+'</b></div></div>'}
window.runNisaSim=function(){var now=n($('sim_now').value), up=n($('sim_up').value), r=n($('sim_return').value)/100/12; var years=Math.min(130,Math.max(0,n(state.settings.retireAge)-currentAutoAge())); var months=years*12, current=nisaValue(); function fv(pmt){var v=current; for(var i=0;i<months;i++)v=v*(1+r)+pmt; return v} var a=fv(now), b=fv(up); $('nisaSimResult').innerHTML='<div class="grid"><div class="metric"><span>現状ペース</span><b>'+yen(a)+'</b></div><div class="metric"><span>増額後</span><b>'+yen(b)+'</b></div><div class="metric full"><span>差額</span><b>'+yen(b-a)+'</b></div></div>'}

function featureChecklist(){
  var rows=[
    ['✓','毎月の収入・支出','収支入力で管理。固定費/変動費も選択できます。'],
    ['✓','暦年・年度の年収','給与明細から1〜12月と4〜翌3月を集計します。'],
    ['✓','NISA専用ページ','元本・評価額・損益・65歳概算・履歴・グラフを表示。'],
    ['✓','国債・個別株ページ','NISAとは別ページで管理できます。未購入なら空欄でOKです。'],
    ['✓','現金預金・ポイント・奨学金','設定で入力し、総資産/純資産に反映します。車の価値は含めません。'],
    ['✓','ふるさと納税上限','給与明細/年収見込みから簡易計算します。'],
    ['✓','手取り・税金','年収から概算手取り、所得税、住民税を試算します。'],
    ['✓','特別支出','初期項目は旅行。後から追加・削除できます。'],
    ['✓','サブスク・固定費','月額/年額を月換算して一覧化します。'],
    ['✓','生活防衛資金','現金＋ポイント＋NISA評価額×安全率で計算します。'],
    ['✓','NISA積立増額','65歳時点の差額を試算できます。'],
    ['△','CSV取り込み','汎用CSV自動判別ではなく、必要列を貼り付ける簡易取込です。'],
    ['△','厳密投資成績','損益率・年初来概算はあります。厳密XIRRは未搭載です。']
  ];
  return '<div class="check-list">'+rows.map(function(r){var cls=r[0]==='✓'?'done':'partial'; return '<div class="check-row"><span class="'+cls+'">'+r[0]+'</span><div><b>'+r[1]+'</b><small>'+r[2]+'</small></div></div>'}).join('')+'</div>'
}
function parseCsv(text){
  if(text.length>1024*1024)throw new Error('CSVは1MB以下にしてください。');
  var rows=[],row=[],field='',quoted=false;
  for(var i=0;i<text.length;i++){
    var c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted){quoted=false;}else if(field===''){quoted=true;}else throw new Error('CSVの引用符の位置が不正です。');}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(function(v){return v.trim()!==''}))rows.push(row);row=[];field='';if(rows.length>1001)throw new Error('CSVは一度に1,000行までです。');}
    else field+=c;
  }
  if(quoted)throw new Error('CSVの引用符が閉じていません。');
  row.push(field);if(row.some(function(v){return v.trim()!==''}))rows.push(row);
  if(rows.length>1001)throw new Error('CSVは一度に1,000行までです。');
  return rows;
}
window.importCsvText=async function(){
  try{
    var target=$('csv_target').value,rows=parseCsv($('csv_text').value||''),candidate=cloneState(state),count=0;
    rows.forEach(function(cols,index){
      cols=cols.map(function(x){return x.trim()});
      if(index===0&&/^(日付|date)$/i.test(cols[0]))return;
      if((target==='tx'&&(cols.length<3||cols.length>6))||(target==='nisa'&&(cols.length<3||cols.length>4)))throw new Error('CSVの列数が違います。');
      security.date(cols[0],false);
      function amount(value){var normalized=String(value).replace(/,/g,'');if(!/^-?\d+(?:\.\d+)?$/.test(normalized))throw new Error('CSVの金額が不正です。');return security.number(Number(normalized));}
      if(target==='tx')candidate.transactions.push({id:uid(),date:cols[0],type:cols[1]||'支出',amount:amount(cols[2]),category:cols[3]||'',kind:cols[4]||'変動費',memo:cols[5]||''});
      else if(target==='nisa')candidate.nisa.push({id:uid(),date:cols[0],contribution:amount(cols[1]),value:amount(cols[2]),memo:cols[3]||''});
      else throw new Error('取込先が違います。');
      if(++count>1000)throw new Error('CSVは一度に1,000行までです。');
    });
    if(!count)throw new Error('取り込める記録がありません。');
    candidate=security.validateState(candidate);await vault.save(candidate);state=candidate;lastGoodState=cloneState(state);tools();toast(count+'件取り込みました');
  }catch(e){visibleError(e.message||'CSVを取り込めませんでした。');}
};

function requestBackupPassword(mode,callback){
  var previous=$('backupPasswordDialog');if(previous)previous.remove();
  var wrap=document.createElement('div');wrap.id='backupPasswordDialog';wrap.className='backup-password-overlay';
  var form=document.createElement('form');form.className='card backup-password-panel';form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.setAttribute('aria-labelledby','backupPasswordTitle');
  var title=document.createElement('h2');title.id='backupPasswordTitle';title.textContent=mode==='export'?'バックアップの保護':'バックアップを復号';form.appendChild(title);
  var hint=document.createElement('p');hint.className='small';hint.textContent=mode==='export'?'バックアップ用に12文字以上のパスワードを設定してください。忘れると復元できません。アプリ起動時の入力は不要です。':'作成時のバックアップ用パスワードを入力してください。';form.appendChild(hint);
  var first=document.createElement('input');first.type='password';first.name='backup-password';first.autocomplete=mode==='export'?'new-password':'current-password';first.maxLength=1024;first.required=true;first.setAttribute('aria-label','バックアップ用パスワード');form.appendChild(first);
  var second;
  if(mode==='export'){first.minLength=12;second=document.createElement('input');second.type='password';second.autocomplete='new-password';second.maxLength=1024;second.required=true;second.setAttribute('aria-label','確認用パスワード');second.placeholder='もう一度入力';form.appendChild(second);}
  var error=document.createElement('p');error.setAttribute('role','alert');error.className='dangerText';form.appendChild(error);
  var buttons=document.createElement('div');buttons.className='btnrow';
  var submit=document.createElement('button');submit.type='submit';submit.textContent=mode==='export'?'作成':'復号';buttons.appendChild(submit);
  var cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='キャンセル';buttons.appendChild(cancel);form.appendChild(buttons);wrap.appendChild(form);document.body.appendChild(wrap);
  var focused=document.activeElement;
  function close(){first.value='';if(second)second.value='';wrap.remove();if(focused&&focused.isConnected)focused.focus();}
  cancel.addEventListener('click',close);
  form.addEventListener('keydown',function(event){
    if(event.key==='Escape'){event.preventDefault();if(!submit.disabled)close();return;}
    if(event.key==='Tab'){var controls=[first,second,submit,cancel].filter(Boolean);var i=controls.indexOf(document.activeElement);if(event.shiftKey&&i===0){cancel.focus();event.preventDefault()}else if(!event.shiftKey&&i===controls.length-1){first.focus();event.preventDefault()}}
  });
  form.addEventListener('submit',async function(event){
    event.preventDefault();if(submit.disabled||commandBusy)return;
    if(second&&first.value!==second.value){error.textContent='パスワードが一致しません。';return;}
    var pw=first.value;commandBusy=true;submit.disabled=true;cancel.disabled=true;first.value='';if(second)second.value='';
    try{await callback(pw);close();}catch(e){error.textContent=e.message||'バックアップを処理できませんでした。';submit.disabled=false;cancel.disabled=false;first.focus();}finally{pw='';commandBusy=false;}
  });
  first.focus();
}
function backupFileName(){return 'assetmemo-backup-v491-'+new Date().toISOString().slice(0,19).replace(/[-:]/g,'').replace('T','-')+'.json';}
function displayBackup(){
  var out=$('backupOut');if(!out){tools();out=$('backupOut');}
  out.innerHTML='<div class="backup-box"><p class="small">暗号化バックアップを作成しました。ファイルとして保存してください。</p><div class="btnrow"><button data-click="sharePreparedBackup()">共有・ファイルに保存</button><button class="secondary" data-click="downloadPreparedBackup()">ダウンロード</button><button class="secondary" data-click="copyBackupJson()">JSONをコピー</button><button class="secondary" data-click="clearPreparedBackup()">閉じる</button></div><textarea id="backup_text" class="backup-text" readonly aria-label="暗号化バックアップJSON"></textarea></div>';
  $('backup_text').value=backupCache.text;
}
window.exportBackup=function(){
  if(!stateReady)return;
  requestBackupPassword('export',async function(pw){
    if(!await save())throw new Error('記録を保存できないため、バックアップ作成を中止しました。');
    var text=JSON.stringify(await security.encryptBackup(state,pw),null,2);
    backupCache={text:text,filename:backupFileName(),revision:vault.revision};displayBackup();
  });
};
window.saveBackupAsFile=window.exportBackup;
async function markBackupNow(){
  if(!stateReady)return;
  // A later edit must not be marked as included in an older export.
  if(backupCache&&backupCache.revision!==vault.revision)return;
  state.settings.lastBackupAt=new Date().toISOString();
  if(!await save())return;
  if(backupCache)backupCache.revision=vault.revision;
  var last=$('backupLastLine');if(last)last.textContent='最終バックアップ：'+formatDateTime(state.settings.lastBackupAt);
}
window.sharePreparedBackup=async function(){
  if(!backupCache)return;
  try{
    var cache=backupCache;
    if(typeof File==='undefined'||!navigator.share){window.downloadPreparedBackup();return;}
    var data={files:[new File([cache.text],cache.filename,{type:'application/json'})]};
    if(navigator.canShare&&!navigator.canShare(data)){window.downloadPreparedBackup();return;}
    await navigator.share(data);await markBackupNow();toast('共有しました');
  }catch(e){if(e.name!=='AbortError')toast('共有できませんでした。ダウンロードまたはJSONコピーを使ってください。');}
};
window.downloadPreparedBackup=async function(){if(!backupCache)return;downloadText(backupCache.text,backupCache.filename);await markBackupNow();toast('ダウンロードを開始しました');};
window.clearPreparedBackup=function(){backupCache=null;var out=$('backupOut');if(out)out.replaceChildren();};
window.selectBackupJson=function(){var ta=$('backup_text');if(ta){ta.focus();ta.select();}};
window.copyBackupJson=async function(){
  if(!backupCache)return;
  var text=backupCache.text;
  try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);else{window.selectBackupJson();if(!document.execCommand('copy'))throw new Error('copy');}await markBackupNow();toast('コピーしました');}
  catch(_){window.selectBackupJson();toast('全文を選択しました。手動でコピーしてください。');}
};
async function prepareRestore(obj,pw){
  if(obj&&obj.format===security.FORMAT)return security.decryptBackup(obj,pw);
  if(obj&&/^assetmemo-encrypted-v\d+$/.test(String(obj.format||'')))return security.decryptLegacy(obj,pw);
  return security.validateState(obj&&obj.state?obj.state:obj);
}
function confirmRestore(candidate){
  var count=security.COLLECTIONS.reduce(function(sum,key){return sum+candidate[key].length},0);
  showAppConfirm('バックアップ内の'+count+'件の記録で、現在の入力情報を置き換えます。現在の記録は先にバックアップしてください。',async function(){
    try{
      candidate.settings.lastRestoreAt=new Date().toISOString();
      // Persist the validated candidate before changing live UI state.
      await vault.save(candidate,!stateReady);
      state=candidate;normalizeState();lastGoodState=cloneState(state);stateReady=true;
      try{window.localStorage.removeItem(security.LEGACY_STORE);window.localStorage.removeItem(security.LEGACY_PASSWORD_STORE)}catch(_){}
      backupCache=null;currentPage='dash';pageScrolls={};editingSpecialId='';editingFixedCostId='';editingTransactionId='';unlock();toast('バックアップを復元しました');
    }catch(e){visibleError(e.message);}
  },{title:'バックアップを復元しますか？',confirmLabel:'復元'});
}
window.importBackup=function(){
  var inp=$('fileInput');inp.value='';
  inp.onchange=async function(ev){
    var file=ev.target.files[0];if(!file)return;
    try{
      if(file.size>security.MAX_FILE)throw new Error('バックアップは8MB以下にしてください。');
      var obj=security.parse(await file.text());
      if(obj&&obj.format===security.FORMAT){requestBackupPassword('import',async function(pw){confirmRestore(await prepareRestore(obj,pw));});}
      else if(obj&&/^assetmemo-encrypted-v\d+$/.test(String(obj.format||''))){
        try{confirmRestore(await prepareRestore(obj));}
        catch(_){requestBackupPassword('legacy',async function(pw){confirmRestore(await prepareRestore(obj,pw));});}
      }else{
        if(obj&&obj.format)throw new Error('対応していないバックアップ形式です。');
        confirmRestore(await prepareRestore(obj));
      }
    }catch(e){visibleError(e.message||'バックアップを読み込めませんでした。元の記録は変更していません。');}
    finally{inp.value='';}
  };
  inp.click();
};


const commandHandlers=Object.freeze({
  "addFixedCost()": function(el,event){return addFixedCost();},
  "addNisa()": function(el,event){return addNisa();},
  "addOtherInvest()": function(el,event){return addOtherInvest();},
  "addSalary()": function(el,event){return addSalary();},
  "addSpecial()": function(el,event){return addSpecial();},
  "addTx()": function(el,event){return addTx();},
  "cancelFixedCostEdit()": function(el,event){return cancelFixedCostEdit();},
  "cancelSpecialEdit()": function(el,event){return cancelSpecialEdit();},
  "cancelTxEdit()": function(el,event){return cancelTxEdit();},
  "copyBackupJson()": function(el,event){return copyBackupJson();},
  "goInvestGraph()": function(el,event){return goInvestGraph();},
  "importCsvText()": function(el,event){return importCsvText();},
  "openNisa()": function(el,event){return openNisa();},
  "openOtherInvest()": function(el,event){return openOtherInvest();},
  "registerLoanPlan()": function(el,event){return registerLoanPlan();},
  "resetAllInputData()": function(el,event){return resetAllInputData();},
  "runLoanSim()": function(el,event){return runLoanSim();},
  "runNisaSim()": function(el,event){return runNisaSim();},
  "runTaxSim()": function(el,event){return runTaxSim();},
  "saveBackupAsFile()": function(el,event){return saveBackupAsFile();},
  "saveFurusatoForecast()": function(el,event){return saveFurusatoForecast();},
  "saveSettings()": function(el,event){return saveSettings();},
  "selectBackupJson()": function(el,event){return selectBackupJson();},
  "showFixedTab()": function(el,event){return showFixedTab();},
  "showNisaTab()": function(el,event){return showNisaTab();},
  "showOtherTab()": function(el,event){return showOtherTab();},
  "showSpecialTab()": function(el,event){return showSpecialTab();},
  "exportBackup()": function(el,event){return exportBackup();},
  "autoHousingNet()": function(el,event){return autoHousingNet();},
  "sharePreparedBackup()": function(el,event){return sharePreparedBackup();},
  "downloadPreparedBackup()": function(el,event){return downloadPreparedBackup();},
  "clearPreparedBackup()": function(el,event){return clearPreparedBackup();},
  "retryStartup()": function(el,event){return retryStartup();},
  "downloadRecovery()": function(el,event){return downloadRecovery();},
  "saveFixedCostEdit(this)": function(el,event){return saveFixedCostEdit(el);},
  "saveSpecialEdit(this)": function(el,event){return saveSpecialEdit(el);},
  "saveTxEdit(this)": function(el,event){return saveTxEdit(el);},
  "addSpecialDeposit(this)": function(el,event){return addSpecialDeposit(el);},
  "delFixedCostById(this.dataset.id)": function(el,event){return delFixedCostById(el.dataset.id);},
  "delNisaById(this.dataset.id)": function(el,event){return delNisaById(el.dataset.id);},
  "delOtherInvestById(this.dataset.id)": function(el,event){return delOtherInvestById(el.dataset.id);},
  "delSalaryById(this.dataset.id)": function(el,event){return delSalaryById(el.dataset.id);},
  "delSpecialById(this.dataset.id)": function(el,event){return delSpecialById(el.dataset.id);},
  "delTxById(this.dataset.id)": function(el,event){return delTxById(el.dataset.id);},
  "editFixedCostById(this.dataset.id)": function(el,event){return editFixedCostById(el.dataset.id);},
  "editSpecialById(this.dataset.id)": function(el,event){return editSpecialById(el.dataset.id);},
  "editTxById(this.dataset.id)": function(el,event){return editTxById(el.dataset.id);},
  "show('dash')": function(el,event){return show('dash');},
  "show('entry')": function(el,event){return show('entry');},
  "show('salary')": function(el,event){return show('salary');},
  "show('invest')": function(el,event){return show('invest');},
  "show('life')": function(el,event){return show('life');},
  "show('tools')": function(el,event){return show('tools');},
  "setDashBreakdown('asset')": function(el,event){return setDashBreakdown('asset');},
  "setDashBreakdown('goal')": function(el,event){return setDashBreakdown('goal');},
  "setNisaChartRange('1y')": function(el,event){return setNisaChartRange('1y');},
  "setNisaChartRange('3y')": function(el,event){return setNisaChartRange('3y');},
  "setNisaChartRange('all')": function(el,event){return setNisaChartRange('all');},
  "resolveAppConfirm(true)": function(el,event){return resolveAppConfirm(true);},
  "resolveAppConfirm(false)": function(el,event){return resolveAppConfirm(false);},
  "importBackup(false)": function(el,event){return importBackup(false);},
  "showNisaPointFromEl(this,event)": function(el,event){return showNisaPointFromEl(el,event);},
  "selectSalaryYear(this.value)": function(el,event){return selectSalaryYear(el.value);},
  "selectSalaryMonth": function(el,event){return selectSalaryMonth(Number(el.dataset.month),el);},
  "nisaPointKey": function(el,event){return (['Enter',' '].includes(event.key)?showNisaPointFromEl(el,event):undefined);},
  "jumpTo('entry','txInputTitle')": function(el,event){return jumpTo('entry','txInputTitle');},
  "jumpTo('salary','salaryTitle')": function(el,event){return jumpTo('salary','salaryTitle');},
  "jumpTo('invest','nisaInputTitle','nisa')": function(el,event){return jumpTo('invest','nisaInputTitle','nisa');},
  "jumpTo('invest','nisaGraphCard','nisa')": function(el,event){return jumpTo('invest','nisaGraphCard','nisa');},
  "jumpTo('tools','furusatoTitle')": function(el,event){return jumpTo('tools','furusatoTitle');},
  "jumpTo('tools','taxSimTitle')": function(el,event){return jumpTo('tools','taxSimTitle');},
  "jumpTo('life','specialTitle')": function(el,event){return jumpTo('life','specialTitle');},
  "jumpTo('life','fixedCostTitle')": function(el,event){return jumpTo('life','fixedCostTitle');},
  "fillTxPreset('昼食','食費','変動費','支出')": function(el,event){return fillTxPreset('昼食','食費','変動費','支出');},
  "fillTxPreset('ガソリン','車','変動費','支出')": function(el,event){return fillTxPreset('ガソリン','車','変動費','支出');},
  "fillTxPreset('医療費','医療費','変動費','支出')": function(el,event){return fillTxPreset('医療費','医療費','変動費','支出');},
  "fillTxPreset('日用品','日用品','変動費','支出')": function(el,event){return fillTxPreset('日用品','日用品','変動費','支出');},
  "fillTxPreset('外食','食費','変動費','支出')": function(el,event){return fillTxPreset('外食','食費','変動費','支出');},
  "fillTxPreset('サブスク','固定費','固定費','支出')": function(el,event){return fillTxPreset('サブスク','固定費','固定費','支出');}
});
var commandBusy=false;
['click','change','input','keydown'].forEach(function(type){
  document.addEventListener(type,async function(event){
    var el=event.target&&event.target.closest?event.target.closest('[data-'+type+']'):null;
    if(!el)return;
    var command=el.getAttribute('data-'+type),handler=commandHandlers[command];
    if(!Object.prototype.hasOwnProperty.call(commandHandlers,command))return;
    if(commandBusy)return;
    commandBusy=true;
    try{await handler(el,event);}catch(e){visibleError(e.message||'操作を完了できませんでした。');}
    finally{commandBusy=false;}
  });
});
// Release prepared backup text and password inputs when leaving the page.
window.addEventListener('pagehide',function(){backupCache=null;var dlg=$('backupPasswordDialog');if(dlg)dlg.remove();});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape')closeMenu()});
startPasswordless().catch(showRecovery);
})();

// v4.77: smoother iOS-style tab bar, five-second addition confirmation, and unified native date picker.
(function(){
  const bar=document.getElementById('nav');
  if(!bar) return;
  let lastY=window.scrollY||0;
  let downTravel=0;
  let upTravel=0;
  let ticking=false;
  let compact=bar.classList.contains('ios26-compact');
  let lastToggle=0;

  const setCompact=(next)=>{
    if(next===compact) return;
    const now=performance.now();
    if(now-lastToggle<180) return;
    compact=next;
    lastToggle=now;
    bar.classList.toggle('ios26-compact',next);
    downTravel=0;
    upTravel=0;
  };

  const update=()=>{
    const y=Math.max(0,window.scrollY||0);
    const delta=y-lastY;
    if(Math.abs(delta)>.5){
      if(delta>0){
        downTravel=Math.min(80,downTravel+delta);
        upTravel=Math.max(0,upTravel-delta*.7);
      }else{
        upTravel=Math.min(80,upTravel-delta);
        downTravel=Math.max(0,downTravel+delta*.7);
      }
    }

    if(y<34){
      setCompact(false);
    }else if(!compact && y>88 && downTravel>30){
      setCompact(true);
    }else if(compact && upTravel>22){
      setCompact(false);
    }

    lastY=y;
    ticking=false;
  };

  window.addEventListener('scroll',()=>{
    if(!ticking){
      ticking=true;
      requestAnimationFrame(update);
    }
  },{passive:true});

  bar.addEventListener('click',()=>setCompact(false));
})();

// v4.86: Scriptable's iOS WebView can move fixed elements above the software keyboard.
// Temporarily move the tab bar out while an editable control or native picker is active.
(function(){
  const root=document.body;
  const viewport=window.visualViewport;
  let restoreTimer=null;

  const isEditable=(el)=>{
    if(!el||el.disabled||el.readOnly) return false;
    const tag=String(el.tagName||'').toLowerCase();
    if(tag==='textarea'||tag==='select') return true;
    if(tag!=='input') return false;
    const type=String(el.type||'text').toLowerCase();
    return !/^(button|submit|reset|checkbox|radio|file|hidden|range|color)$/.test(type);
  };

  const viewportHasKeyboard=()=>{
    if(!viewport) return false;
    const full=Math.max(window.innerHeight||0,document.documentElement.clientHeight||0);
    return full>0&&viewport.height<full*.78;
  };

  const setKeyboardOpen=(open)=>{
    if(restoreTimer){clearTimeout(restoreTimer);restoreTimer=null;}
    root.classList.toggle('keyboard-open',!!open);
  };

  document.addEventListener('focusin',(event)=>{
    if(isEditable(event.target)) setKeyboardOpen(true);
  });

  document.addEventListener('focusout',()=>{
    if(restoreTimer) clearTimeout(restoreTimer);
    restoreTimer=setTimeout(()=>{
      restoreTimer=null;
      const active=document.activeElement;
      if(!isEditable(active)&&!viewportHasKeyboard()) root.classList.remove('keyboard-open');
    },220);
  });

  if(viewport){
    viewport.addEventListener('resize',()=>{
      if(viewportHasKeyboard()) setKeyboardOpen(true);
      else if(!isEditable(document.activeElement)){
        if(restoreTimer) clearTimeout(restoreTimer);
        restoreTimer=setTimeout(()=>{restoreTimer=null;root.classList.remove('keyboard-open')},180);
      }
    },{passive:true});
  }
})();

