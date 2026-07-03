// Post-processes the Expo web export (dist/) into an installable PWA:
// copies web-assets/ in and injects manifest + iOS meta tags + SW registration.
// Run via: npm run build:web

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const assets = path.join(root, 'web-assets');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html not found — run `npx expo export --platform web` first');
  process.exit(1);
}

for (const file of fs.readdirSync(assets)) {
  fs.copyFileSync(path.join(assets, file), path.join(dist, file));
}

const inject = `
<title>SURV</title>
<link rel="manifest" href="./manifest.json"/>
<meta name="theme-color" content="#1d4166"/>
<link rel="apple-touch-icon" href="./icon-180.png"/>
<link rel="icon" type="image/png" href="./icon-180.png"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="SURV"/>
<script>if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){})})}</script>
`;

const htmlPath = path.join(dist, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/<title>.*?<\/title>/s, ''); // ours is injected below
html = html.replace('</head>', `${inject}</head>`);
fs.writeFileSync(htmlPath, html);
console.log('dist/ is now an installable PWA (manifest, icons, service worker).');
