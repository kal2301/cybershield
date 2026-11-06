/* CyberShield - frontend logic */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toLocaleString('en-US');

/* ---------- API helper ---------- */
async function api(action, body = null, query = '') {
  const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
  let res, data;
  try {
    res = await fetch(`api.php?action=${action}${query}`, opt);
    data = await res.json();
  } catch (e) {
    toast('Tidak bisa terhubung ke api.php. Pastikan Apache & MySQL jalan dan buka lewat http://localhost/...', true);
    throw e;
  }
  if (!data.ok) { toast(data.error || 'Terjadi kesalahan', true); throw new Error(data.error); }
  return data;
}

let toastTimer;
function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- Navigasi ---------- */
const titles = {
  dashboard: ['Dashboard', 'Pemantauan lalu lintas jaringan secara real-time (data simulasi)'],
  firewall:  ['Manajemen Aturan Firewall', 'Tambah, aktifkan, nonaktifkan, dan hapus aturan firewall'],
  simulasi:  ['Simulasi Traffic & Serangan', 'Jalankan lalu lintas normal atau serangan dan lihat status koneksinya'],
  logs:      ['Log Keamanan', 'Catatan seluruh kejadian jaringan dan tindakan sistem'],
  blacklist: ['Blacklist IP', 'Kelola daftar alamat IP yang diblokir permanen'],
};
function go(page) {
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  $('#pageTitle').textContent = titles[page][0];
  $('#pageDesc').textContent  = titles[page][1];
  if (page === 'dashboard') loadStats();
  if (page === 'firewall')  loadRules();
  if (page === 'logs')      loadLogs();
  if (page === 'blacklist') loadBlacklist();
}
$$('.nav-btn').forEach(b => b.onclick = () => go(b.dataset.page));
$$('[data-goto]').forEach(b => b.onclick = () => go(b.dataset.goto));

/* ---------- Jam ---------- */
setInterval(() => $('#clock').textContent = new Date().toLocaleTimeString('id-ID'), 1000);

/* ---------- Grafik real-time (canvas) ---------- */
const MAXPTS = 30;
const series = { allowed: [], blocked: [] };
for (let i = 0; i < MAXPTS; i++) {           // data awal supaya grafik tidak kosong
  series.allowed.push(22 + Math.round(Math.random() * 18));
  series.blocked.push(1 + Math.round(Math.random() * 6));
}
function pushPoint(a, b) {
  series.allowed.push(a); series.blocked.push(b);
  if (series.allowed.length > MAXPTS) { series.allowed.shift(); series.blocked.shift(); }
  drawChart();
}
function drawChart() {
  const c = $('#chart'); if (!c || !c.offsetWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const W = c.offsetWidth, H = 260;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const pad = { l: 38, r: 10, t: 10, b: 22 };
  const max = Math.max(10, ...series.allowed, ...series.blocked) * 1.15;
  const x = i => pad.l + i * (W - pad.l - pad.r) / (MAXPTS - 1);
  const y = v => H - pad.b - v / max * (H - pad.t - pad.b);

  g.strokeStyle = '#1b2440'; g.fillStyle = '#6b7599'; g.font = '11px Segoe UI'; g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, yy = y(v);
    g.beginPath(); g.moveTo(pad.l, yy); g.lineTo(W - pad.r, yy); g.stroke();
    g.fillText(Math.round(v), 6, yy + 4);
  }
  const line = (data, color, fillTop) => {
    g.beginPath();
    data.forEach((v, i) => i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v)));
    g.strokeStyle = color; g.lineWidth = 2.2; g.lineJoin = 'round'; g.stroke();
    g.lineTo(x(data.length - 1), H - pad.b); g.lineTo(x(0), H - pad.b); g.closePath();
    const gr = g.createLinearGradient(0, pad.t, 0, H - pad.b);
    gr.addColorStop(0, fillTop); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fill();
  };
  line(series.allowed, '#22c55e', 'rgba(34,197,94,.28)');
  line(series.blocked, '#f43f5e', 'rgba(244,63,94,.30)');
}
window.addEventListener('resize', drawChart);

/* ---------- Dashboard ---------- */
const badge = a => `<span class="badge ${a}">${a === 'allowed' ? 'DIIZINKAN' : 'DIBLOKIR'}</span>`;

async function loadStats() {
  const d = await api('stats');
  $('#sTotal').textContent   = fmt(d.total);
  $('#sAllowed').textContent = fmt(d.allowed);
  $('#sBlocked').textContent = fmt(d.blocked);
  $('#sRules').textContent   = fmt(d.active_rules);
  const pct = n => d.total ? (n / d.total * 100).toFixed(1) + '% dari total paket' : '-';
  $('#sAllowedPct').textContent = pct(d.allowed);
  $('#sBlockedPct').textContent = pct(d.blocked);

  const max = Math.max(1, ...d.top_ports.map(p => +p.total));
  $('#topPorts').innerHTML = d.top_ports.length
    ? d.top_ports.map(p => `
        <div class="bar-row">
          <div class="bar-top"><b>Port ${esc(p.port)}</b><span>${fmt(p.total)} diblokir</span></div>
          <div class="bar"><i style="width:${p.total / max * 100}%"></i></div>
        </div>`).join('')
    : '<p class="hint">Belum ada data pemblokiran.</p>';

  $('#alertsBody').innerHTML = d.alerts.length
    ? d.alerts.map(a => `<tr>
        <td class="mono">${esc(a.event_time)}</td><td class="mono">${esc(a.source_ip)}</td>
        <td>${esc(a.dest_port)}</td><td>${esc(a.activity_type)}</td><td>${badge('blocked')}</td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">Tidak ada peringatan.</td></tr>';
}

/* ---------- Firewall ---------- */
async function loadRules() {
  const d = await api('rules_list');
  $('#rulesBody').innerHTML = d.rules.length ? d.rules.map(r => `<tr>
      <td>${r.id}</td><td>${esc(r.rule_name)}</td><td class="mono">${esc(r.ip_address)}</td>
      <td class="mono">${esc(r.port)}</td>
      <td><span class="badge ${r.action}">${r.action === 'allow' ? 'IZINKAN' : 'BLOKIR'}</span></td>
      <td><span class="badge ${+r.is_active ? 'allowed' : 'off'}">${+r.is_active ? 'AKTIF' : 'NONAKTIF'}</span></td>
      <td class="btn-row">
        <button class="btn ghost sm" onclick="toggleRule(${r.id})">${+r.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        <button class="btn danger sm" onclick="delRule(${r.id})">Hapus</button>
      </td></tr>`).join('')
    : '<tr><td colspan="7" class="empty">Belum ada aturan.</td></tr>';
}
$('#ruleForm').onsubmit = async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const d = await api('rule_add', f);
  toast(d.message); e.target.reset(); e.target.ip_address.value = '*'; e.target.port.value = '*';
  loadRules();
};
async function toggleRule(id) { const d = await api('rule_toggle', { id }); toast(d.message); loadRules(); }
async function delRule(id) {
  if (!confirm('Hapus aturan ini?')) return;
  const d = await api('rule_delete', { id }); toast(d.message); loadRules();
}

/* ---------- Simulasi ---------- */
function renderFeed(packets) {
  const body = $('#feedBody');
  if (body.querySelector('.empty')) body.innerHTML = '';
  const rows = packets.slice().reverse().map(p => `<tr>
      <td class="mono">${esc(p.time)}</td><td class="mono">${esc(p.ip)}</td><td>${esc(p.port)}</td>
      <td>${esc(p.activity)}</td><td>${badge(p.action)}</td><td>${esc(p.note)}</td></tr>`).join('');
  body.insertAdjacentHTML('afterbegin', rows);
  while (body.rows.length > 50) body.deleteRow(-1);
}
async function runSim(mode, count) {
  const d = await api('simulate', { mode, count });
  renderFeed(d.packets);
  $('#simTotal').textContent = d.packets.length;
  $('#simAllowed').textContent = d.allowed;
  $('#simBlocked').textContent = d.blocked;
  pushPoint(d.allowed, d.blocked);
  loadStats();
  return d;
}
$('#btnNormal').onclick = async () => { await runSim('normal', 12); };
$('#btnAttack').onclick = async e => {
  e.target.disabled = true;
  try { const d = await runSim('attack', 25); toast(`Simulasi serangan selesai: ${d.blocked} paket diblokir, ${d.allowed} diizinkan.`); }
  finally { e.target.disabled = false; }
};

let autoTimer = null;
$('#btnAuto').onclick = e => {
  if (autoTimer) {
    clearInterval(autoTimer); autoTimer = null;
    e.target.textContent = '↻ Auto Traffic: OFF'; e.target.classList.remove('on');
    $('#autoState').textContent = 'OFF';
  } else {
    autoTimer = setInterval(() => runSim('normal', 6 + Math.floor(Math.random() * 8)).catch(() => $('#btnAuto').click()), 3000);
    e.target.textContent = '↻ Auto Traffic: ON'; e.target.classList.add('on');
    $('#autoState').textContent = 'ON';
  }
};

$('#testForm').onsubmit = async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const d = await api('test_connection', { ip: f.ip, port: +f.port });
  const box = $('#testResult');
  box.className = 'test-result ' + d.result;
  box.innerHTML = `<b>${d.result === 'allowed' ? '✔ KONEKSI DIIZINKAN' : '✖ KONEKSI DIBLOKIR'}</b><br>
    ${esc(d.ip)} → port ${esc(d.port)}<br>${esc(d.note)}<br><small>Tercatat di Log Keamanan.</small>`;
  loadStats();
};

/* ---------- Log ---------- */
async function loadLogs() {
  const d = await api('logs_list', null, '&filter=' + $('#logFilter').value);
  $('#logsBody').innerHTML = d.logs.length ? d.logs.map(l => `<tr>
      <td class="mono">${esc(l.event_time)}</td><td class="mono">${esc(l.source_ip)}</td><td>${esc(l.dest_port)}</td>
      <td>${esc(l.activity_type)}</td><td>${badge(l.action_taken)}</td><td>${esc(l.note)}</td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">Log kosong.</td></tr>';
}
$('#logFilter').onchange = loadLogs;
$('#btnRefreshLog').onclick = loadLogs;
$('#btnClearLog').onclick = async () => {
  if (!confirm('Hapus SEMUA log keamanan?')) return;
  const d = await api('logs_clear', {}); toast(d.message); loadLogs(); loadStats();
};

/* ---------- Blacklist ---------- */
async function loadBlacklist() {
  const d = await api('blacklist_list');
  $('#blBody').innerHTML = d.items.length ? d.items.map(i => `<tr>
      <td>${i.id}</td><td class="mono">${esc(i.ip_address)}</td><td>${esc(i.reason)}</td>
      <td class="mono">${esc(i.created_at)}</td>
      <td><button class="btn danger sm" onclick="delBl(${i.id})">Hapus</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">Blacklist kosong.</td></tr>';
}
$('#blForm').onsubmit = async e => {
  e.preventDefault();
  const d = await api('blacklist_add', Object.fromEntries(new FormData(e.target)));
  toast(d.message); e.target.reset(); loadBlacklist();
};
async function delBl(id) {
  if (!confirm('Hapus IP ini dari blacklist?')) return;
  const d = await api('blacklist_delete', { id }); toast(d.message); loadBlacklist();
}
11.59 06/11/2026
/* ---------- Init ---------- */
drawChart();
loadStats();
setInterval(() => { if ($('#page-dashboard').classList.contains('active')) loadStats(); }, 5000);
$('#btnAuto').click();   // Auto Traffic langsung aktif