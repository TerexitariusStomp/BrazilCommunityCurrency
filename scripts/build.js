/* Minimal build for static frontend
 - Ensures public/env.js exists (copies from env.example.js if missing)
 - Prints where to serve from
*/
const fs = require('fs');
const path = require('path');

function ensureEnvJs() {
  const pub = path.join(__dirname, '..', 'public');
  const envJs = path.join(pub, 'env.js');
  const envEx = path.join(pub, 'env.example.js');
  if (!fs.existsSync(pub)) throw new Error('public/ folder not found');
  if (!fs.existsSync(envJs)) {
    if (fs.existsSync(envEx)) {
      fs.copyFileSync(envEx, envJs);
      console.log('Created public/env.js from env.example.js');
    } else {
      fs.writeFileSync(envJs, 'window.API_BASE = window.API_BASE || "";\n');
      console.log('Created minimal public/env.js');
    }
  }
}

function main() {
  ensureEnvJs();
  console.log('Frontend build complete. Serve static files from public/.');
}

main();

