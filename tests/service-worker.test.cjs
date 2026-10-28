'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(network = async request => new Response('ok',{headers:{'content-type':String(request.url||request).endsWith('.js')?'application/javascript':'text/html'}})) {
  const handlers={},stores=new Map(),scope='https://example.test/assetmemo-pwa/';
  const caches={
    async keys(){return [...stores.keys()]},
    async delete(key){return stores.delete(key)},
    async open(key){if(!stores.has(key))stores.set(key,new Map());const items=stores.get(key);return {async put(url,response){items.set(String(url),response.clone())},async match(url){return items.get(String(url))?.clone()}}}
  };
  let activated=false,claimed=false;
  const self={registration:{scope},location:new URL(scope),addEventListener(name,fn){handlers[name]=fn},async skipWaiting(){activated=true},clients:{async claim(){claimed=true}}};
  const context={self,caches,URL,Request,Response,Set,Promise,fetch:network};vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../service-worker.js'),'utf8'),context);
  async function dispatch(name,request){let work;handlers[name]({request,waitUntil(p){work=p},respondWith(p){work=p}});return work?await work:undefined}
  return {stores,caches,dispatch,scope,active:()=>activated,claimed:()=>claimed};
}
test('installs and activates only after complete script shell is downloaded',async()=>{
  const env=setup();await env.dispatch('install');assert.equal(env.active(),true);assert.equal(env.stores.size,1);assert.equal([...env.stores.values()][0].size,7);
});
test('fails closed on a missing or HTML-disguised script',async()=>{
  const env=setup(async request=>new Response('login',{headers:{'content-type':'text/html'}}));
  await assert.rejects(env.dispatch('install'));assert.equal(env.active(),false);
});
test('deletes only this app scoped older caches and its known legacy cache',async()=>{
  const env=setup();env.stores.set('another-app-cache',new Map());env.stores.set('assetmemo-pwa:/other/:v4.90',new Map());env.stores.set('assetmemo-pwa:/assetmemo-pwa/:v4.90',new Map());env.stores.set('assetmemo-pwa-v1.3.0',new Map());
  await env.dispatch('install');await env.dispatch('activate');
  assert.equal(env.stores.has('another-app-cache'),true);assert.equal(env.stores.has('assetmemo-pwa:/other/:v4.90'),true);assert.equal(env.stores.has('assetmemo-pwa:/assetmemo-pwa/:v4.90'),false);assert.equal(env.stores.has('assetmemo-pwa-v1.3.0'),false);assert.equal(env.claimed(),true);
});
test('ignores cross-origin, out-of-scope, query-string and write requests',async()=>{
  const env=setup();for(const request of [
    {url:'https://other.test/app-v4.91.js',method:'GET'},
    {url:'https://example.test/other/index.html',method:'GET'},
    {url:env.scope+'private.json',method:'GET'},
    {url:env.scope+'app-v4.91.js?private=1',method:'GET'},
    {url:env.scope+'index.html',method:'POST'}
  ])assert.equal(await env.dispatch('fetch',request),undefined);
});
test('offline navigation uses its installed shell without serving another app document',async()=>{
  let offline=false;const env=setup(async request=>{if(offline)throw new Error('offline');return new Response('installed-shell',{headers:{'content-type':String(request.url||request).endsWith('.js')?'application/javascript':'text/html'}})});
  await env.dispatch('install');offline=true;
  assert.equal(await (await env.dispatch('fetch',{url:env.scope,method:'GET',mode:'navigate'})).text(),'installed-shell');
});
test('network HTML is never written over an older release offline cache',async()=>{
  let newVersion=false;const env=setup(async request=>new Response(newVersion?'new-document':'installed-shell',{headers:{'content-type':String(request.url||request).endsWith('.js')?'application/javascript':'text/html'}}));
  await env.dispatch('install');newVersion=true;assert.equal(await(await env.dispatch('fetch',{url:env.scope,method:'GET',mode:'navigate'})).text(),'new-document');
  assert.equal(await [...env.stores.values()][0].get(env.scope+'index.html').text(),'installed-shell');
});
