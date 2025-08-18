/*
Simple proxy server for Phase 3 asset fetching.
- Provides a /search endpoint that simulates searching Sketchfab (server-side) and returns sample results.
- Provides a /download endpoint that proxies a model URL and saves the file locally under server/assets.

This is a minimal local prototype. In production you'd implement OAuth for Sketchfab, rate limits, caching, validation and sanitization.
*/

import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());

// Simple CORS middleware to allow local dev clients to call this proxy
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const ASSET_DIR = path.join(__dirname, 'assets');
if (!fs.existsSync(ASSET_DIR)) fs.mkdirSync(ASSET_DIR, { recursive: true });

// Simple sample index (would be built from real API results)
const sampleIndexPath = path.join(__dirname, 'sample-assets.json');
let sampleIndex = [];
try {
  const raw = fs.readFileSync(sampleIndexPath, 'utf8');
  sampleIndex = JSON.parse(raw);
} catch (err) {
  console.warn('Could not read sample-assets.json', err);
}

app.get('/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  // If no query provided, return sample index
  if (!q) return res.json({ results: sampleIndex });

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) {
    // no token: local search
    const results = sampleIndex.filter(a => (a.name + ' ' + (a.description || '') + ' ' + (a.tags || []).join(' ')).toLowerCase().includes(q));
    return res.json({ results });
  }

  // Use Sketchfab Data API to search models. We try to find downloadable glTF when possible.
  (async () => {
    try {
      const searchUrl = `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(q)}&downloadable=true`;
      const sresp = await fetch(searchUrl, { headers: { Authorization: `Token ${token}` } });
      if (!sresp.ok) throw new Error('Sketchfab search failed');
      const sjson = await sresp.json();
      const hits = sjson.results || [];

      const results = [];
      for (const h of hits) {
        const uid = h.uid || h.uid || h.id || h._id || h.uid;
        const name = h.name || h.title || 'Untitled';
        const description = h.description || '';
        const thumbnailUrl = h.thumbnails && h.thumbnails.images && h.thumbnails.images[0] && h.thumbnails.images[0].url ? h.thumbnails.images[0].url : (h.thumbnails && h.thumbnails[0] && h.thumbnails[0].url) || '';

        // Try to get download manifest for this model to find a glTF URL
        let fileUrl = `https://sketchfab.com/models/${uid}`;
        try {
          const mresp = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, { headers: { Authorization: `Token ${token}` } });
          if (mresp.ok) {
            const mjson = await mresp.json();
            // mjson.formats likely contains arrays of format objects; prefer gltf or glb
            if (Array.isArray(mjson.formats)) {
              for (const fmt of mjson.formats) {
                if (!fmt || !fmt.format) continue;
                const fmtname = (fmt.format && (fmt.format.type || fmt.format.name)) || '';
                if (fmtname.toLowerCase().includes('gltf') || fmtname.toLowerCase().includes('glb')) {
                  // fmt.files may contain entries with urls
                  if (fmt.files && Array.isArray(fmt.files)) {
                    const candidate = fmt.files.find(f => f.url && (f.url.endsWith('.gltf') || f.url.endsWith('.glb') || f.url.indexOf('.bin') !== -1 || f.url.indexOf('.khr') !== -1));
                    if (candidate && candidate.url) {
                      fileUrl = candidate.url;
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          // ignore per-model download errors
          console.warn('model download info failed', uid, err.message || err);
        }

        results.push({ id: uid, name, description, thumbnailUrl, url: fileUrl, tags: h.tags || [] });
      }

      res.json({ results });
    } catch (err) {
      console.error('Sketchfab search error', err);
      // fallback local search
      const results = sampleIndex.filter(a => (a.name + ' ' + (a.description || '') + ' ' + (a.tags || []).join(' ')).toLowerCase().includes(q));
      res.json({ results });
    }
  })();
});

app.post('/download', async (req, res) => {
  // Expect { url: string, filename?: string }
  const { url, filename } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch');

    // Determine the filename to use
    const origName = filename || path.basename(url.split('?')[0]);
    const lower = origName.toLowerCase();

    // If this is a .gltf (JSON) file, parse and fetch external buffers/images
    if (lower.endsWith('.gltf') || (resp.headers.get('content-type') || '').includes('model/gltf+json') || (resp.headers.get('content-type') || '').includes('application/json')) {
      const text = await resp.text();
      const json = JSON.parse(text);

      // Helper to fetch a resource referenced by the glTF and save it locally; returns local basename
      async function fetchAndSaveResource(resourceUri) {
        if (!resourceUri || resourceUri.startsWith('data:')) return resourceUri; // embedded
        const resolved = new URL(resourceUri, url).href;
        const rresp = await fetch(resolved);
        if (!rresp.ok) throw new Error(`Failed to fetch resource ${resolved}`);
        const rbuf = await rresp.arrayBuffer();
        const rname = path.basename(resolved.split('?')[0]);
        const rtarget = path.join(ASSET_DIR, rname);
        fs.writeFileSync(rtarget, Buffer.from(rbuf));
        return rname;
      }

      // Buffers
      if (Array.isArray(json.buffers)) {
        for (const buf of json.buffers) {
          if (buf && typeof buf.uri === 'string' && !buf.uri.startsWith('data:')) {
            try {
              const newName = await fetchAndSaveResource(buf.uri);
              buf.uri = newName;
            } catch (err) {
              console.warn('Failed to fetch buffer', buf.uri, err);
            }
          }
        }
      }

      // Images
      if (Array.isArray(json.images)) {
        for (const img of json.images) {
          if (img && typeof img.uri === 'string' && !img.uri.startsWith('data:')) {
            try {
              const newName = await fetchAndSaveResource(img.uri);
              img.uri = newName;
            } catch (err) {
              console.warn('Failed to fetch image', img.uri, err);
            }
          }
        }
      }

      // Save modified glTF JSON to assets
      const target = path.join(ASSET_DIR, origName);
      fs.writeFileSync(target, JSON.stringify(json));

      res.json({ ok: true, localPath: `/assets/${origName}` });
      return;
    }

    // For binary (.glb) or other files, just save directly
    const buf = await resp.arrayBuffer();
    const name = origName;
    const target = path.join(ASSET_DIR, name);
    fs.writeFileSync(target, Buffer.from(buf));

    res.json({ ok: true, localPath: `/assets/${name}` });
  } catch (err) {
    console.error('download error', err);
    res.status(500).json({ error: err.message });
  }
});

app.use('/assets', express.static(ASSET_DIR));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Asset proxy server running on port', PORT));
