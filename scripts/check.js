// Buildless static deployment checks: parse scripts and resolve local assets.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)) {
  new vm.Script(match[1], {filename:'index.html inline script'});
}
const assets = [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/g)].map(m => m[1]);
for (const asset of assets) {
  const contents = fs.readFileSync(path.join(root, asset), 'utf8');
  if (asset.endsWith('.js')) new vm.Script(contents, {filename:asset});
}
console.log(`Inline scripts and ${assets.length} local static assets verified.`);
