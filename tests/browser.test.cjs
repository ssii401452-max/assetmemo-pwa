'use strict';
// Run after `npm install --no-save playwright && npx playwright install chromium`.
// CHROMIUM_PATH can select an already installed Chromium executable.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const shell=new Set(['index.html','index.html.html','security-v4.91.js','app-v4.91.js','register-sw-v4.91.js','service-worker.js','manifest.webmanifest','icon-192.png','icon-512.png']);
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
const probeScript="try{eval('window.evalExecuted=1');window.probeEvalBlocked=false}catch(e){window.probeEvalBlocked=e instanceof EvalError}try{new Function('return 1')();window.probeFunctionBlocked=false}catch(e){window.probeFunctionBlocked=e instanceof EvalError}";
const probeHash='sha384-'+require('node:crypto').createHash('sha384').update(probeScript).digest('base64');
const server=http.createServer((req,res)=>{

  const url=new URL(req.url,'http://localhost');let file=url.pathname.replace(/^\/assetmemo-pwa\//,'')||'index.html';
  if(file==='csp-probe.js'){res.writeHead(200,{'content-type':'application/javascript'}).end(probeScript);return;}
  if(file==='csp-probe.html'){const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),meta=html.match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)[0].replace(/script-src /,"script-src '"+probeHash+"' " );res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><head>'+meta+'</head><body><script src="./csp-probe.js" integrity="'+probeHash+'"></script></body>');return;}
  if(!url.pathname.startsWith('/assetmemo-pwa/')||!shell.has(file)){res.writeHead(404).end();return;}
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(fs.readFileSync(path.join(root,file)));
});
let count=0,browser,base;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(name,fn){await fn();count++;console.log('PASS '+name);}
async function loaded(page){await page.waitForFunction(()=>document.querySelector('#nav')&&!document.querySelector('#nav').classList.contains('hidden'));}
async function navigate(page,target,selector){await page.locator('nav [data-page="'+target+'"]').click();await page.locator(selector).waitFor({state:'visible'});}
async function state(page){return page.evaluate(async()=>{const vault=new AssetMemoSecurity.Vault();try{return await vault.load()}finally{vault.db?.close()}});}
async function dismissFlow(page){if(await page.locator('#addFlowLayer.show').count()){await page.locator('#addFlowLayer').click({force:true});await page.waitForFunction(()=>!document.querySelector('#addFlowLayer').classList.contains('show'));}}
async function addTransaction(page,memo='通常のメモ',amount='1200'){
  await navigate(page,'entry','#tx_memo');await page.locator('#tx_cat').fill('テスト食費');await page.locator('#tx_amount').fill(amount);await page.locator('#tx_memo').fill(memo);await page.locator('[data-click="addTx()"]').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('収支を追加'));
  await dismissFlow(page);
}
function legacy(value){const salt='test-salt';let x=2166136261>>>0;const seed='assetmemo-local-v490|'+salt;for(let i=0;i<seed.length;i++){x^=seed.charCodeAt(i);x=Math.imul(x,16777619)}const bytes=new TextEncoder().encode(JSON.stringify(value));for(let i=0;i<bytes.length;i++){x^=x<<13;x^=x>>>17;x^=x<<5;bytes[i]^=(x>>>0)&255}return JSON.stringify({v:1,salt,data:Buffer.from(bytes).toString('base64')})}
async function importFile(page,object){if(!await page.locator('[data-click="importBackup(false)"]').count())await navigate(page,'tools','#backupTitle');const waiting=page.waitForEvent('filechooser');await page.locator('[data-click="importBackup(false)"]').click();const chooser=await waiting;await chooser.setFiles({name:'test-backup.json',mimeType:'application/json',buffer:Buffer.from(typeof object==='string'?object:JSON.stringify(object))});}
async function confirm(page,ok=true){await page.locator('#appConfirm').waitFor({state:'visible'});await page.locator('button[data-click="resolveAppConfirm('+ok+')"]').click();}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port+'/assetmemo-pwa/';
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-webgl']});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[],external=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(base))external.push(request.url())});
  await check('passwordless startup, six tabs and strict CSP scripts load',async()=>{
    await page.goto(base);await loaded(page);assert.equal(await page.locator('#backupPasswordDialog').count(),0);assert.equal(await page.locator('nav button').count(),6);
    for(const [tab,selector] of [['entry','#tx_date'],['salary','#sal_date'],['invest','#nisa_date'],['life','#sp_name'],['tools','#set_age'],['dash','.hero']])await navigate(page,tab,selector);
  });
  await check('normal transaction persists across a full reload',async()=>{
    await addTransaction(page);assert.equal((await state(page)).transactions.length,1);await page.reload();await loaded(page);assert.equal((await state(page)).transactions[0].amount,1200);
  });
  await check('injected HTML in a memo renders only as text',async()=>{
    const payload='<img src="https://attacker.invalid/x" onerror="window.injected=1">';await addTransaction(page,payload);assert.equal(await page.locator('#app img').count(),0);assert.ok((await page.locator('#app').innerText()).includes(payload));assert.equal(await page.evaluate(()=>window.injected),undefined);assert.equal(external.length,0);
  });
  await check('salary, NISA, other investments, savings and fixed costs save',async()=>{
    await navigate(page,'salary','#sal_date');await page.locator('#sal_gross').fill('200000');await page.locator('#sal_net').fill('160000');await page.locator('[data-click="addSalary()"]').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('給与明細'));await dismissFlow(page);
    await navigate(page,'invest','#nisa_date');await page.locator('#nisa_contrib').fill('10000');await page.locator('#nisa_value').fill('11000');await page.locator('[data-click="addNisa()"]').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('NISAを追加'));await dismissFlow(page);
    await page.locator('[data-click="showOtherTab()"]').click();await page.locator('#oi_name').waitFor();await page.locator('#oi_name').fill('試験用銘柄');await page.locator('#oi_principal').fill('1000');await page.locator('#oi_value').fill('1100');await page.locator('[data-click="addOtherInvest()"]').click();await page.waitForFunction(()=>document.querySelector('#addFlowLayer').classList.contains('show'));await dismissFlow(page);
    await navigate(page,'life','#sp_name');await page.locator('#sp_name').fill('旅行');await page.locator('#sp_target').fill('120000');await page.locator('#sp_deposit').fill('1000');await page.locator('[data-click="addSpecial()"]').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('特別支出'));await dismissFlow(page);
    await page.locator('[data-click="showFixedTab()"]').click();await page.locator('#fix_name').waitFor();await page.locator('#fix_name').fill('試験用通信費');await page.locator('#fix_amount').fill('2000');await page.locator('[data-click="addFixedCost()"]').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('固定費を追加'));await dismissFlow(page);
    const saved=await state(page);for(const key of ['salary','nisa','otherInvest','specials','fixedCosts'])assert.equal(saved[key].length,1);
  });
  await check('CSV quoted fields work and a later bad row causes no partial import',async()=>{
    await navigate(page,'tools','#csv_text');await page.locator('#csv_text').fill('日付,種類,金額,カテゴリ,区分,メモ\n2026-10-27,支出,"1,234",食費,変動費,"引用,あり"');await page.locator('[data-click="importCsvText()"]').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('1件取り込み'));let saved=await state(page);assert.equal(saved.transactions.at(-1).memo,'引用,あり');assert.equal(saved.transactions.at(-1).amount,1234);
    const before=saved.transactions.length;await page.locator('#csv_text').fill('2026-10-27,支出,100,食費,変動費,正常\n2026-99-99,支出,100,食費,変動費,不正');await page.locator('[data-click="importCsvText()"]').click();await page.locator('#saveError').waitFor();assert.equal((await state(page)).transactions.length,before);
  });
  await check('backup generation asks only at export and cancellation writes no timestamp',async()=>{
    const before=(await state(page)).settings.lastBackupAt;await page.locator('[data-click="exportBackup()"]').click();await page.locator('#backupPasswordDialog').waitFor();await page.getByRole('button',{name:'キャンセル',exact:true}).last().click();assert.equal((await state(page)).settings.lastBackupAt,before);
  });
  let backup;
  await check('AES-GCM backup excludes plaintext and marks success only after download',async()=>{
    await page.locator('[data-click="exportBackup()"]').click();await page.locator('#backupPasswordDialog input').nth(0).fill('browser-test-password-2026');await page.locator('#backupPasswordDialog input').nth(1).fill('browser-test-password-2026');await page.locator('#backupPasswordDialog button[type="submit"]').click();await page.locator('#backup_text').waitFor();backup=JSON.parse(await page.locator('#backup_text').inputValue());assert.equal(backup.format,'assetmemo-backup-v491');assert.equal(JSON.stringify(backup).includes('通常のメモ'),false);assert.equal((await state(page)).settings.lastBackupAt,undefined);
    const download=page.waitForEvent('download');await page.locator('[data-click="downloadPreparedBackup()"]').click();await download;await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('ダウンロード'));assert.ok((await state(page)).settings.lastBackupAt);
  });
  await check('bad import is rejected before any live or durable state changes',async()=>{
    const before=await state(page);const malicious=JSON.parse(JSON.stringify(before));malicious.settings.studentLoanPlanStart='" autofocus onfocus="window.injected=1';await importFile(page,malicious);await page.locator('#saveError').waitFor();assert.deepEqual(await state(page),before);
    await importFile(page,'{"settings":{},"__proto__":{"polluted":true}}');await page.waitForFunction(()=>document.querySelector('#saveError').textContent.includes('項目名'));assert.deepEqual(await state(page),before);assert.equal(await page.evaluate(()=>({}).polluted),undefined);
  });
  await check('exported backup decrypts on a fresh device and restore waits for confirmation',async()=>{
    const fresh=await browser.newContext(),p=await fresh.newPage();p.setDefaultTimeout(10000);await p.goto(base);await loaded(p);await importFile(p,backup);await p.locator('#backupPasswordDialog input').fill('browser-test-password-2026');await p.locator('#backupPasswordDialog button[type="submit"]').click();await p.locator('#appConfirm').waitFor({state:'visible'});assert.equal((await state(p)).transactions.length,0);await confirm(p);await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('復元しました'));assert.equal((await state(p)).transactions.length,3);assert.equal(await p.locator('#backupPasswordDialog').count(),0);await fresh.close();
  });
  await check('wrong password and cancelled restore preserve existing data',async()=>{
    const before=await state(page);await importFile(page,backup);await page.locator('#backupPasswordDialog input').fill('definitely-wrong-password');await page.locator('#backupPasswordDialog button[type="submit"]').click();await page.locator('#backupPasswordDialog [role="alert"]').filter({hasText:'パスワード'}).waitFor();assert.deepEqual(await state(page),before);await page.locator('#backupPasswordDialog button[type="button"]').click();
    await importFile(page,before);await confirm(page,false);assert.deepEqual(await state(page),before);
  });
  await check('a failed save does not drop an earlier valid record or claim success',async()=>{
    const before=await state(page);await page.evaluate(()=>{AssetMemoSecurity.Vault.prototype.save=async()=>{throw new Error('テスト用の保存失敗')}});await navigate(page,'entry','#tx_amount');await page.locator('#tx_amount').fill('999');await page.locator('[data-click="addTx()"]').click();await page.waitForFunction(()=>document.querySelector('#saveError')?.textContent.includes('保存失敗'));assert.deepEqual(await state(page),before);await page.reload();await loaded(page);assert.deepEqual(await state(page),before);
  });
  await check('simultaneous tabs detect conflicts without overwriting a newer record',async()=>{
    const second=await context.newPage();second.setDefaultTimeout(10000);await second.goto(base);await loaded(second);await addTransaction(page,'先のタブ');const before=await state(page);await navigate(second,'entry','#tx_amount');await second.locator('#tx_amount').fill('111');await second.locator('[data-click="addTx()"]').click();await second.waitForFunction(()=>document.querySelector('#saveError')?.textContent.includes('別のタブ'));assert.deepEqual(await state(page),before);await second.close();
  });
  await check('legacy local data migrates once and weak copies are removed only after commit',async()=>{
    const c=await browser.newContext();await c.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:'finance_scriptable_v4_4_vault',value:legacy({settings:{currentAge:24},transactions:[{id:'legacy1',date:'2026-10-27',type:'支出',kind:'変動費',amount:55}]})});const p=await c.newPage();await p.goto(base);await loaded(p);assert.equal((await state(p)).transactions[0].amount,55);assert.equal(await p.evaluate(()=>localStorage.getItem('finance_scriptable_v4_4_vault')),null);await c.close();
  });
  await check('corrupt legacy data is retained without any automatic initialization',async()=>{
    const c=await browser.newContext();await c.addInitScript(()=>localStorage.setItem('finance_scriptable_v4_4_vault','invalid-json-test'));const p=await c.newPage();await p.goto(base);await p.locator('#recoveryMessage').waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('finance_scriptable_v4_4_vault')),'invalid-json-test');assert.equal(await state(p),null);await c.close();
  });
  await check('corrupt authenticated vault stops without overwriting ciphertext',async()=>{
    const c=await browser.newContext(),p=await c.newPage();await p.goto(base);await loaded(p);const before=await p.evaluate(async()=>{const v=new AssetMemoSecurity.Vault();await v.load();const {box}=await v.records();box.data=btoa('tamper test ciphertext');await new Promise((resolve,reject)=>{const tx=v.db.transaction('vault','readwrite');tx.objectStore('vault').put(box,'data');tx.oncomplete=resolve;tx.onabort=reject});v.db.close();return JSON.stringify(box)});await p.reload();await p.locator('#recoveryMessage').waitFor();assert.equal(await p.evaluate(async()=>{const v=new AssetMemoSecurity.Vault();const {box}=await v.records();v.db.close();return JSON.stringify(box)}),before);await c.close();
  });
  await check('inline scripts, inline event handlers, eval and remote fetch are blocked',async()=>{
    const results=await page.evaluate(async()=>{
      window.cspScript=0;window.cspHandler=0;const script=document.createElement('script');script.textContent='window.cspScript=1';document.body.appendChild(script);const button=document.createElement('button');button.setAttribute('onclick','window.cspHandler=1');document.body.appendChild(button);button.click();let blockedFetch=false;try{await fetch('https://attacker.invalid/test')}catch(_){blockedFetch=true}await new Promise(r=>setTimeout(r,50));button.remove();script.remove();return {script:window.cspScript,handler:window.cspHandler,blockedFetch};
    });assert.deepEqual(results,{script:0,handler:0,blockedFetch:true});
    const probe=await context.newPage();await probe.goto(base+'csp-probe.html');await probe.waitForFunction(()=>typeof window.probeEvalBlocked==='boolean');assert.deepEqual(await probe.evaluate(()=>({eval:window.probeEvalBlocked,Function:window.probeFunctionBlocked})),{eval:true,Function:true});await probe.close();
  });
  await check('offline relaunch uses cached app assets and retains records',async()=>{
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,{},{timeout:10000});const before=await state(page);await context.setOffline(true);await page.reload();await loaded(page);assert.deepEqual(await state(page),before);await context.setOffline(false);
  });
  await check('reset requires confirmation and cancelled reset preserves records',async()=>{
    await navigate(page,'tools','#backupTitle');const before=await state(page);await page.locator('[data-click="resetAllInputData()"]').click();await confirm(page,false);assert.deepEqual(await state(page),before);
  });
  await check('new and legacy records coexisting are preserved without a silent overwrite',async()=>{
    const c=await browser.newContext(),p=await c.newPage();await p.goto(base);await loaded(p);const raw=legacy({settings:{currentAge:24},transactions:[{id:'older1',date:'2026-10-27',type:'支出',kind:'変動費',amount:77}]});await p.evaluate(value=>localStorage.setItem('finance_scriptable_v4_4_vault',value),raw);await p.reload();await loaded(p);assert.equal((await state(p)).transactions.length,0);assert.equal(await p.evaluate(()=>localStorage.getItem('finance_scriptable_v4_4_vault')),raw);await p.locator('#saveError').filter({hasText:'旧版の記録'}).waitFor();await c.close();
  });
  await check('SRI rejects a modified external application script',async()=>{
    const c=await browser.newContext();await c.route('**/app-v4.91.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(path.join(root,'app-v4.91.js'),'utf8')+'\nwindow.sriInjected=1;'}));const p=await c.newPage();await p.goto(base);assert.equal(await p.evaluate(()=>window.sriInjected),undefined);assert.equal(await p.locator('#nav.hidden').count(),1);assert.equal(await state(p),null);await c.close();
  });
  await check('no runtime errors, no application lock and mobile layout fits',async()=>{
    assert.deepEqual(errors,[]);assert.equal(await page.locator('#lockscreen:not(.hidden)').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await page.screenshot({path:path.join(root,'.work/mobile-settings.png'),fullPage:true});
  });
  await context.close();console.log('Browser checks passed: '+count);
})().catch(async error=>{console.error(error);process.exitCode=1;try{const contexts=browser?.contexts()||[];const page=contexts[0]?.pages()[0];if(page){await page.screenshot({path:path.join(root,'.work/browser-failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(0,1500));}}catch(_){} }).finally(async()=>{if(browser)await browser.close();server.close()});
