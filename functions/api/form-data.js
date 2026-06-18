/**
 * Cloudflare Pages Function  ->  route: /api/form-data
 * File location in repo:       functions/api/form-data.js
 *
 * Backs the Template Data Builder in index.html. The GitHub fine-grained token
 * NEVER lives in the browser — it is read here from the Worker Secret GITHUB_TOKEN.
 *
 * Client contract (must match index.html):
 *   GET  /api/form-data?repo=owner/repo&branch=main&path=data/form_data_final.json
 *        -> 200 { ok:true, data:<parsed form_data>, sha }   (existing file)
 *        -> 404 { error:"not found" }                        (no file yet  -> client treats as "no existing")
 *   POST /api/form-data            body: { repo, branch, path, data, message }
 *        -> 200 { ok:true, commit_sha }                      (committed via Git Data API; any file size)
 *
 * Required secret (Pages > Settings > Variables and Secrets, or wrangler):
 *   GITHUB_TOKEN   fine-grained PAT with "Contents: Read and write" on the repo
 * Optional secrets:
 *   UPLOAD_KEY     if set, POST (write) requires header  X-Upload-Key: <UPLOAD_KEY>
 *   ALLOWED_REPOS  comma-separated allow-list (default: paskalisglennardo-source/formcoupa-mdg-cloud)
 */

const DEFAULT_ALLOWED = 'paskalisglennardo-source/formcoupa-mdg-cloud';
const UA = 'wings-mdg-form-data-fn';

/* ---------------- helpers ---------------- */
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept,X-Upload-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}
function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) }
  });
}
function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}
function b64decodeUtf8(b64) {
  const bin = atob((b64 || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
function allowedRepos(env) {
  return String(env.ALLOWED_REPOS || DEFAULT_ALLOWED)
    .split(',').map(s => s.trim()).filter(Boolean);
}
function repoOk(repo, env) {
  if (!repo || repo.indexOf('/') < 0) return false;
  return allowedRepos(env).includes(repo);
}
function encPath(p) { return String(p).split('/').map(encodeURIComponent).join('/'); }

async function gh(env, url, opt) {
  const o = opt || {};
  const headers = Object.assign({
    'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
    'Accept': 'application/vnd.github+json',
    'User-Agent': UA,
    'X-GitHub-Api-Version': '2022-11-28'
  }, o.headers || {});
  const resp = await fetch(url, { method: o.method || 'GET', headers, body: o.body });
  return resp;
}

/* ---------------- CORS preflight ---------------- */
export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '*';
  return new Response(null, { status: 204, headers: cors(origin) });
}

/* ---------------- GET: read existing form_data ---------------- */
export async function onRequestGet(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '*';
  try {
    if (!env.GITHUB_TOKEN) return json({ error: 'Server missing GITHUB_TOKEN secret.' }, 500, origin);
    const u = new URL(request.url);
    const repo = u.searchParams.get('repo');
    const branch = u.searchParams.get('branch') || 'main';
    const path = u.searchParams.get('path');
    if (!repoOk(repo, env)) return json({ error: 'Repository not allowed: ' + repo }, 403, origin);
    if (!path) return json({ error: 'Missing path' }, 400, origin);

    const [owner, name] = repo.split('/');
    const api = 'https://api.github.com/repos/' + owner + '/' + name;

    const metaResp = await gh(env, api + '/contents/' + encPath(path) + '?ref=' + encodeURIComponent(branch));
    if (metaResp.status === 404) return json({ error: 'not found' }, 404, origin);
    if (!metaResp.ok) return json({ error: 'GitHub ' + metaResp.status + ': ' + (await metaResp.text()).slice(0, 300) }, 502, origin);
    const meta = await metaResp.json();

    let text;
    if (meta.content && meta.encoding === 'base64') {
      text = b64decodeUtf8(meta.content);                 // small files inline
    } else if (meta.sha) {
      const blobResp = await gh(env, api + '/git/blobs/' + meta.sha);  // large files (>1MB) via blobs API
      if (!blobResp.ok) return json({ error: 'GitHub blob ' + blobResp.status }, 502, origin);
      const blob = await blobResp.json();
      text = b64decodeUtf8(blob.content);
    } else {
      return json({ error: 'Cannot read file content' }, 502, origin);
    }

    let data;
    try { data = JSON.parse(text); }
    catch (e) { return json({ error: 'Existing file is not valid JSON: ' + (e.message || e) }, 502, origin); }
    return json({ ok: true, data, sha: meta.sha }, 200, origin);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500, origin);
  }
}

/* ---------------- POST: commit form_data via Git Data API ---------------- */
export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '*';
  try {
    if (!env.GITHUB_TOKEN) return json({ error: 'Server missing GITHUB_TOKEN secret.' }, 500, origin);

    // optional write protection
    if (env.UPLOAD_KEY) {
      const k = request.headers.get('X-Upload-Key') || '';
      if (k !== env.UPLOAD_KEY) return json({ error: 'Unauthorized: bad or missing X-Upload-Key.' }, 401, origin);
    }

    let body;
    try { body = await request.json(); }
    catch (e) { return json({ error: 'Invalid JSON body' }, 400, origin); }

    const u = new URL(request.url);
    const repo = body.repo || u.searchParams.get('repo');
    const branch = body.branch || u.searchParams.get('branch') || 'main';
    const path = body.path || u.searchParams.get('path');
    const message = body.message || ('Update ' + path + ' via Template Data Builder');
    const data = body.data;

    if (!repoOk(repo, env)) return json({ error: 'Repository not allowed: ' + repo }, 403, origin);
    if (!path) return json({ error: 'Missing path' }, 400, origin);
    if (data == null || typeof data !== 'object') return json({ error: 'Missing/invalid "data" object' }, 400, origin);

    const content = JSON.stringify(data);
    const [owner, name] = repo.split('/');
    const api = 'https://api.github.com/repos/' + owner + '/' + name;

    async function ghJson(url, opt) {
      const r = await gh(env, url, opt);
      const t = await r.text();
      if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + t.slice(0, 300));
      return t ? JSON.parse(t) : {};
    }

    // 1) latest commit on branch
    const ref = await ghJson(api + '/git/ref/heads/' + encodeURIComponent(branch));
    const latestCommit = ref.object.sha;
    // 2) base tree
    const commit = await ghJson(api + '/git/commits/' + latestCommit);
    const baseTree = commit.tree.sha;
    // 3) blob (base64) — no 1MB limit, unlike the Contents API
    const blob = await ghJson(api + '/git/blobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: b64encodeUtf8(content), encoding: 'base64' })
    });
    // 4) tree
    const tree = await ghJson(api + '/git/trees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseTree, tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }] })
    });
    // 5) commit
    const newCommit = await ghJson(api + '/git/commits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tree: tree.sha, parents: [latestCommit] })
    });
    // 6) move branch ref
    await ghJson(api + '/git/refs/heads/' + encodeURIComponent(branch), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommit.sha, force: false })
    });

    return json({ ok: true, commit_sha: newCommit.sha, path, branch, bytes: content.length }, 200, origin);
  } catch (e) {
    const msg = String(e && e.message || e);
    const status = /GitHub 401|Bad credentials/i.test(msg) ? 401 : 502;
    return json({ error: msg }, status, origin);
  }
}
