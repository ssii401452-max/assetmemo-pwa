'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
let FDB;
try { FDB = require('fake-indexeddb'); }
catch (_) { FDB = require('../.work/test-deps/node_modules/fake-indexeddb'); }
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
require('../security-v4.91.js');
const S = globalThis.AssetMemoSecurity;
const password = 'test-only-password-2026';
function fixture() {
  return { settings: { currentAge: 24, retireAge: 65, studentLoanTargetMonths: 240 }, transactions: [{ id: 'record1', date: '2026-10-28', type: '支出', kind: '変動費', amount: 1200, memo: 'テスト' }] };
}
function legacy(value, pw = 'assetmemo-local-v490') {
  const salt = 'test-legacy-salt';
  let x = 2166136261 >>> 0;
  const seed = pw + '|' + salt;
  for (let i = 0; i < seed.length; i++) { x ^= seed.charCodeAt(i); x = Math.imul(x, 16777619); }
  const data = new TextEncoder().encode(JSON.stringify(value));
  for (let i = 0; i < data.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; data[i] ^= (x >>> 0) & 255; }
  return { v: 1, salt, data: Buffer.from(data).toString('base64') };
}
test('canonical state preserves supported financial fields', () => {
  const state = S.validateState(fixture());
  assert.equal(state.transactions[0].amount, 1200);
  assert.equal(state.version, '4.91');
  assert.ok(S.COLLECTIONS.every(key => Array.isArray(state[key])));
});
test('HTML payload remains inert text, dates and IDs cannot become markup', () => {
  const data = fixture();
  data.transactions[0].memo = '<img src=x onerror=alert(1)>';
  assert.equal(S.validateState(data).transactions[0].memo, data.transactions[0].memo);
  data.settings.studentLoanPlanStart = '" autofocus onfocus="alert(1)';
  assert.throws(() => S.validateState(data));
  delete data.settings.studentLoanPlanStart;
  data.transactions[0].id = '" onclick="alert(1)';
  assert.throws(() => S.validateState(data));
});
test('rejects prototype pollution at any depth', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) assert.throws(() => S.parse('{"settings":{},"nested":{"' + key + '":{}}}'));
  assert.equal({}.polluted, undefined);
});
test('rejects duplicate/reserved IDs, non-finite numbers, out of range ages', () => {
  const data = fixture();
  data.transactions.push({ ...data.transactions[0] });
  assert.throws(() => S.validateState(data));
  data.transactions.pop();data.transactions[0].id='__proto__';assert.throws(() => S.validateState(data));
  data.transactions[0].id='ok';data.transactions[0].amount=Infinity;assert.throws(() => S.validateState(data));
  data.transactions[0].amount=1;data.settings.retireAge=1e9;assert.throws(() => S.validateState(data));
});
test('validates calendar dates including leap years', () => {
  assert.equal(S.date('2024-02-29'), '2024-02-29');
  for (const date of ['2026-02-29', '2026-13-01', '2026-01-99', '<svg/onload=x>']) assert.throws(() => S.date(date));
});
test('rejects deep input, long text, excessive rows and oversize files', () => {
  assert.throws(() => S.parse(' '.repeat(S.MAX_FILE + 1)));
  assert.throws(() => S.parse('{"a":'.repeat(14) + '1' + '}'.repeat(14)));
  const data = fixture();data.transactions[0].memo='a'.repeat(4097);assert.throws(() => S.validateState(data));
  data.transactions=Array(20001).fill({});assert.throws(() => S.validateState(data));
});
test('backup is portable and round trips without any device key', async () => {
  const box = await S.encryptBackup(fixture(), password);
  assert.equal(box.iterations, 600000);
  assert.equal(JSON.stringify(box).includes('テスト'), false);
  assert.deepEqual(await S.decryptBackup(JSON.parse(JSON.stringify(box)), password), S.validateState(fixture()));
});
test('wrong backup password fails authentication', async () => {
  const box = await S.encryptBackup(fixture(), password);
  await assert.rejects(S.decryptBackup(box, 'wrong-password-2026'));
});
test('tampered ciphertext/IV fail authentication and KDF abuse is rejected', async () => {
  const box = await S.encryptBackup(fixture(), password);
  const data = Buffer.from(box.data, 'base64');data[0] ^= 1;
  await assert.rejects(S.decryptBackup({ ...box, data: data.toString('base64') }, password));
  await assert.rejects(S.decryptBackup({ ...box, iv: Buffer.alloc(12, 1).toString('base64') }, password));
  await assert.rejects(S.decryptBackup({ ...box, iterations: 2147483647 }, password));
  await assert.rejects(S.decryptBackup({ ...box, algorithm: 'XOR' }, password));
});
test('backup salt/nonce/ciphertext change on every export', async () => {
  const a = await S.encryptBackup(fixture(), password), b = await S.encryptBackup(fixture(), password);
  assert.notEqual(a.salt, b.salt);assert.notEqual(a.iv, b.iv);assert.notEqual(a.data, b.data);
  await assert.rejects(S.encryptBackup(fixture(), 'short'));
});
test('legacy decrypt is read-only and compatible with UTF-16 passwords', () => {
  assert.deepEqual(S.decryptLegacy(legacy(fixture())), S.validateState(fixture()));
  assert.deepEqual(S.decryptLegacy(legacy(fixture(), '旧版の🔑'), '旧版の🔑'), S.validateState(fixture()));
  assert.throws(() => S.decryptLegacy(legacy(fixture()), 'wrong'));
});
test('local key is random, non-extractable and stored in the same atomic commit', async () => {
  const factory = new FDB.IDBFactory();
  const vault = new S.Vault(factory);assert.equal(await vault.load(), null);
  await vault.save(fixture());const { box, key } = await vault.records();
  assert.equal(key.extractable, false);assert.equal(key.algorithm.name, 'AES-GCM');
  await assert.rejects(webcrypto.subtle.exportKey('raw', key));
  assert.equal(JSON.stringify(box).includes('テスト'), false);
  assert.deepEqual(await new S.Vault(factory).load(), S.validateState(fixture()));
});
test('concurrent tabs cannot silently overwrite a newer save', async () => {
  const factory = new FDB.IDBFactory();
  const first = new S.Vault(factory);await first.load();await first.save(fixture());
  const second = new S.Vault(factory);await second.load();
  const updated=fixture();updated.transactions[0].amount=99;await first.save(updated);
  await assert.rejects(second.save(fixture()), /別のタブ/);
  assert.equal((await new S.Vault(factory).load()).transactions[0].amount, 99);
});
test('invalid candidate leaves the previous durable snapshot untouched', async () => {
  const vault=new S.Vault(new FDB.IDBFactory());await vault.load();await vault.save(fixture());
  const before=(await vault.records()).box;
  const invalid=fixture();invalid.settings.retireAge=-1;
  assert.throws(() => vault.save(invalid));
  assert.deepEqual((await vault.records()).box, before);
});
test('corrupted vault is preserved and only explicit recovery replaces it', async () => {
  const factory=new FDB.IDBFactory(),vault=new S.Vault(factory);await vault.load();await vault.save(fixture());
  const records=await vault.records();records.box.data=Buffer.alloc(32).toString('base64');
  await new Promise((resolve,reject)=>{const tx=vault.db.transaction('vault','readwrite');tx.objectStore('vault').put(records.box,'data');tx.oncomplete=resolve;tx.onabort=reject;});
  const recovering=new S.Vault(factory);await assert.rejects(recovering.load());
  assert.deepEqual((await recovering.records()).box, records.box);
  await recovering.save(fixture(),true);
  assert.deepEqual(await new S.Vault(factory).load(),S.validateState(fixture()));
});
test('CSP hashes match all deployed scripts and inline handlers are absent', () => {
  const crypto=require('node:crypto'),root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.equal(/<script(?![^>]*\bsrc=)/.test(html),false);
  assert.equal(/\son(?:click|input|change|keydown)=/.test(html),false);
  assert.ok(html.includes("script-src-attr 'none'"));assert.ok(html.includes("form-action 'none'"));
  for(const file of ['security-v4.91.js','app-v4.91.js','register-sw-v4.91.js']){
    const hash='sha384-'+crypto.createHash('sha384').update(fs.readFileSync(path.join(root,file))).digest('base64');
    assert.ok(html.includes('integrity="'+hash+'"'));assert.ok(html.includes("'"+hash+"'"));
    new vm.Script(fs.readFileSync(path.join(root,file),'utf8'));
  }
  assert.equal(/\beval\s*\(|new Function\s*\(/.test(fs.readFileSync(path.join(root,'app-v4.91.js'),'utf8')),false);
});
