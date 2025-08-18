Phase 3 Asset Proxy

This small Express server is a prototype to support Phase 3: it simulates searching Sketchfab and proxies downloads so the client doesn't expose API keys.

Commands:

npm install
node index.js

Endpoints:
- GET /search?q=<query>  -> returns matching entries from sample-assets.json
- POST /download { url, filename? } -> downloads the remote file and stores it in server/assets, returns a local path
- GET /assets/<file> -> static serving for downloaded assets

Notes:
- This is only a prototype for local testing. Production integration must implement proper auth, rate limiting, sanitization, and virus scanning.
