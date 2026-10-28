'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const files = ['security-v4.91.js', 'app-v4.91.js', 'register-sw-v4.91.js'];
const hashes = files.map(file => 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(path.join(root, file))).digest('base64'));
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/script-src [^;]+;/, "script-src " + hashes.map(hash => "'" + hash + "'").join(' ') + ';');
files.forEach((file, i) => {
  const tag = '<script src="./' + file + '" integrity="' + hashes[i] + '" defer></script>';
  html = html.replace(new RegExp('<script src="\\./' + file.replaceAll('.', '\\.') + '"[^>]*></script>'), tag);
});
fs.writeFileSync(path.join(root, 'index.html'), html);
