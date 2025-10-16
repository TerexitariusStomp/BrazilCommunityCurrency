const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

function extractBabelScripts(html) {
  const re = /<script[^>]*type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

function stripBabelScripts(html) {
  return html.replace(/<script[^>]*type=["']text\/babel["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');
}

function swapReactForProd(html) {
  return html
    .replace(/react\.development\.js/g, 'react.production.min.js')
    .replace(/react-dom\.development\.js/g, 'react-dom.production.min.js')
    .replace(/\n\s*<script[^>]*src=\"[^\"]*@babel\/standalone[^>]*><\/script>\s*/gi, '\n');
}

async function build() {
  const pubDir = path.join(process.cwd(), 'public');
  const htmlPath = path.join(pubDir, 'index.html');
  const assetsDir = path.join(pubDir, 'assets');
  const outFile = path.join(assetsDir, 'app.js');

  const html = fs.readFileSync(htmlPath, 'utf8');
  const jsxBlocks = extractBabelScripts(html);
  if (!jsxBlocks.length) {
    console.log('No text/babel scripts found; nothing to build.');
    return;
  }
  let code = jsxBlocks.join('\n;\n');
  // Deduplicate repeated React hook destructuring across inline blocks
  let seenHookDecl = false;
  code = code.replace(/const\s*\{\s*useState\s*,\s*useEffect\s*\}\s*=\s*React\s*;\s*/g, (m) => {
    if (seenHookDecl) return '';
    seenHookDecl = true;
    return m;
  });
  fs.mkdirSync(assetsDir, { recursive: true });

  await esbuild.build({
    stdin: {
      contents: code,
      resolveDir: pubDir,
      loader: 'jsx',
      sourcefile: 'inline.jsx'
    },
    minify: true,
    bundle: false,
    format: 'iife',
    target: ['es2018'],
    outfile: outFile,
    define: { 'process.env.NODE_ENV': '"production"' },
    banner: { js: 'var React=window.React,ReactDOM=window.ReactDOM;\n' }
  });

  let newHtml = stripBabelScripts(html);
  newHtml = swapReactForProd(newHtml);

  if (!/assets\/app\.js/.test(newHtml)) {
    newHtml = newHtml.replace(/<\/body>/i, '  <script src="assets/app.js" defer></script>\n</body>');
  }

  fs.writeFileSync(htmlPath, newHtml, 'utf8');
  console.log('Built public/assets/app.js and updated public/index.html');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
