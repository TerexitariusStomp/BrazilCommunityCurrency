/* Simple static file server for ./public
   - Uses Express (already a dependency)
   - PORT can be set via PUBLIC_PORT env var (default 8080)
*/
const express = require('express');
const path = require('path');

const app = express();
const port = Number(process.env.PUBLIC_PORT || 8080);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(port, '0.0.0.0', () => {
  console.log(`Serving static files from public/ on http://localhost:${port}`);
});

