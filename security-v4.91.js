/* Local-only storage and authenticated, portable backups. No application lock. */
(function (root) {
  'use strict';
  const FORMAT = 'assetmemo-backup-v491';
  const ITERATIONS = 600000;
  const MAX_TEXT = 4 * 1024 * 1024;
  const MAX_FILE = 8 * 1024 * 1024;
  const MAX_ROWS = 20000;
  const COLLECTIONS = ['transactions', 'salary', 'nisa', 'otherInvest', 'specials', 'subs', 'fixedCosts', 'budgets'];
  const LEGACY_STORE = 'finance_scriptable_v4_4_vault';
  const LEGACY_PASSWORD_STORE = 'finance_scriptable_v49_saved_password';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  function fail(message) { throw new Error(message); }
  function plain(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }
  function rejectDangerous(value, depth = 0, budget = { nodes: 0 }) {
    if (depth > 12 || ++budget.nodes > 500000) fail('データの構造が複雑すぎます。');
    if (value && typeof value === 'object') {
      if (!Array.isArray(value) && !plain(value)) fail('データの形式が違います。');
      for (const key of Object.keys(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('使用できない項目名があります。');
        rejectDangerous(value[key], depth + 1, budget);
      }
    }
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > MAX_FILE || encoder.encode(text).length > MAX_FILE) fail('ファイルは8MB以下にしてください。');
    const value = JSON.parse(text);
    rejectDangerous(value);
    return value;
  }
  function text(value, max = 4096) {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail('文字列の形式・長さを確認してください。');
    return value;
  }
  function number(value, min = -1e12, max = 1e12) {
    if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)) value = Number(value);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('数値が許容範囲を超えています。');
    return value;
  }
  function date(value, optional = true) {
    if (optional && value === '') return '';
    text(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('日付はYYYY-MM-DDで指定してください。');
    const d = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value || Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 2200) fail('日付が許容範囲外です。');
    return value;
  }
  function timestamp(value) {
    text(value, 32);
    if (value === '') return value;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail('日時の形式が違います。');
    return value;
  }
  const numericSettings = {
    currentAge: [0, 120], birthYearEstimate: [0, 2200], retireAge: [0, 130],
    nisaAnnualReturn: [-100, 100], nisaSafety: [0, 100], housingAllowanceNetRate: [0, 100],
    studentLoanRate: [0, 100], studentLoanTargetMonths: [1, 240], studentLoanPrepayMonth: [1, 12],
    defenseMonths: [0, 120], rentRatioLimit: [0, 100], furusatoTrackingYear: [1900, 2200]
  };
  const moneySettings = ['cashNow', 'pointsNow', 'studentLoanBalance', 'studentLoanMonthly', 'studentLoanPrepay',
    'monthlyExpenseManual', 'monthlyBudget', 'netIncomeManual', 'rent', 'housingAllowanceGross',
    'housingAllowanceNet', 'studentLoanOpeningBalance', 'studentLoanBonus', 'furusatoRemainingBonusEstimate', 'furusatoDonatedAmount'];
  const schemas = {
    transactions: { strings: ['category', 'memo', 'type', 'kind'], numbers: ['amount'], dates: ['date'] },
    salary: { strings: ['memo'], numbers: ['gross', 'net', 'bonus', 'incomeTax', 'residentTax', 'health', 'pension', 'employment', 'housing'], dates: ['date'] },
    nisa: { strings: ['memo'], numbers: ['contribution', 'value'], dates: ['date'] },
    otherInvest: { strings: ['name', 'type', 'memo'], numbers: ['principal', 'value'], dates: ['date'] },
    specials: { strings: ['name'], numbers: ['target', 'current'], dates: ['due'] },
    subs: { strings: ['name', 'kind', 'cycle'], numbers: ['amount'], dates: [] },
    fixedCosts: { strings: ['name', 'kind', 'cycle'], numbers: ['amount', 'loanBalance', 'loanBonus'], dates: ['loanEnd'] },
    budgets: { strings: ['name', 'category', 'month'], numbers: ['amount'], dates: [] }
  };
  function validateState(input) {
    rejectDangerous(input);
    if (!plain(input) || !plain(input.settings)) fail('資産メモのデータではありません。');
    const out = { version: '4.91', settings: {} };
    const s = input.settings;
    for (const [key, bounds] of Object.entries(numericSettings)) if (s[key] != null) out.settings[key] = number(s[key], ...bounds);
    for (const key of moneySettings) if (s[key] != null) out.settings[key] = number(s[key]);
    for (const key of ['studentLoanPlanRegistered', 'furusatoFinalConfirmed']) {
      if (s[key] != null) { if (typeof s[key] !== 'boolean') fail('設定の形式が違います。'); out.settings[key] = s[key]; }
    }
    if (s.studentLoanPlanStart != null) out.settings.studentLoanPlanStart = date(s.studentLoanPlanStart);
    for (const key of ['lastBackupAt', 'lastRestoreAt']) if (s[key] != null) out.settings[key] = timestamp(s[key]);
    let total = 0;
    for (const key of COLLECTIONS) {
      const rows = input[key] === undefined ? [] : input[key];
      if (!Array.isArray(rows) || rows.length > MAX_ROWS || (total += rows.length) > MAX_ROWS) fail('記録は合計20,000件までです。');
      const ids = new Set();
      const schema = schemas[key];
      out[key] = rows.map(row => {
        if (!plain(row)) fail('記録の形式が違います。');
        // Older versions used generated alphanumeric IDs. Reject ambiguous DOM IDs.
        if (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id) || ['__proto__', 'prototype', 'constructor'].includes(row.id) || ids.has(row.id)) fail('記録IDが不正または重複しています。');
        ids.add(row.id);
        const item = { id: row.id };
        for (const field of schema.strings) if (row[field] != null) item[field] = text(row[field]);
        for (const field of schema.numbers) if (row[field] != null) item[field] = number(row[field]);
        for (const field of schema.dates) item[field] = date(row[field] == null ? '' : row[field]);
        if ('active' in row) { if (typeof row.active !== 'boolean') fail('有効状態の形式が違います。'); item.active = row.active; }
        if (key === 'transactions' && item.type != null && !['収入', '支出'].includes(item.type)) fail('収支の種類が違います。');
        if (key === 'transactions' && item.kind != null && !['固定費', '変動費'].includes(item.kind)) fail('固定費・変動費の指定が違います。');
        if (key === 'specials') for (const field of ['history', 'deposits']) if (row[field] != null) {
          if (!Array.isArray(row[field]) || row[field].length > 2000 || (total += row[field].length) > MAX_ROWS) fail('入金履歴が多すぎます。');
          item[field] = row[field].map(h => { if (!plain(h)) fail('入金履歴の形式が違います。'); return { date: date(h.date || ''), amount: number(h.amount) }; });
        }
        return item;
      });
    }
    if (encoder.encode(JSON.stringify(out)).length > MAX_TEXT) fail('保存データは4MB以下にしてください。');
    return out;
  }
  function b64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  }
  function unb64(value, length) {
    if (typeof value !== 'string' || value.length > MAX_FILE || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail('暗号化データの形式が違います。');
    const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    if (length !== undefined && bytes.length !== length) fail('暗号化パラメータが違います。');
    return bytes;
  }
  function requireCrypto() {
    if (!root.crypto || !root.crypto.subtle || !root.crypto.getRandomValues) fail('HTTPSとWeb Cryptoに対応したブラウザで開いてください。');
  }
  function random(size) { requireCrypto(); return root.crypto.getRandomValues(new Uint8Array(size)); }
  async function backupKey(password, salt) {
    requireCrypto();
    if (typeof password !== 'string' || password.length < 12 || password.length > 1024) fail('バックアップ用パスワードは12〜1024文字にしてください。');
    const material = await root.crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return root.crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const backupAAD = encoder.encode(FORMAT + '|AES-256-GCM|PBKDF2-SHA256|' + ITERATIONS);
  async function encryptBackup(value, password) {
    const clean = validateState(value), salt = random(16), iv = random(12);
    const key = await backupKey(password, salt);
    const data = await root.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: backupAAD, tagLength: 128 }, key, encoder.encode(JSON.stringify(clean)));
    return { format: FORMAT, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data)), exportedAt: new Date().toISOString() };
  }
  async function decryptBackup(box, password) {
    if (!plain(box) || box.format !== FORMAT || box.algorithm !== 'AES-256-GCM' || box.kdf !== 'PBKDF2-SHA256' || box.iterations !== ITERATIONS) fail('対応していないバックアップ形式です。');
    const salt = unb64(box.salt, 16), iv = unb64(box.iv, 12), data = unb64(box.data);
    if (data.length < 16 || data.length > MAX_TEXT + 16) fail('バックアップのサイズが不正です。');
    const key = await backupKey(password, salt);
    let clear;
    try { clear = await root.crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: backupAAD, tagLength: 128 }, key, data); }
    catch (_) { fail('パスワードが違うか、バックアップが破損・改変されています。'); }
    return validateState(parse(decoder.decode(clear)));
  }
  // Read-only compatibility for v4.90 and earlier. Never use this to write data.
  function decryptLegacy(box, password = 'assetmemo-local-v490') {
    if (!plain(box) || typeof box.salt !== 'string' || box.salt.length > 256) fail('旧バックアップの形式が違います。');
    const bytes = unb64(box.data);
    if (bytes.length > MAX_TEXT) fail('旧データが大きすぎます。');
    let seed = 2166136261 >>> 0;
    const legacyInput = password + '|' + box.salt;
    for (let i = 0; i < legacyInput.length; i++) { seed ^= legacyInput.charCodeAt(i); seed = Math.imul(seed, 16777619); }
    for (let i = 0; i < bytes.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; bytes[i] ^= (seed >>> 0) & 255; }
    return validateState(parse(decoder.decode(bytes)));
  }
  class Vault {
    constructor(indexedDB = root.indexedDB) { this.idb = indexedDB; this.db = null; this.key = null; this.revision = 0; this.token = undefined; this.queue = Promise.resolve(); }
    async open() {
      requireCrypto();
      if (this.db) return;
      if (!this.idb) fail('このブラウザでは端末内保存を利用できません。');
      this.db = await new Promise((resolve, reject) => {
        const req = this.idb.open('assetmemo-secure-v491', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('vault');
        req.onsuccess = () => { const db = req.result; db.onversionchange = () => { db.close(); this.db = null; }; resolve(db); };
        req.onerror = () => reject(new Error('保存領域を開けませんでした。元のデータは変更していません。'));
        req.onblocked = () => reject(new Error('別のタブを閉じて、再読み込みしてください。'));
      });
    }
    async records() {
      await this.open();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('vault', 'readonly'), store = tx.objectStore('vault');
        const data = store.get('data'), key = store.get('key');
        tx.oncomplete = () => resolve({ box: data.result, key: key.result });
        tx.onerror = tx.onabort = () => reject(new Error('保存データを読み込めませんでした。'));
      });
    }
    async load() {
      const { box, key } = await this.records();
      this.token = JSON.stringify(box);
      this.key = key || null;
      this.revision = box && Number.isSafeInteger(box.revision) ? box.revision : 0;
      if (box === undefined && key === undefined) return null;
      if (!key || !plain(box) || box.version !== 1 || !Number.isSafeInteger(box.revision) || box.revision < 1) fail('保存データを開けません。元データを残して停止しました。');
      let clear;
      try { clear = await root.crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv, 12), additionalData: encoder.encode('assetmemo-local-v491|' + box.revision), tagLength: 128 }, key, unb64(box.data)); }
      catch (_) { fail('保存データを復号できません。元データを残して停止しました。'); }
      return validateState(parse(decoder.decode(clear)));
    }
    save(value, recovery = false) {
      const snapshot = validateState(value);
      const job = this.queue.then(() => this.write(snapshot, recovery));
      this.queue = job.catch(() => {});
      return job;
    }
    async write(snapshot, recovery) {
      await this.open();
      const key = (!this.key || recovery) ? await root.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) : this.key;
      const revision = recovery ? 1 : this.revision + 1, iv = random(12);
      if (!Number.isSafeInteger(revision) || revision < 1) fail('保存情報が不正です。バックアップから復元してください。');
      const data = await root.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode('assetmemo-local-v491|' + revision), tagLength: 128 }, key, encoder.encode(JSON.stringify(snapshot)));
      const box = { version: 1, revision, iv: b64(iv), data: b64(new Uint8Array(data)) };
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction('vault', 'readwrite'), store = tx.objectStore('vault');
        let conflict = false;
        const current = store.get('data');
        current.onsuccess = () => {
          if (JSON.stringify(current.result) !== this.token) { conflict = true; tx.abort(); return; }
          store.put(key, 'key'); store.put(box, 'data');
        };
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(new Error(conflict ? '別のタブで更新されました。再読み込みしてから操作してください。' : '保存できませんでした。前の保存データは残っています。'));
      });
      this.key = key; this.revision = revision; this.token = JSON.stringify(box);
      return snapshot;
    }
    async recoveryBundle(legacy) {
      const { box, key } = await this.records();
      // The device key is non-extractable and deliberately excluded.
      return JSON.stringify({ format: 'assetmemo-recovery-ciphertext-v491', note: '復旧調査用。通常のバックアップではありません。端末内の鍵は含みません。', box, hasDeviceKey: !!key, legacy: legacy || null }, null, 2);
    }
  }
  const api = { FORMAT, ITERATIONS, MAX_FILE, MAX_TEXT, MAX_ROWS, COLLECTIONS, LEGACY_STORE, LEGACY_PASSWORD_STORE,
    parse, validateState, encryptBackup, decryptBackup, decryptLegacy, Vault, date, number };
  root.AssetMemoSecurity = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
