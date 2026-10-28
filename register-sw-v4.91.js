'use strict';
window.addEventListener('load',function(){if('serviceWorker' in navigator){navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(function(reg){return reg.update()}).catch(function(){var el=document.getElementById('saveError');if(el)el.textContent+=' オフライン機能の更新を確認できませんでした。';});}});
