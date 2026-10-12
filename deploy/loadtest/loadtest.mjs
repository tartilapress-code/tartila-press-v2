// Uji beban Tartila Press + Tartila Book (API Laravel yang sama).
// Sesi pengguna datang menurut proses Poisson (open-loop), tiap sesi menjalankan langkah-langkah
// seperti browser sungguhan (grup request paralel + waktu berpikir). Mengukur latensi per jenis
// request, error, throughput, dan CPU/memori proses server (Apache/PHP + MariaDB).
//
// Contoh:  node loadtest.mjs --base http://127.0.0.1:8090 --duration 60 --press 0.4 --book 5 --think 0.1
//   --press / --book : sesi baru per detik     --think : pengali waktu berpikir (1 = nyata)
import http from 'node:http';
import { execFileSync } from 'node:child_process';

const arg = (name, def) => {
    const i = process.argv.indexOf('--' + name);
    return i > -1 ? process.argv[i + 1] : def;
};
const BASE = new URL(arg('base', 'http://127.0.0.1:8090'));
const DURATION = Number(arg('duration', 60));
const WARMUP = Number(arg('warmup', 5));
const PRESS_RATE = Number(arg('press', 0));
const BOOK_RATE = Number(arg('book', 0));
const ADMIN_RATE = Number(arg('admin', 0));
const THINK = Number(arg('think', 1));
const CONNS = Number(arg('conns', 40));
const PAGES_MEAN = Number(arg('pages', 12));
const LOGIN_SHARE = Number(arg('login', 0.15));
const RANGE_KB = Number(arg('range', 256));
const LABEL = arg('label', 'uji');
const SERVER_PROCS = arg('procs', 'httpd,mysqld');

const agent = new http.Agent({ keepAlive: true, maxSockets: CONNS, maxFreeSockets: CONNS });
const stats = new Map(); // label -> {lat:[], n, err, bytes, status:{}}
let measuring = false;
let activeSessions = 0;
let peakSessions = 0;
let sessionsDone = 0;
let sessionsStarted = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const think = (sec) => sleep(sec * 1000 * THINK * (0.6 + Math.random() * 0.8));
const rnd = (n) => Math.floor(Math.random() * n);
const zipfBook = () => 1 + Math.floor(3000 * Math.pow(Math.random(), 3));
const poisson = (rate) => -Math.log(1 - Math.random()) / rate;

async function req(label, method, path, { token, body, headers = {}, expectBody = true } = {}) {
    const h = { accept: 'application/json', ...headers };
    if (token) h.authorization = `Bearer ${token}`;
    let payload;
    if (body !== undefined) {
        payload = JSON.stringify(body);
        h['content-type'] = 'application/json';
    }
    const t0 = performance.now();
    let status = 0;
    let bytes = 0;
    let data = null;
    try {
        await new Promise((resolve, reject) => {
            const r = http.request({ host: BASE.hostname, port: BASE.port, path: '/api/v1' + path, method, headers: payload ? { ...h, 'content-length': Buffer.byteLength(payload) } : h, agent }, (res) => {
                status = res.statusCode;
                const chunks = [];
                res.on('data', (c) => {
                    bytes += c.length;
                    if (expectBody && bytes < 200000) chunks.push(c);
                });
                res.on('end', () => {
                    if (expectBody && status < 300 && chunks.length) {
                        try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { /* bukan JSON */ }
                    }
                    resolve();
                });
                res.on('error', reject);
            });
            r.setTimeout(60000, () => r.destroy(new Error('timeout')));
            r.on('error', reject);
            if (payload) r.write(payload);
            r.end();
        });
    } catch (e) {
        status = -1;
    }
    const ms = performance.now() - t0;
    if (measuring) {
        let s = stats.get(label);
        if (!s) stats.set(label, (s = { lat: [], n: 0, err: 0, bytes: 0, status: {} }));
        s.lat.push(ms);
        s.n++;
        s.bytes += bytes;
        s.status[status] = (s.status[status] || 0) + 1;
        if (status < 0 || status >= 500 || status === 429) s.err++;
    }
    return { status, data, ms };
}

const all = (...p) => Promise.all(p);

// ------------------------------------------------------------------ Tartila Press
async function pressSession() {
    const anon = Math.random() > LOGIN_SHARE * 2;
    // Beranda: 9 request API paralel
    await all(
        req('press GET /about', 'GET', '/about'),
        req('press GET /books/hero-covers', 'GET', '/books/hero-covers'),
        req('press GET /packages', 'GET', '/packages'),
        req('press GET /custom-package-items', 'GET', '/custom-package-items'),
        req('press GET /books (beranda)', 'GET', '/books?per_page=4'),
        req('press GET /public/authors', 'GET', '/public/authors?per_page=4'),
        req('press GET /editors', 'GET', '/editors?per_page=4'),
        req('press GET /articles', 'GET', '/articles?per_page=3'),
        req('press GET /events', 'GET', '/events?per_page=4')
    );
    await think(6);
    // Katalog
    await all(
        req('press GET /books (katalog)', 'GET', `/books?page=${1 + rnd(30)}&per_page=12`),
        req('press GET /book-categories', 'GET', '/book-categories'),
        req('press GET /field-categories', 'GET', '/field-categories'),
        req('press GET /about', 'GET', '/about')
    );
    await think(7);
    if (Math.random() < 0.5) {
        await req('press GET /books?search', 'GET', `/books?search=${encodeURIComponent('uji performa ' + rnd(500))}`);
        await think(4);
    }
    // Detail buku
    await all(req('press GET /books/{slug}', 'GET', `/books/buku-uji-performa-${1 + rnd(5000)}`), req('press GET /about', 'GET', '/about'));
    await think(10);
    if (anon) return;

    // Pengguna masuk: login lalu dashboard
    const uid = 1 + rnd(100000);
    const login = await req('press POST /auth/login', 'POST', '/auth/login', { body: { email: `u${uid}@perf.test`, password: 'Perf@2026' } });
    const token = login.data?.data?.token || login.data?.token || `${uid}|perf${uid}`;
    await all(
        req('press GET /auth/me', 'GET', '/auth/me', { token }),
        req('press GET /dashboard/summary', 'GET', '/dashboard/summary', { token }),
        req('press GET /notifications/summary', 'GET', '/notifications/summary', { token })
    );
    await think(8);
    await all(
        req('press GET /orders/mine', 'GET', '/orders/mine', { token }),
        req('press GET /manuscripts/mine', 'GET', '/manuscripts/mine', { token }),
        req('press GET /wallet', 'GET', '/wallet', { token }),
        req('press GET /royalties/mine', 'GET', '/royalties/mine', { token })
    );
}

// ------------------------------------------------------------------ Tartila Book
async function bookSession() {
    const uid = 100001 + rnd(400000);
    let token = `${uid}|perf${uid}`;
    if (Math.random() < LOGIN_SHARE) {
        const login = await req('book POST /auth/login', 'POST', '/auth/login', { body: { email: `u${uid}@perf.test`, password: 'Perf@2026' } });
        token = login.data?.data?.token || login.data?.token || token;
    }
    // Katalog + rak
    await all(
        req('book GET /reader/filters', 'GET', '/reader/filters'),
        req('book GET /reader/books (katalog)', 'GET', `/reader/books?page=${1 + rnd(5)}&per_page=24${Math.random() < 0.4 ? '&sort=popular' : ''}`, { token }),
        req('book GET /reader/plans', 'GET', '/reader/plans'),
        req('book GET /reader/me/shelf', 'GET', '/reader/me/shelf?tab=reading', { token })
    );
    await think(5);
    const id = zipfBook();
    await all(req('book GET /reader/books/{id}', 'GET', `/reader/books/${id}`, { token }), req('book GET /reader/books/{id}/comments', 'GET', `/reader/books/${id}/comments`, { token }));
    await think(4);

    // Buka pembaca: PDF.js memuat bertahap lewat Range
    const SIZE = 5533543;
    const range = (a, b) => ({ headers: { range: `bytes=${a}-${b}` }, token, expectBody: false });
    await all(
        req('book GET /file (range awal)', 'GET', `/reader/books/${id}/file`, range(0, RANGE_KB * 1024 - 1)),
        req('book GET /file (range akhir)', 'GET', `/reader/books/${id}/file`, range(SIZE - 65536, SIZE - 1)),
        req('book GET /bookmarks', 'GET', `/reader/books/${id}/bookmarks`, { token })
    );

    let page = 1 + rnd(50);
    const total = Math.max(1, Math.round(-Math.log(1 - Math.random()) * PAGES_MEAN));
    for (let i = 0; i < total; i++) {
        await think(20); // membaca satu halaman
        const calls = [
            req('book POST /reads', 'POST', `/reader/books/${id}/reads`, { token, body: { pages: [page] } }),
            req('book PUT /progress', 'PUT', `/reader/books/${id}/progress`, { token, body: { page } }),
        ];
        if (i % 4 === 0) {
            const a = 262144 + rnd(4000000);
            calls.push(req('book GET /file (range lanjut)', 'GET', `/reader/books/${id}/file`, range(a, a + RANGE_KB * 1024 - 1)));
        }
        await all(...calls);
        page = Math.min(300, page + 1);
    }
    const r = Math.random();
    if (r < 0.1) await req('book POST /like', 'POST', `/reader/books/${id}/like`, { token });
    else if (r < 0.18) await req('book POST /save', 'POST', `/reader/books/${id}/save`, { token });
    else if (r < 0.23) await req('book POST /bookmarks', 'POST', `/reader/books/${id}/bookmarks`, { token, body: { page, note: 'uji' } });
    else if (r < 0.26) await req('book POST /comments', 'POST', `/reader/books/${id}/comments`, { token, body: { body: 'Bagus sekali.' } });
}

// ------------------------------------------------------------------ Admin (pemantauan harian)
async function adminSession() {
    const token = '1|perf1';
    await all(
        req('admin GET /admin/orders', 'GET', '/admin/orders?per_page=20', { token }),
        req('admin GET /admin/reader/orders', 'GET', '/admin/reader/orders?per_page=20', { token })
    );
    await think(8);
    await all(
        req('admin GET /admin/royalties', 'GET', '/admin/royalties', { token }),
        req('admin GET /admin/books', 'GET', `/admin/books?per_page=20&page=${1 + rnd(20)}`, { token }),
        req('admin GET /admin/reader/books', 'GET', '/admin/reader/books?per_page=20', { token })
    );
    await think(8);
    const day = new Date().toISOString().slice(0, 10);
    await req('admin GET /admin/reader/royalties', 'GET', `/admin/reader/royalties?from=${day}&to=${day}`, { token });
}

// ------------------------------------------------------------------ pengukuran server
function procSnapshot() {
    try {
        const out = execFileSync(
            'powershell',
            ['-NoProfile', '-Command', `Get-Process -Name ${SERVER_PROCS} -ErrorAction SilentlyContinue | Group-Object Name | ForEach-Object { [pscustomobject]@{ n = $_.Name; cpu = ($_.Group | Measure-Object -Property TotalProcessorTime -Sum -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Count); ms = [math]::Round((($_.Group | ForEach-Object { $_.TotalProcessorTime.TotalMilliseconds }) | Measure-Object -Sum).Sum); mem = [math]::Round((($_.Group | ForEach-Object { $_.WorkingSet64 }) | Measure-Object -Sum).Sum / 1MB) } } | ConvertTo-Json -Compress`],
            { encoding: 'utf8' }
        );
        const j = JSON.parse(out);
        return Object.fromEntries((Array.isArray(j) ? j : [j]).map((x) => [x.n, { ms: x.ms, mem: x.mem }]));
    } catch {
        return {};
    }
}

const pct = (arr, p) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function spawnSessions(kind, rate, fn, until) {
    if (rate <= 0) return;
    while (performance.now() < until) {
        await sleep(poisson(rate) * 1000);
        if (performance.now() >= until) break;
        sessionsStarted++;
        activeSessions++;
        peakSessions = Math.max(peakSessions, activeSessions);
        fn()
            .catch(() => {})
            .finally(() => {
                activeSessions--;
                sessionsDone++;
            });
    }
}

async function main() {
    const t0 = performance.now();
    const end = t0 + (WARMUP + DURATION) * 1000;
    const p = [spawnSessions('press', PRESS_RATE, pressSession, end), spawnSessions('book', BOOK_RATE, bookSession, end), spawnSessions('admin', ADMIN_RATE, adminSession, end)];

    await sleep(WARMUP * 1000);
    measuring = true;
    const before = procSnapshot();
    const tStart = performance.now();
    await sleep(DURATION * 1000);
    const after = procSnapshot();
    const elapsed = (performance.now() - tStart) / 1000;
    measuring = false;
    await Promise.all(p);
    // sesi yang masih berjalan dibiarkan selesai sebentar saja
    await sleep(500);

    let total = 0;
    let errors = 0;
    let bytes = 0;
    const rows = [...stats.entries()].sort((a, b) => b[1].n - a[1].n);
    for (const [, s] of rows) { total += s.n; errors += s.err; bytes += s.bytes; }

    const cpu = {};
    let cpuTotal = 0;
    for (const k of Object.keys(after)) {
        const d = (after[k].ms - (before[k]?.ms || 0)) / 1000;
        cpu[k] = { cpuSec: +d.toFixed(2), cores: +(d / elapsed).toFixed(2), memMB: after[k].mem };
        cpuTotal += d;
    }

    console.log(`\n=== ${LABEL} | base=${BASE.origin} | press=${PRESS_RATE}/s book=${BOOK_RATE}/s admin=${ADMIN_RATE}/s think=x${THINK} | ${DURATION}s ===`);
    console.log(`request: ${total} (${(total / elapsed).toFixed(1)}/dtk)  error/429/5xx: ${errors} (${total ? ((errors / total) * 100).toFixed(2) : 0}%)  data: ${(bytes / 1e6).toFixed(1)} MB (${((bytes * 8) / 1e6 / elapsed).toFixed(1)} Mbps)`);
    console.log(`sesi dimulai: ${sessionsStarted}  selesai: ${sessionsDone}  puncak sesi bersamaan: ${peakSessions}`);
    console.log(`CPU server: ${Object.entries(cpu).map(([k, v]) => `${k} ${v.cores} core (mem ${v.memMB} MB)`).join(' | ')}  | total ${(cpuTotal / elapsed).toFixed(2)} core | ${total ? ((cpuTotal / total) * 1000).toFixed(1) : 0} ms-CPU/request`);
    console.log('label'.padEnd(40), 'n'.padStart(7), 'p50'.padStart(7), 'p95'.padStart(7), 'p99'.padStart(7), 'max'.padStart(7), 'err'.padStart(5), ' status');
    for (const [label, s] of rows) {
        console.log(label.padEnd(40), String(s.n).padStart(7), pct(s.lat, 50).toFixed(0).padStart(7), pct(s.lat, 95).toFixed(0).padStart(7), pct(s.lat, 99).toFixed(0).padStart(7), Math.max(...s.lat).toFixed(0).padStart(7), String(s.err).padStart(5), ' ' + JSON.stringify(s.status));
    }
    console.log('JSON ' + JSON.stringify({ label: LABEL, press: PRESS_RATE, book: BOOK_RATE, think: THINK, rps: +(total / elapsed).toFixed(1), errPct: total ? +((errors / total) * 100).toFixed(2) : 0, cores: +(cpuTotal / elapsed).toFixed(2), msCpuPerReq: total ? +((cpuTotal / total) * 1000).toFixed(1) : 0, peakSessions, mbps: +(((bytes * 8) / 1e6) / elapsed).toFixed(1), cpu }));
    agent.destroy();
    process.exit(0);
}

main();
