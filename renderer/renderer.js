const APP_VERSION = '1.0.0';

// ── Estado global de sesión ──────────────────────────────────────────────────
let lastSfcResult = null;
let lastDismResult = null;
let lastDiagnosticoResult = null;
let lastGpuDriversResult = null;
let lastEventReport = null;
let eventTableSort = { key: 'time', dir: 'desc' };

// ── Referencias DOM ──────────────────────────────────────────────────────────
const resultTitle = document.getElementById('result-title');
const resultsEl = document.getElementById('results');
const progressBar = document.getElementById('progress-bar');
const statusText = document.getElementById('status-text');
const statusBar = document.getElementById('statusbar');

const ALL_BTN_IDS = [
  'btn-speedtest', 'btn-diagnostico', 'btn-highperf',
  'btn-gpudrivers', 'btn-eventlog', 'btn-healthcheck',
  'btn-sfc', 'btn-dism', 'btn-cleantemp',
];
const allButtons = () => ALL_BTN_IDS.map(id => document.getElementById(id)).filter(Boolean);

const ICONS = { ok: '🟢', warn: '🟡', error: '🔴' };

// ── Pestañas del menú lateral ────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── Panel de Log ─────────────────────────────────────────────────────────────
const logPanel = document.getElementById('log-panel');
const logBody = document.getElementById('log-body');

document.getElementById('btn-log-toggle').addEventListener('click', () => {
  logPanel.classList.toggle('visible');
});
document.getElementById('btn-log-close').addEventListener('click', () => {
  logPanel.classList.remove('visible');
});
document.getElementById('btn-clear-log-view').addEventListener('click', () => {
  logBody.innerHTML = '';
});
document.getElementById('btn-open-log-folder').addEventListener('click', () => {
  window.api.openLogFolder();
});

window.api.getLogPath().then(p => {
  if (p) document.getElementById('log-file-path').textContent = p;
});

window.api.onAppLog((entry) => {
  const line = document.createElement('p');
  line.className = `log-line ${entry.level || 'INFO'}`;
  line.textContent = `[${entry.ts}] [${entry.level}] ${entry.message}`;
  logBody.appendChild(line);
  logBody.scrollTop = logBody.scrollHeight;
});

// ── Helpers de UI ────────────────────────────────────────────────────────────
function setBusy(busy, text = '') {
  progressBar.classList.toggle('active', busy);
  statusText.textContent = text;
  allButtons().forEach(b => b.disabled = busy);
}

function clearResults(title) {
  resultTitle.textContent = title;
  resultsEl.innerHTML = '';
  statusText.textContent = '';
}

function addSectionTitle(text) {
  const el = document.createElement('div');
  el.className = 'section-title';
  el.textContent = text;
  resultsEl.appendChild(el);
}

function addResultLine(label, value, status) {
  const row = document.createElement('div');
  row.className = 'result-row';
  if (status) {
    const icon = document.createElement('span');
    icon.className = 'result-icon';
    icon.textContent = ICONS[status] || '';
    row.appendChild(icon);
  }
  const l = document.createElement('span');
  l.className = 'result-label';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'result-value';
  v.textContent = value || '';
  row.appendChild(l);
  row.appendChild(v);
  resultsEl.appendChild(row);
  return row;
}

function addUsageBar(label, pct, detail, status) {
  const clampedPct = Math.max(0, Math.min(100, pct || 0));

  // El color de la barra refleja el porcentaje real de uso visualmente,
  // independientemente del umbral de "status" de la utilidad.
  // Así el técnico ve la barra en verde cuando está al 30%, amarilla al 65%,
  // naranja al 80% y roja al 95%, aunque el status siga siendo 'ok' hasta el 70%.
  let barColor;
  if (clampedPct >= 90) barColor = 'var(--error)';       // rojo
  else if (clampedPct >= 75) barColor = '#EA580C';             // naranja
  else if (clampedPct >= 55) barColor = 'var(--warn)';         // amarillo
  else barColor = 'var(--ok)';           // verde

  // El color del texto del porcentaje sigue el status de umbral (ok/warn/error)
  const textClass = status || 'ok';

  const row = document.createElement('div');
  row.className = 'usage-bar-row';
  row.innerHTML = `
    <span class="usage-bar-label">${label}</span>
    <span class="usage-bar-track">
      <span class="usage-bar-fill" style="width:${clampedPct}%; background:${barColor}"></span>
    </span>
    <span class="usage-bar-pct ${textClass}">${clampedPct.toFixed(1)}%</span>
  `;
  resultsEl.appendChild(row);
  if (detail) {
    const d = document.createElement('div');
    d.className = 'usage-bar-detail';
    d.textContent = detail;
    resultsEl.appendChild(d);
  }
}

function addBanner(text, status) {
  const el = document.createElement('div');
  el.className = `banner ${status}`;
  el.textContent = `${ICONS[status] || ''} ${text}`;
  resultsEl.appendChild(el);
}

function addLinkButtons(buttonsConfig) {
  const wrap = document.createElement('div');
  wrap.className = 'link-buttons';
  buttonsConfig.forEach(({ label, onClick }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = onClick;
    wrap.appendChild(btn);
  });
  resultsEl.appendChild(wrap);
}

// ── Barra de estado inferior ─────────────────────────────────────────────────
async function updateStatusBar() {
  const s = await window.api.getEquipmentSummary();
  const now = new Date();
  const fecha = now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  statusBar.textContent =
    `IT Toolkit v${APP_VERSION}   |   ${fecha}   |   Equipo: ${s.computerName}   |   ` +
    `Usuario: ${s.userName}   |   SO: ${s.operatingSystem}   |   Encendido hace: ${s.uptimeText}`;
}
updateStatusBar();
setInterval(updateStatusBar, 30000);

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidad 1 — Test de Velocidad con Medidor a Tiempo Real
// ═══════════════════════════════════════════════════════════════════════════════
function createSpeedGaugeWidget() {
  const container = document.createElement('div');
  container.className = 'speed-gauge-container';
  container.id = 'speed-gauge-widget';
  container.innerHTML = `
    <div class="speed-gauge-phase-badges">
      <span class="gauge-phase-badge" id="badge-ping">📡 PING: <b id="val-ping">—</b></span>
      <span class="gauge-phase-badge" id="badge-download">⬇ DESCARGA: <b id="val-dl">—</b></span>
      <span class="gauge-phase-badge" id="badge-upload">⬆ SUBIDA: <b id="val-ul">—</b></span>
    </div>

    <div class="speed-gauge-wrapper">
      <svg class="speed-gauge-svg" viewBox="0 0 200 120">
        <defs>
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3B82F6"/>
            <stop offset="50%" stop-color="#6366F1"/>
            <stop offset="100%" stop-color="#10B981"/>
          </linearGradient>
        </defs>
        <path class="gauge-bg-arc" d="M 20,100 A 80,80 0 0,1 180,100" />
        <path class="gauge-fill-arc" id="gauge-fill-path" d="M 20,100 A 80,80 0 0,1 180,100" style="stroke-dasharray: 251.3; stroke-dashoffset: 251.3;" />
      </svg>

      <div class="gauge-center-info">
        <div class="gauge-value" id="gauge-live-value">0.0</div>
        <div class="gauge-unit" id="gauge-live-unit">Mbps</div>
      </div>
    </div>

    <div class="gauge-metrics-strip">
      <div class="metric-item">
        <span class="metric-item-label">Ping</span>
        <span class="metric-item-val" id="strip-ping">—</span>
      </div>
      <div class="metric-item">
        <span class="metric-item-label">Jitter</span>
        <span class="metric-item-val" id="strip-jitter">—</span>
      </div>
      <div class="metric-item">
        <span class="metric-item-label">Descarga</span>
        <span class="metric-item-val" id="strip-dl">—</span>
      </div>
      <div class="metric-item">
        <span class="metric-item-label">Subida</span>
        <span class="metric-item-val" id="strip-ul">—</span>
      </div>
    </div>
  `;
  return container;
}

function updateSpeedGauge(data) {
  const liveVal = document.getElementById('gauge-live-value');
  const liveUnit = document.getElementById('gauge-live-unit');
  const fillArc = document.getElementById('gauge-fill-path');
  const badgePing = document.getElementById('badge-ping');
  const badgeDl = document.getElementById('badge-download');
  const badgeUl = document.getElementById('badge-upload');
  const valPing = document.getElementById('val-ping');
  const valDl = document.getElementById('val-dl');
  const valUl = document.getElementById('val-ul');
  const stripPing = document.getElementById('strip-ping');
  const stripJit = document.getElementById('strip-jitter');
  const stripDl = document.getElementById('strip-dl');
  const stripUl = document.getElementById('strip-ul');

  if (!liveVal) return;

  const totalArcLen = 251.3;
  let mbps = data.mbps || 0;
  const maxScale = Math.max(100, Math.ceil((mbps || 1) / 100) * 100);
  const pct = Math.min(1, mbps / maxScale);
  const offset = totalArcLen * (1 - pct);
  if (fillArc) fillArc.style.strokeDashoffset = offset;

  if (data.ping != null && data.ping > 0) {
    if (valPing) valPing.textContent = `${data.ping} ms`;
    if (stripPing) stripPing.textContent = `${data.ping} ms`;
  }
  if (data.jitter != null && data.jitter >= 0) {
    if (stripJit) stripJit.textContent = `${data.jitter} ms`;
  }
  if (data.download != null && data.download > 0) {
    if (valDl) valDl.textContent = `${data.download} Mbps`;
    if (stripDl) stripDl.textContent = `${data.download} Mbps`;
  }
  if (data.upload != null && data.upload > 0) {
    if (valUl) valUl.textContent = `${data.upload} Mbps`;
    if (stripUl) stripUl.textContent = `${data.upload} Mbps`;
  }

  if (data.phase === 'ping') {
    if (badgePing) badgePing.className = 'gauge-phase-badge active';
    if (badgeDl) badgeDl.className = 'gauge-phase-badge';
    if (badgeUl) badgeUl.className = 'gauge-phase-badge';
    liveVal.textContent = data.ping || 0;
    liveUnit.textContent = 'ms';
  } else if (data.phase.startsWith('download')) {
    if (badgePing) badgePing.className = 'gauge-phase-badge done';
    if (badgeDl) badgeDl.className = 'gauge-phase-badge active';
    if (badgeUl) badgeUl.className = 'gauge-phase-badge';
    liveVal.textContent = mbps.toFixed(1);
    liveUnit.textContent = 'Mbps (↓)';
  } else if (data.phase.startsWith('upload')) {
    if (badgePing) badgePing.className = 'gauge-phase-badge done';
    if (badgeDl) badgeDl.className = 'gauge-phase-badge done';
    if (badgeUl) badgeUl.className = 'gauge-phase-badge active';
    liveVal.textContent = mbps.toFixed(1);
    liveUnit.textContent = 'Mbps (↑)';
  } else if (data.phase === 'done') {
    if (badgePing) badgePing.className = 'gauge-phase-badge done';
    if (badgeDl) badgeDl.className = 'gauge-phase-badge done';
    if (badgeUl) badgeUl.className = 'gauge-phase-badge done';
    liveVal.textContent = (data.download || 0).toFixed(1);
    liveUnit.textContent = 'Mbps';
  }
}

if (window.api && window.api.onSpeedTestRealtime) {
  window.api.onSpeedTestRealtime(updateSpeedGauge);
}

document.getElementById('btn-speedtest').addEventListener('click', async () => {
  clearResults('Test de Velocidad');
  resultsEl.appendChild(createSpeedGaugeWidget());
  setBusy(true, 'Preparando test de velocidad...');
  window.api.onSpeedTestProgress(msg => { statusText.textContent = msg; });

  try {
    const r = await window.api.runSpeedTest();

    addSectionTitle('Resultados detallados');
    addResultLine('Descarga', `${r.download} Mbps — ${r.downloadLabel}`, r.downloadStatus);
    addResultLine('Subida', `${r.upload}   Mbps — ${r.uploadLabel}`, r.uploadStatus);
    addResultLine('Ping', `${r.ping}   ms — ${r.pingLabel}`, r.pingStatus);
    addResultLine('Jitter', `${r.jitter} ms`);

    const overallStatus = [r.downloadStatus, r.uploadStatus].includes('error') ? 'error'
      : [r.downloadStatus, r.uploadStatus, r.pingStatus].includes('warn') ? 'warn' : 'ok';
    addBanner(r.overall, overallStatus);

    if (r.note) {
      const note = document.createElement('div');
      note.style.cssText = 'margin-top:10px;font-size:11.5px;color:var(--text-secondary);line-height:1.5;';
      note.textContent = '💡 ' + r.note;
      resultsEl.appendChild(note);
    }

    addLinkButtons([
      { label: 'Abrir test Movistar (referencia)', onClick: () => window.api.openUrl('https://www.movistar.es/test-de-velocidad') },
    ]);

    statusText.textContent = overallStatus === 'error' ? '❌ Operación completada con errores'
      : overallStatus === 'warn' ? '⚠ Operación completada con advertencias'
        : '✔ Operación completada correctamente';
  } catch (e) {
    statusText.textContent = `❌ Error durante la operación: ${e.message}`;
  } finally {
    setBusy(false);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidad 2 — Diagnóstico del PC (Scanner animado + Cards visuales)
// ═══════════════════════════════════════════════════════════════════════════════
function createDiagLoadingWidget() {
  const container = document.createElement('div');
  container.className = 'diag-loading-container';
  container.id = 'diag-loading-widget';
  container.innerHTML = `
    <div class="diag-loading-scanner">
      <div class="scanner-ring ring-1"></div>
      <div class="scanner-ring ring-2"></div>
      <div class="scanner-icon">🖥️</div>
      <div class="scanner-beam"></div>
    </div>
    <div class="diag-loading-title">Analizando componentes del PC...</div>
    <div class="diag-loading-subtitle" id="diag-loading-step">Escaneando procesador CPU...</div>
    <div class="diag-loading-steps-strip">
      <span class="step-chip active" id="chip-cpu">⚡ CPU</span>
      <span class="step-chip" id="chip-ram">💾 RAM</span>
      <span class="step-chip" id="chip-gpu">🎮 GPU</span>
      <span class="step-chip" id="chip-disk">💿 Discos</span>
    </div>
  `;
  return container;
}

function startDiagLoadingSequence() {
  const container = createDiagLoadingWidget();
  resultsEl.appendChild(container);

  const steps = [
    { id: 'chip-cpu', text: 'Analizando rendimiento del procesador...' },
    { id: 'chip-ram', text: 'Midiendo espacio y consumo de memoria RAM...' },
    { id: 'chip-gpu', text: 'Consultando tarjeta gráfica y controladores...' },
    { id: 'chip-disk', text: 'Verificando unidades de almacenamiento...' },
  ];

  let currentStep = 0;
  const stepSubEl = document.getElementById('diag-loading-step');

  const timer = setInterval(() => {
    currentStep++;
    if (currentStep >= steps.length) {
      clearInterval(timer);
      return;
    }
    const prevChip = document.getElementById(steps[currentStep - 1].id);
    const currChip = document.getElementById(steps[currentStep].id);
    if (prevChip) prevChip.className = 'step-chip done';
    if (currChip) currChip.className = 'step-chip active';
    if (stepSubEl) stepSubEl.textContent = steps[currentStep].text;
  }, 400);

  return () => clearInterval(timer);
}

document.getElementById('btn-diagnostico').addEventListener('click', async () => {
  clearResults('Diagnóstico del PC');
  const stopLoading = startDiagLoadingSequence();
  setBusy(true, 'Analizando el equipo...');

  try {
    const r = await window.api.runDiagnostico();
    lastDiagnosticoResult = r;

    stopLoading();
    clearResults('Diagnóstico del PC');

    // ── Panel de resumen superior (fondo oscuro, 4 estadísticas) ─────────────
    const overviewEl = document.createElement('div');
    overviewEl.className = 'diag-overview';
    const gpuCount = r.gpus.length;
    [
      { icon: '⚡', val: `${r.cpu.cores}`, lbl: 'Núcleos CPU' },
      { icon: '💾', val: `${r.ram.totalGb} GB`, lbl: 'RAM Total' },
      { icon: '🎮', val: gpuCount > 0 ? String(gpuCount) : 'N/D', lbl: gpuCount === 1 ? 'GPU' : 'GPUs' },
      { icon: '💿', val: String(r.disks.length), lbl: r.disks.length === 1 ? 'Disco' : 'Discos' },
    ].forEach(s => {
      const el = document.createElement('div');
      el.className = 'diag-overview-stat';
      el.innerHTML = `<span class="stat-icon">${s.icon}</span><span class="stat-val">${s.val}</span><span class="stat-lbl">${s.lbl}</span>`;
      overviewEl.appendChild(el);
    });
    resultsEl.appendChild(overviewEl);

    // ── Helper: construye una tarjeta con barra de uso ───────────────────────
    function buildUsageCard(icon, title, pct, status, metrics) {
      const clampedPct = Math.max(0, Math.min(100, pct));
      const barColor = clampedPct >= 90 ? 'var(--error)'
        : clampedPct >= 75 ? '#EA580C'
          : clampedPct >= 55 ? 'var(--warn)'
            : 'var(--ok)';
      const statusLabel = status === 'ok' ? 'Normal' : status === 'warn' ? 'Elevado' : 'Crítico';
      const card = document.createElement('div');
      card.className = `diag-component-card ${status}`;
      card.innerHTML = `
        <div class="diag-card-header">
          <span class="diag-card-icon">${icon}</span>
          <span class="diag-card-title">${title}</span>
          <span class="diag-card-status-badge ${status}">${statusLabel}</span>
        </div>
        <div class="diag-metrics-row">
          ${metrics.map(m => `<div class="diag-metric">
            <span class="diag-metric-lbl">${m.lbl}</span>
            <span class="diag-metric-val">${m.val}</span>
          </div>`).join('')}
        </div>
        <div class="diag-bar-row">
          <div class="diag-bar-track">
            <div class="diag-bar-fill" style="width:${clampedPct}%;background:${barColor};"></div>
          </div>
          <span class="diag-bar-pct" style="color:${barColor};">${clampedPct.toFixed(1)}%</span>
        </div>
      `;
      return card;
    }

    // ── Sección 1: Sistema Operativo Windows & Placa Base ─────────────────────
    addSectionTitle('Sistema Operativo & Placa Base');
    const sysMoboRow = document.createElement('div');
    sysMoboRow.className = 'diag-sys-row';

    // Card Windows
    const winCard = document.createElement('div');
    winCard.className = 'diag-component-card ok';
    winCard.innerHTML = `
      <div class="diag-card-header">
        <span class="diag-card-icon">🖥️</span>
        <span class="diag-card-title">Sistema Operativo</span>
        <span class="diag-card-status-badge ok">${r.windows.displayVer || 'Windows'}</span>
      </div>
      <div class="diag-metrics-row">
        <div class="diag-metric">
          <span class="diag-metric-lbl">Edición</span>
          <span class="diag-metric-val">${r.windows.name}</span>
        </div>
        <div class="diag-metric">
          <span class="diag-metric-lbl">Compilación</span>
          <span class="diag-metric-val">Build ${r.windows.build}</span>
        </div>
        <div class="diag-metric">
          <span class="diag-metric-lbl">Arquitectura</span>
          <span class="diag-metric-val">${r.windows.arch}</span>
        </div>
      </div>
    `;

    // Card Placa Base
    const moboCard = document.createElement('div');
    moboCard.className = 'diag-component-card ok';
    moboCard.innerHTML = `
      <div class="diag-card-header">
        <span class="diag-card-icon">🔌</span>
        <span class="diag-card-title">Placa Base (Motherboard)</span>
        <span class="diag-card-status-badge ok">Hardware</span>
      </div>
      <div class="diag-metrics-row">
        <div class="diag-metric">
          <span class="diag-metric-lbl">Fabricante</span>
          <span class="diag-metric-val">${r.motherboard.manufacturer}</span>
        </div>
        <div class="diag-metric">
          <span class="diag-metric-lbl">Modelo Placa</span>
          <span class="diag-metric-val">${r.motherboard.product}</span>
        </div>
        <div class="diag-metric">
          <span class="diag-metric-lbl">Versión BIOS</span>
          <span class="diag-metric-val">${r.motherboard.biosVendor} ${r.motherboard.biosVersion} (${r.motherboard.biosDate})</span>
        </div>
      </div>
    `;

    sysMoboRow.appendChild(winCard);
    sysMoboRow.appendChild(moboCard);
    resultsEl.appendChild(sysMoboRow);

    // ── CPU + RAM en rejilla 2 columnas ──────────────────────────────────────
    addSectionTitle('Procesador & Memoria RAM');
    const sysRow = document.createElement('div');
    sysRow.className = 'diag-sys-row';
    sysRow.appendChild(buildUsageCard('⚡', `Procesador (${r.cpu.vendor || 'CPU'})`, r.cpu.usagePercent, r.cpu.status, [
      { lbl: 'Marca / Modelo', val: `${r.cpu.vendor} - ${r.cpu.model}` },
      { lbl: 'Núcleos / Hilos', val: `${r.cpu.cores} / ${r.cpu.threads}` },
      { lbl: 'Uso actual', val: `${r.cpu.usagePercent}%` },
    ]));
    sysRow.appendChild(buildUsageCard('💾', `Memoria RAM (${r.ram.manufacturer || 'RAM'})`, r.ram.percentUsed, r.ram.status, [
      { lbl: 'Marca / Fabricante', val: r.ram.manufacturer || 'No especificada' },
      { lbl: 'Capacidad Total', val: `${r.ram.totalGb} GB (${r.ram.modulesCount || 1} Módulo${(r.ram.modulesCount || 1) > 1 ? 's' : ''})` },
      { lbl: 'Velocidad / Uso', val: `${r.ram.speedMhz ? r.ram.speedMhz + ' MHz | ' : ''}${r.ram.usedGb} GB de ${r.ram.totalGb} GB (${r.ram.percentUsed}%)` },
    ]));
    resultsEl.appendChild(sysRow);

    // ── Tarjeta(s) de GPU ────────────────────────────────────────────────────
    addSectionTitle('Tarjeta gráfica');
    let worstGpu = 'ok';
    if (r.gpus.length === 0) {
      const noGpu = document.createElement('div');
      noGpu.className = 'diag-component-card warn';
      noGpu.innerHTML = `
        <div class="diag-card-header">
          <span class="diag-card-icon">🎮</span>
          <span class="diag-card-title">Tarjeta gráfica</span>
          <span class="diag-card-status-badge warn">No detectada</span>
        </div>
        <div style="font-size:13px;color:var(--text-secondary);">
          No ha sido posible identificar la tarjeta gráfica mediante WMI.
        </div>
      `;
      resultsEl.appendChild(noGpu);
      worstGpu = 'warn';
    } else {
      r.gpus.forEach((g, idx) => {
        const tStatus = g.temperature != null
          ? (g.temperature < 70 ? 'ok' : g.temperature <= 85 ? 'warn' : 'error')
          : null;
        const cardStatus = (g.driverStatus === 'error' || tStatus === 'error') ? 'error'
          : (g.driverStatus === 'warn' || tStatus === 'warn') ? 'warn' : 'ok';
        if (cardStatus === 'error') worstGpu = 'error';
        else if (cardStatus === 'warn' && worstGpu !== 'error') worstGpu = 'warn';

        const driverLabel = g.driverStatus === 'ok' ? 'Actualizado'
          : g.driverStatus === 'warn' ? 'Desactualizado' : 'Sin driver';

        const gc = document.createElement('div');
        gc.className = `diag-component-card ${cardStatus}`;
        gc.innerHTML = `
          <div class="diag-card-header">
            <span class="diag-card-icon">🎮</span>
            <span class="diag-card-title">${r.gpus.length > 1 ? `GPU ${idx + 1}: ` : ''}${g.model}</span>
            <span class="diag-card-status-badge ${g.driverStatus}">${driverLabel}</span>
          </div>
          <div class="diag-metrics-row">
            <div class="diag-metric">
              <span class="diag-metric-lbl">Fabricante</span>
              <span class="diag-metric-val">${g.manufacturer}</span>
            </div>
            <div class="diag-metric">
              <span class="diag-metric-lbl">Driver instalado</span>
              <span class="diag-metric-val">${g.driverVersion || 'N/D'}</span>
            </div>
            <div class="diag-metric">
              <span class="diag-metric-lbl">Fecha driver</span>
              <span class="diag-metric-val">${g.driverDate || 'N/D'}</span>
            </div>
          </div>
          ${g.temperature != null
            ? `<span class="diag-temp-badge ${tStatus}">
                🌡️ ${g.temperature.toFixed(0)} °C —
                ${tStatus === 'ok' ? 'Temperatura normal' : tStatus === 'warn' ? 'Temperatura alta' : 'Temperatura crítica'}
               </span>`
            : `<span style="font-size:12px;color:var(--text-secondary);">
                🌡️ ${g.temperatureError || 'Temperatura no disponible (solo soportada en NVIDIA)'}
               </span>`
          }
        `;
        resultsEl.appendChild(gc);
      });
    }

    // ── Fuente de Alimentación (PSU) ─────────────────────────────────────────
    addSectionTitle('Fuente de Alimentación (PSU)');
    const psuCard = document.createElement('div');
    psuCard.className = 'diag-component-card ok';
    const psuInfo = r.psu || { type: 'Fuente ATX de Sobremesa', status: 'Alimentación CA Continua', recommendedWatts: '550W - 650W 80 PLUS', estimatedTdp: '~350W TDP' };
    psuCard.innerHTML = `
      <div class="diag-card-header">
        <span class="diag-card-icon">⚡</span>
        <span class="diag-card-title">${psuInfo.type}</span>
        <span class="diag-card-status-badge ok">Alimentación OK</span>
      </div>
      <div class="diag-metrics-row">
        <div class="diag-metric">
          <span class="diag-metric-lbl">Estado de Red</span>
          <span class="diag-metric-val">${psuInfo.status}</span>
        </div>
        <div class="diag-metric">
          <span class="diag-metric-lbl">Potencia Recomendada</span>
          <span class="diag-metric-val">${psuInfo.recommendedWatts}</span>
        </div>
        <div class="diag-metric">
          <span class="diag-metric-lbl">Consumo Estimado TDP</span>
          <span class="diag-metric-val">${psuInfo.estimatedTdp}</span>
        </div>
      </div>
    `;
    resultsEl.appendChild(psuCard);

    // ── Discos en grid ───────────────────────────────────────────────────────
    addSectionTitle('Almacenamiento (Discos Duros / SSD)');
    let worstDisk = 'ok';
    if (r.disks.length === 0) {
      const noDisk = document.createElement('div');
      noDisk.style.cssText = 'padding:6px 0;font-size:13px;color:var(--text-secondary);';
      noDisk.textContent = 'No se han detectado discos lógicos de tipo fijo.';
      resultsEl.appendChild(noDisk);
    } else {
      const diskGrid = document.createElement('div');
      diskGrid.className = 'diag-disk-grid';
      r.disks.forEach(d => {
        const pct = Math.max(0, Math.min(100, d.percentUsed));
        const barColor = pct >= 90 ? 'var(--error)'
          : pct >= 80 ? '#EA580C'
            : pct >= 60 ? 'var(--warn)'
              : 'var(--ok)';
        const statusLabel = d.status === 'ok' ? 'Bien' : d.status === 'warn' ? 'Poco espacio' : 'Crítico';
        if (d.status === 'error') worstDisk = 'error';
        else if (d.status === 'warn' && worstDisk !== 'error') worstDisk = 'warn';

        const di = document.createElement('div');
        di.className = `diag-disk-item ${d.status}`;
        di.innerHTML = `
          <div class="diag-disk-header">
            <span class="diag-disk-drive">💿 Disco ${d.drive} (${d.brand || 'SSD/HDD'})</span>
            <span class="diag-card-status-badge ${d.status}">${statusLabel}</span>
          </div>
          <div style="font-size:12px;color:var(--accent-light);font-family:monospace;margin:3px 0 6px 0;">
            ${d.model || 'Disco Físico'}
          </div>
          <div class="diag-disk-details">
            <b>${d.freeGb} GB</b> libres de ${d.totalGb} GB
          </div>
          <div class="diag-bar-row">
            <div class="diag-bar-track">
              <div class="diag-bar-fill" style="width:${pct}%;background:${barColor};"></div>
            </div>
            <span class="diag-bar-pct" style="color:${barColor};">${pct.toFixed(0)}%</span>
          </div>
        `;
        diskGrid.appendChild(di);
      });
      resultsEl.appendChild(diskGrid);
    }

    // ── Estado general ───────────────────────────────────────────────────────
    const all = [r.ram.status, r.cpu.status, worstGpu, worstDisk];
    const overall = all.includes('error') ? 'error' : all.includes('warn') ? 'warn' : 'ok';
    addSectionTitle('Estado general');
    addBanner(
      overall === 'ok'
        ? 'Equipo apto para trabajar.'
        : overall === 'warn'
          ? 'Se recomienda realizar mantenimiento.'
          : 'Se requiere intervención: hay componentes en estado crítico.',
      overall
    );

    statusText.textContent = overall === 'error'
      ? '❌ Operación completada. Se detectaron problemas críticos.'
      : overall === 'warn'
        ? '⚠ Operación completada con advertencias'
        : '✔ Operación completada correctamente';
  } catch (e) {
    statusText.textContent = `❌ Error durante la operación: ${e.message}`;
  } finally {
    setBusy(false);
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// Utilidad 3 — Alto Rendimiento
// ═══════════════════════════════════════════════════════════════════════════════
document.getElementById('btn-highperf').addEventListener('click', async () => {
  clearResults('Activar Alto Rendimiento');
  setBusy(true, 'Configurando el plan de energía...');
  try {
    const r = await window.api.activateHighPerformance();
    addSectionTitle('Resultado');
    if (r.alreadyActive) {
      addResultLine('Estado', 'El plan Alto rendimiento ya estaba activo.', 'ok');
      statusText.textContent = '✔ El plan de energía ya estaba activo';
    } else if (r.success) {
      addResultLine('Estado', 'Plan de energía configurado correctamente.', 'ok');
      statusText.textContent = '✔ Operación completada correctamente';
    } else {
      addResultLine('Estado', r.message, 'error');
      statusText.textContent = '❌ Error durante la operación';
    }
  } catch (e) {
    statusText.textContent = `❌ Error durante la operación: ${e.message}`;
  } finally {
    setBusy(false);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidad 4 — SFC /SCANNOW (abre CMD visible)
// ═══════════════════════════════════════════════════════════════════════════════
document.getElementById('btn-sfc').addEventListener('click', async () => {
  if (!confirm('¿Desea ejecutar el comprobador de archivos del sistema?\n\nSe abrirá una ventana CMD con permisos de administrador. Puede tardar varios minutos.\n\nCierra la ventana CMD cuando finalice para ver el resultado.')) return;

  clearResults('Ejecutar SFC /SCANNOW');
  setBusy(true, 'Solicitando permisos de administrador...');
  window.api.onSfcProgress(msg => { statusText.textContent = msg; });

  try {
    const r = await window.api.runSfc();
    lastSfcResult = r;

    addSectionTitle('Resultado');
    if (r.cancelled || (!r.success && r.summary && (r.summary.includes('cancel') || r.summary.includes('cerró')))) {
      addResultLine('Estado', r.summary || 'Operación cancelada por el usuario o ventana CMD cerrada.', 'warn');
      statusText.textContent = '❌ Operación cancelada o ventana CMD cerrada';
    } else {
      const mins = Math.floor(r.elapsedMs / 60000);
      const secs = Math.floor((r.elapsedMs % 60000) / 1000);
      addResultLine('Resumen', r.summary, r.success ? 'ok' : 'warn');
      addResultLine('Tiempo empleado', `${mins} min ${secs} s`);
      addBanner('Revisa la ventana CMD que se abrió para ver el resultado completo línea a línea.', 'ok');
      statusText.textContent = r.success ? '✔ Operación completada correctamente' : '⚠ Operación completada con advertencias';
    }
  } catch (e) {
    statusText.textContent = `❌ Error durante la operación: ${e.message}`;
  } finally {
    setBusy(false);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidad 5 — DISM (abre CMD visible)
// ═══════════════════════════════════════════════════════════════════════════════
document.getElementById('btn-dism').addEventListener('click', async () => {
  if (!confirm('¿Desea reparar la imagen del sistema?\n\nSe abrirá una ventana CMD con permisos de administrador.\nRequiere conexión a internet. Puede tardar 10-30 minutos.\n\nCierra la ventana CMD cuando finalice para ver el resultado.')) return;

  clearResults('Reparar Windows (DISM)');
  setBusy(true, 'Solicitando permisos de administrador...');
  window.api.onDismProgress(msg => { statusText.textContent = msg; });

  try {
    const r = await window.api.runDism();
    lastDismResult = r;

    addSectionTitle('Resultado');
    if (r.cancelled || (!r.success && r.summary && (r.summary.includes('cancel') || r.summary.includes('cerró')))) {
      addResultLine('Estado', r.summary || 'Operación cancelada por el usuario o ventana CMD cerrada.', 'warn');
      statusText.textContent = '❌ Operación cancelada o ventana CMD cerrada';
    } else {
      const mins = Math.floor(r.elapsedMs / 60000);
      const secs = Math.floor((r.elapsedMs % 60000) / 1000);
      addResultLine('Resumen', r.summary, r.success ? 'ok' : 'warn');
      addResultLine('Tiempo empleado', `${mins} min ${secs} s`);
      addBanner('Revisa la ventana CMD que se abrió para ver el resultado completo línea a línea.', 'ok');
      statusText.textContent = r.success ? '✔ Operación completada correctamente' : '⚠ Operación completada con advertencias';
    }
  } catch (e) {
    statusText.textContent = `❌ Error durante la operación: ${e.message}`;
  } finally {
    setBusy(false);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidad — Limpiar Archivos Temporales (Visual + Ejecución Real)
// ═══════════════════════════════════════════════════════════════════════════════
document.getElementById('btn-cleantemp').addEventListener('click', async () => {
  clearResults('Limpiar Archivos Temporales');
  setBusy(true, 'Escaneando y eliminando archivos temporales...');
  window.api.onCleanTempProgress(msg => { statusText.textContent = msg; });

  try {
    const res = await window.api.runCleanTemp();

    addSectionTitle('Informe de Limpieza de Espacio');

    // Tarjeta visual principal de resumen
    const summaryCard = document.createElement('div');
    summaryCard.className = 'gpu-driver-card ok';
    summaryCard.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)';
    summaryCard.style.borderColor = 'rgba(16, 185, 129, 0.3)';

    const displaySize = parseFloat(res.freedMb) > 1024 ? `${res.freedGb} GB` : `${res.freedMb} MB`;

    summaryCard.innerHTML = `
      <div class="gpu-card-top">
        <div>
          <span class="gpu-card-badge-mfg" style="background:#10B981; color:#000;">LIMPIEZA COMPLETADA</span>
          <h3 class="gpu-card-name" style="color:#34D399; margin-top:4px;">✨ ${displaySize} Liberados</h3>
        </div>
        <div class="gpu-card-status-pill ok">
          🟢 Sistema Optimizado
        </div>
      </div>

      <div class="gpu-card-grid" style="margin-top:14px;">
        <div class="gpu-card-stat">
          <span class="gpu-stat-icon">🗑️</span>
          <div class="gpu-stat-text">
            <span class="gpu-stat-label">Archivos Eliminados</span>
            <span class="gpu-stat-value">${res.filesDeleted}</span>
          </div>
        </div>
        <div class="gpu-card-stat">
          <span class="gpu-stat-icon">🔒</span>
          <div class="gpu-stat-text">
            <span class="gpu-stat-label">Archivos en uso (Protegidos)</span>
            <span class="gpu-stat-value">${res.filesFailed}</span>
          </div>
        </div>
        <div class="gpu-card-stat">
          <span class="gpu-stat-icon">📂</span>
          <div class="gpu-stat-text">
            <span class="gpu-stat-label">Ubicaciones Escaneadas</span>
            <span class="gpu-stat-value">${res.categoriesCleared.length} carpetas</span>
          </div>
        </div>
        <div class="gpu-card-stat">
          <span class="gpu-stat-icon">⚡</span>
          <div class="gpu-stat-text">
            <span class="gpu-stat-label">Estado del Disco</span>
            <span class="gpu-stat-value">Caché limpia</span>
          </div>
        </div>
      </div>

      <div class="gpu-card-notice" style="margin-top:14px; background:rgba(16, 185, 129, 0.08); border-color:rgba(16, 185, 129, 0.2);">
        <span style="font-size:18px;">💡</span>
        <div>
          Se han vaciado las carpetas de archivos temporales de usuario, temporales de Windows, prefetch y descargas de Windows Update. Los archivos en uso por programas abiertos se mantuvieron seguros.
        </div>
      </div>
    `;

    resultsEl.appendChild(summaryCard);

    addSectionTitle('Desglose por Ubicación');
    res.categoriesCleared.forEach(cat => {
      addResultLine(cat.name, `${cat.freedMb} MB liberados (${cat.filesCount} archivos borrados)`, 'ok');
    });

    statusText.textContent = `✔ Limpieza finalizada: ${displaySize} de espacio liberado`;
  } catch (e) {
    statusText.textContent = `❌ Error en la limpieza: ${e.message}`;
  } finally {
    setBusy(false);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidad 6 — Drivers de GPU (Scanner Neón de GPU)
// ═══════════════════════════════════════════════════════════════════════════════
function createGpuLoadingWidget() {
  const container = document.createElement('div');
  container.className = 'gpu-loading-container';
  container.id = 'gpu-loading-widget';
  container.innerHTML = `
    <div class="gpu-loading-scanner">
      <div class="gpu-fan-ring ring-outer"></div>
      <div class="gpu-fan-ring ring-inner"></div>
      <div class="gpu-icon">🎮</div>
      <div class="gpu-scan-beam"></div>
    </div>
    <div class="gpu-loading-title">Comprobando controladores de la GPU...</div>
    <div class="gpu-loading-subtitle" id="gpu-loading-step">Identificando modelo y fabricante de la GPU...</div>
    <div class="gpu-loading-steps-strip">
      <span class="step-chip active" id="chip-gpu-model">🔍 Modelo GPU</span>
      <span class="step-chip" id="chip-gpu-version">📋 Versión Driver</span>
      <span class="step-chip" id="chip-gpu-official">🌐 Descarga Oficial</span>
    </div>
  `;
  return container;
}

function startGpuLoadingSequence() {
  const container = createGpuLoadingWidget();
  resultsEl.appendChild(container);

  const steps = [
    { id: 'chip-gpu-model', text: 'Identificando modelo y fabricante de la GPU...' },
    { id: 'chip-gpu-version', text: 'Consultando versión y fecha del controlador instalado...' },
    { id: 'chip-gpu-official', text: 'Obteniendo enlaces a descargas oficiales...' },
  ];

  let currentStep = 0;
  const stepSubEl = document.getElementById('gpu-loading-step');

  const timer = setInterval(() => {
    currentStep++;
    if (currentStep >= steps.length) {
      clearInterval(timer);
      return;
    }
    const prevChip = document.getElementById(steps[currentStep - 1].id);
    const currChip = document.getElementById(steps[currentStep].id);
    if (prevChip) prevChip.className = 'step-chip done';
    if (currChip) currChip.className = 'step-chip active';
    if (stepSubEl) stepSubEl.textContent = steps[currentStep].text;
  }, 350);

  return () => clearInterval(timer);
}

function createGpuDriverCard(g) {
  const card = document.createElement('div');
  const isWarn = g.driverStatus === 'warn';
  const isErr = g.driverStatus === 'error';

  const pillText = isErr ? '❌ Sin controlador'
    : isWarn ? '⚠ Revisar actualización'
      : '✔ Reciente';

  card.className = `gpu-driver-card ${g.driverStatus}`;
  card.innerHTML = `
    <div class="gpu-card-top">
      <div>
        <span class="gpu-card-badge-mfg">${g.manufacturer}</span>
        <h3 class="gpu-card-name">${g.model}</h3>
      </div>
      <div class="gpu-card-status-pill ${g.driverStatus}">
        ${pillText}
      </div>
    </div>

    <div class="gpu-card-grid">
      <div class="gpu-card-stat">
        <span class="gpu-stat-icon">📦</span>
        <div class="gpu-stat-text">
          <span class="gpu-stat-label">Driver Instalado</span>
          <span class="gpu-stat-value">${g.driverVersion || 'No detectado'}</span>
        </div>
      </div>
      <div class="gpu-card-stat">
        <span class="gpu-stat-icon">📅</span>
        <div class="gpu-stat-text">
          <span class="gpu-stat-label">Fecha de Versión</span>
          <span class="gpu-stat-value">${g.driverDate || 'No disponible'}</span>
        </div>
      </div>
      <div class="gpu-card-stat">
        <span class="gpu-stat-icon">🌡️</span>
        <div class="gpu-stat-text">
          <span class="gpu-stat-label">Temperatura GPU</span>
          <span class="gpu-stat-value">${g.temperature != null ? g.temperature + ' °C' : 'N/D'}</span>
        </div>
      </div>
      <div class="gpu-card-stat">
        <span class="gpu-stat-icon">🛡️</span>
        <div class="gpu-stat-text">
          <span class="gpu-stat-label">Estado de Seguridad</span>
          <span class="gpu-stat-value">${g.driverStatus === 'ok' ? 'Controlador Estable' : 'Revisar Actualización'}</span>
        </div>
      </div>
    </div>

    <div class="gpu-card-notice">
      <span style="font-size:18px;">💡</span>
      <div>
        Los fabricantes de GPU lanzan actualizaciones constantemente para optimizar juegos y rendimiento.
        Comprueba si hay un nuevo controlador listo para descargar desde la <strong>NVIDIA App</strong> o la web oficial.
      </div>
    </div>

    <div class="gpu-card-actions"></div>
  `;

  const actionsEl = card.querySelector('.gpu-card-actions');
  if (g.officialUrl && actionsEl) {
    const btnUrl = document.createElement('button');
    btnUrl.className = 'gpu-btn primary';
    btnUrl.innerHTML = `🚀 Abrir Web Oficial de ${g.manufacturer}`;
    btnUrl.onclick = () => window.api.openUrl(g.officialUrl);

    const btnCopy = document.createElement('button');
    btnCopy.className = 'gpu-btn secondary';
    btnCopy.innerHTML = `📋 Copiar Enlace Directo`;
    btnCopy.onclick = () => {
      window.api.copyToClipboard(g.officialUrl);
      statusText.textContent = 'Enlace de descarga copiado al portapapeles.';
    };

    actionsEl.appendChild(btnUrl);
    actionsEl.appendChild(btnCopy);
  }

  return card;
}

document.getElementById('btn-gpudrivers').addEventListener('click', async () => {
  clearResults('Actualizar Drivers de la GPU');
  const stopLoading = startGpuLoadingSequence();
  setBusy(true, 'Detectando tarjeta(s) gráfica(s)...');
  try {
    const gpus = await window.api.getGpuDrivers();
    lastGpuDriversResult = gpus;

    stopLoading();
    clearResults('Actualizar Drivers de la GPU');

    if (gpus.length === 0) {
      addResultLine('Estado', 'No ha sido posible identificar la tarjeta gráfica o consultar la información del controlador.', 'error');
      statusText.textContent = '⚠ Operación completada con advertencias';
      return;
    }

    gpus.forEach(g => {
      resultsEl.appendChild(createGpuDriverCard(g));
    });
    statusText.textContent = '✔ Operación completada correctamente';
  } catch (e) {
    statusText.textContent = `❌ Error: ${e.message}. No ha sido posible identificar la tarjeta gráfica.`;
  } finally {
    setBusy(false);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidad 7 — Visor de Eventos
// ═══════════════════════════════════════════════════════════════════════════════
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms) {
  if (ms == null) return 'Desconocido';
  const totalMin = Math.round(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  return days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;
}

function renderEventTable(container, events) {
  container.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'events-table';
  const cols = [
    { key: 'time', label: 'Fecha/Hora' }, { key: 'level', label: 'Nivel' },
    { key: 'id', label: 'ID' }, { key: 'provider', label: 'Origen' }, { key: 'title', label: 'Resumen' },
  ];
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  cols.forEach(c => {
    const th = document.createElement('th');
    const arrow = eventTableSort.key === c.key ? (eventTableSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = c.label + arrow;
    th.onclick = () => {
      if (eventTableSort.key === c.key) eventTableSort.dir = eventTableSort.dir === 'asc' ? 'desc' : 'asc';
      else { eventTableSort.key = c.key; eventTableSort.dir = 'asc'; }
      renderEventTable(container, events);
    };
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const sorted = [...events].sort((a, b) => {
    let av = a[eventTableSort.key], bv = b[eventTableSort.key];
    if (eventTableSort.key === 'time') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
    if (av < bv) return eventTableSort.dir === 'asc' ? -1 : 1;
    if (av > bv) return eventTableSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = document.createElement('tbody');
  sorted.forEach(e => {
    const tr = document.createElement('tr');
    const lc = (e.level || '').toLowerCase();
    const levelClass = lc.includes('crít') || lc.includes('error') ? 'level-error'
      : lc.includes('advert') || lc.includes('warn') ? 'level-warn' : '';
    tr.innerHTML = `
      <td>${fmtDateTime(e.time)}</td>
      <td class="${levelClass}">${e.level}</td>
      <td>${e.id}</td>
      <td>${e.provider}</td>
      <td class="desc-cell">${e.title}${e.interpretation ? ' — ' + e.interpretation : ''}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function buildReportHtml(summary, report) {
  const rows = report.events.map(e => `<tr><td>${fmtDateTime(e.time)}</td><td>${e.level}</td><td>${e.id}</td><td>${e.provider}</td><td>${e.title}${e.interpretation ? ' — ' + e.interpretation : ''}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
    body{font-family:Arial,sans-serif;color:#1F2937;padding:24px;}
    h1{font-size:20px;} h2{font-size:15px;margin-top:20px;}
    .meta{color:#6B7280;font-size:12.5px;margin-bottom:16px;}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;}
    td,th{border:1px solid #E2E4E9;padding:6px 8px;text-align:left;}
    th{background:#F5F6F8;} ul{padding-left:18px;}
  </style></head><body>
    <h1>Informe del Visor de Eventos - IT Toolkit</h1>
    <div class="meta">Fecha: ${new Date().toLocaleString('es-ES')}<br/>
    Equipo: ${summary.computerName} | Usuario: ${summary.userName} | SO: ${summary.operatingSystem}<br/>
    Rango: últimos ${report.daysBack} días</div>
    <h2>Resumen ejecutivo</h2><p>${report.overallText}</p>
    <ul><li>Apagados inesperados: ${report.counts.apagado_inesperado}</li>
    <li>Errores críticos: ${report.criticalCount}</li>
    <li>Errores de disco: ${report.counts.disco}</li>
    <li>Errores WHEA: ${report.counts.whea}</li>
    <li>Errores de servicios: ${report.counts.servicios}</li></ul>
    <h2>Recomendaciones</h2><ul>${report.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
    <h2>Últimos ${report.events.length} eventos críticos</h2>
    <table><thead><tr><th>Fecha/Hora</th><th>Nivel</th><th>ID</th><th>Origen</th><th>Descripción</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
}

function buildReportText(summary, report) {
  const l = [];
  l.push('INFORME DEL VISOR DE EVENTOS - IT TOOLKIT');
  l.push('='.repeat(50));
  l.push(`Fecha: ${new Date().toLocaleString('es-ES')}`);
  l.push(`Equipo: ${summary.computerName}  |  Usuario: ${summary.userName}  |  SO: ${summary.operatingSystem}`);
  l.push(`Rango: últimos ${report.daysBack} días\n`);
  l.push('RESUMEN EJECUTIVO'); l.push('-'.repeat(50));
  l.push(report.overallText);
  l.push(`Apagados inesperados: ${report.counts.apagado_inesperado}`);
  l.push(`Errores de disco: ${report.counts.disco}`);
  l.push(`Errores WHEA: ${report.counts.whea}`);
  l.push(`Errores de servicios: ${report.counts.servicios}\n`);
  l.push('RECOMENDACIONES'); l.push('-'.repeat(50));
  report.recommendations.forEach(r => l.push(`- ${r}`));
  l.push('\nÚLTIMOS EVENTOS'); l.push('-'.repeat(50));
  report.events.forEach(e => l.push(`${fmtDateTime(e.time)} | ${e.level} | ID ${e.id} | ${e.provider} | ${e.title}`));
  return l.join('\n');
}

async function handleExport(format, html, text, baseName) {
  const summary = await window.api.getEquipmentSummary();
  const defaultName = `${baseName}_${summary.computerName}_${new Date().toISOString().slice(0, 10)}`;
  const result = await window.api.exportEventReport({ format, html, text, defaultName });
  if (result.canceled) return;
  statusText.textContent = result.success ? `✔ Informe exportado: ${result.filePath}` : `❌ No se pudo exportar: ${result.error || ''}`;
}

function createEventLoadingWidget() {
  const container = document.createElement('div');
  container.className = 'event-loading-container';
  container.id = 'event-loading-widget';
  container.innerHTML = `
    <div class="event-loading-scanner">
      <div class="event-shield-ring ring-outer"></div>
      <div class="event-shield-ring ring-inner"></div>
      <div class="event-icon">🛡️</div>
      <div class="event-scan-beam"></div>
    </div>
    <div class="event-loading-title">Auditando Registro de Eventos del Sistema...</div>
    <div class="event-loading-subtitle" id="event-loading-step">Analizando tiempo encendido y reinicios...</div>
    <div class="event-loading-steps-strip">
      <span class="step-chip active" id="chip-evt-uptime">⏱️ Uptime / Reinicios</span>
      <span class="step-chip" id="chip-evt-shutdown">🛑 Registros Apagado</span>
      <span class="step-chip" id="chip-evt-crashes">💥 Cierres Aplicaciones</span>
    </div>
  `;
  return container;
}

function startEventLoadingSequence() {
  const container = createEventLoadingWidget();
  resultsEl.appendChild(container);

  const steps = [
    { id: 'chip-evt-uptime', text: 'Analizando tiempo encendido y fecha de último reinicio...' },
    { id: 'chip-evt-shutdown', text: 'Auditando registros de apagado del sistema...' },
    { id: 'chip-evt-crashes', text: 'Buscando cierres inesperados de aplicaciones en Application Error...' },
  ];

  let currentStep = 0;
  const stepSubEl = document.getElementById('event-loading-step');

  const timer = setInterval(() => {
    currentStep++;
    if (currentStep >= steps.length) {
      clearInterval(timer);
      return;
    }
    const prevChip = document.getElementById(steps[currentStep - 1].id);
    const currChip = document.getElementById(steps[currentStep].id);
    if (prevChip) prevChip.className = 'step-chip done';
    if (currChip) currChip.className = 'step-chip active';
    if (stepSubEl) stepSubEl.textContent = steps[currentStep].text;
  }, 400);

  return () => clearInterval(timer);
}

async function runEventAnalysis(range = '7') {
  clearResults('Visor de Eventos del Sistema');
  const stopLoading = startEventLoadingSequence();
  setBusy(true, 'Consultando tiempo encendido, reinicios, apagados y cierres de programas...');
  window.api.onEventLogProgress(msg => { statusText.textContent = msg; });

  try {
    const report = await window.api.runEventLogAnalysis(range);
    lastEventReport = report;

    stopLoading();
    clearResults('Visor de Eventos del Sistema');

    if (report.elevationDenied) {
      addBanner('Se canceló la solicitud de permisos de administrador.', 'error');
      statusText.textContent = '❌ Operación cancelada';
      return;
    }

    // ── Selector de Rango ────────────────────────────────────────────────────
    const rangeWrap = document.createElement('div');
    rangeWrap.className = 'range-select';
    rangeWrap.innerHTML = '<span>Rango de cierres de programas:</span>';
    const select = document.createElement('select');
    const rangeOptions = [
      { val: 'today', lbl: 'Hoy' },
      { val: 'yesterday', lbl: 'Ayer' },
      { val: '7', lbl: 'Últimos 7 días' },
    ];
    rangeOptions.forEach(optData => {
      const opt = document.createElement('option');
      opt.value = optData.val;
      opt.textContent = optData.lbl;
      if (optData.val === String(range)) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = () => runEventAnalysis(select.value);
    rangeWrap.appendChild(select);
    resultsEl.appendChild(rangeWrap);

    // ── Panel de Resumen Esencial (4 Estadísticas) ───────────────────────────
    const overviewEl = document.createElement('div');
    overviewEl.className = 'diag-overview';

    const crashCount = (report.appCrashes || []).length;
    const shutdownText = report.lastShutdownInfo ? fmtDateTime(report.lastShutdownInfo.time) : 'No disponible';
    const rebootText = report.lastBootTime ? fmtDateTime(report.lastBootTime) : 'No disponible';

    [
      { icon: '⏱️', val: report.uptimeText || '—', lbl: 'Tiempo Encendido' },
      { icon: '🔄', val: rebootText, lbl: 'Último Reinicio' },
      { icon: '🛑', val: shutdownText, lbl: 'Último Apagado' },
      { icon: '💥', val: `${crashCount}`, lbl: crashCount === 1 ? 'Cierre de Programa' : 'Cierres de Programas' },
    ].forEach(s => {
      const el = document.createElement('div');
      el.className = 'diag-overview-stat';
      el.innerHTML = `<span class="stat-icon">${s.icon}</span><span class="stat-val">${s.val}</span><span class="stat-lbl">${s.lbl}</span>`;
      overviewEl.appendChild(el);
    });
    resultsEl.appendChild(overviewEl);

    // ── Sección 1: Estado del Sistema (Reinicio y Apagado) ───────────────────
    addSectionTitle('Registro de arranque y apagado');
    addResultLine('Tiempo encendido actual', report.uptimeText || '—', 'ok');
    addResultLine('Último reinicio registrado', rebootText, 'ok');
    if (report.lastShutdownInfo) {
      addResultLine('Último apagado registrado', fmtDateTime(report.lastShutdownInfo.time));
      addResultLine('Tipo de apagado', report.lastShutdownInfo.type, report.lastShutdownInfo.category === 'reinicio_normal' ? 'ok' : 'warn');
    } else {
      addResultLine('Último apagado registrado', 'No se detectó un apagado previo en el rango analizado.', 'ok');
    }

    // ── Sección 2: Cierres Inesperados de Programas con Errores ───────────────
    addSectionTitle(`Cierres inesperados de programas (${crashCount} detectados)`);

    if (!report.appCrashes || report.appCrashes.length === 0) {
      addBanner('✔ No se han detectado cierres inesperados de aplicaciones en el rango analizado.', 'ok');
    } else {
      const crashesContainer = document.createElement('div');
      crashesContainer.className = 'crash-events-list';

      report.appCrashes.forEach(c => {
        const card = document.createElement('div');
        card.className = 'crash-event-card';
        card.innerHTML = `
          <div class="crash-card-header">
            <span class="crash-icon">💥</span>
            <div class="crash-title-group">
              <div class="crash-app-name">${c.appName}</div>
              <div class="crash-app-path">${c.appPath || 'Ruta no especificada'}</div>
            </div>
            <span class="crash-err-code">${c.errCode}</span>
          </div>
          <div class="crash-card-footer">
            <span class="crash-time">📅 ${fmtDateTime(c.time)}</span>
            <span class="crash-badge">Application Error</span>
          </div>
        `;
        crashesContainer.appendChild(card);
      });

      resultsEl.appendChild(crashesContainer);
    }

    statusText.textContent = '✔ Operación completada correctamente';
  } catch (e) {
    statusText.textContent = `❌ Error: ${e.message}`;
  } finally {
    setBusy(false);
  }
}

document.getElementById('btn-eventlog').addEventListener('click', () => runEventAnalysis('7'));

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidad 8 — Evaluación Global del Estado del PC (Hardware vs Consumo)
// ═══════════════════════════════════════════════════════════════════════════════
function classifyGlobalScore(score) {
  if (score >= 9) return { key: 'excelente', label: '🟢 Excelente', detail: 'El equipo se encuentra en un estado óptimo.' };
  if (score >= 7) return { key: 'bueno', label: '🟢 Bueno', detail: 'El equipo funciona correctamente aunque existen recomendaciones de ampliación o mantenimiento.' };
  if (score >= 5) return { key: 'aceptable', label: '🟡 Aceptable', detail: 'El equipo presenta componentes cerca del límite de consumo.' };
  if (score >= 3) return { key: 'deficiente', label: '🟠 Deficiente', detail: 'Se recomienda ampliar memoria o liberar espacio en almacenamiento.' };
  return { key: 'critico', label: '🔴 Crítico', detail: 'El equipo requiere una ampliación o mantenimiento urgente.' };
}

function healthBarColor(pct) { return pct >= 85 ? 'rojo' : pct >= 70 ? 'naranja' : pct >= 50 ? 'amarillo' : 'verde'; }

function createHealthLoadingWidget() {
  const container = document.createElement('div');
  container.className = 'health-loading-container';
  container.id = 'health-loading-widget';
  container.innerHTML = `
    <div class="health-loading-scanner">
      <div class="health-ring ring-outer"></div>
      <div class="health-ring ring-inner"></div>
      <div class="health-icon">🩺</div>
      <div class="health-scan-beam"></div>
    </div>
    <div class="health-loading-title">Evaluando Estado Hardware vs Consumo...</div>
    <div class="health-loading-subtitle" id="health-loading-step">Midiendo carga actual de CPU y RAM...</div>
    <div class="health-loading-steps-strip">
      <span class="step-chip active" id="chip-hlth-cpu">⚡ CPU / RAM</span>
      <span class="step-chip" id="chip-hlth-disk">💿 Almacenamiento</span>
      <span class="step-chip" id="chip-hlth-gpu">🎮 GPU & Drivers</span>
    </div>
  `;
  return container;
}

function startHealthLoadingSequence() {
  const container = createHealthLoadingWidget();
  resultsEl.appendChild(container);

  const steps = [
    { id: 'chip-hlth-cpu', text: 'Midiendo carga actual de procesador (CPU) y memoria RAM...' },
    { id: 'chip-hlth-disk', text: 'Analizando capacidad disponible y ocupada en discos (SSD/HDD)...' },
    { id: 'chip-hlth-gpu', text: 'Verificando temperatura de GPU y versión de controladores...' },
  ];

  let currentStep = 0;
  const stepSubEl = document.getElementById('health-loading-step');

  const timer = setInterval(() => {
    currentStep++;
    if (currentStep >= steps.length) {
      clearInterval(timer);
      return;
    }
    const prevChip = document.getElementById(steps[currentStep - 1].id);
    const currChip = document.getElementById(steps[currentStep].id);
    if (prevChip) prevChip.className = 'step-chip done';
    if (currChip) currChip.className = 'step-chip active';
    if (stepSubEl) stepSubEl.textContent = steps[currentStep].text;
  }, 400);

  return () => clearInterval(timer);
}

document.getElementById('btn-healthcheck').addEventListener('click', async () => {
  clearResults('Evaluar Estado del Equipo');
  const stopLoading = startHealthLoadingSequence();
  setBusy(true, 'Analizando capacidad de componentes vs consumo actual...');

  try {
    const diag = await window.api.runDiagnostico();
    lastDiagnosticoResult = diag;

    const gpus = lastGpuDriversResult || diag.gpus || [];

    stopLoading();
    clearResults('Evaluar Estado del Equipo');

    // ── Cálculo del Estado de Componentes vs Consumo ────────────────────────
    const ram = diag.ram;
    const cpu = diag.cpu;
    const disks = diag.disks || [];

    // 1. Evaluación RAM
    const ramTotal = ram.totalGB || ram.totalGb || 0;
    const ramUsed = ram.usedGB || ram.usedGb || 0;
    const ramFree = ram.freeGB || ram.freeGb || 0;
    const ramPct = ram.percentUsed;
    const ramNeedUpgrade = ramPct >= 80;
    const ramBadge = ramNeedUpgrade ? '⚠ Ampliación Recomendada' : '✔ Óptimo';
    const ramRec = ramNeedUpgrade
      ? `Estás consumiendo el ${ramPct}% de tus ${ramTotal} GB de RAM (${ramUsed} GB en uso). Si ejecutas juegos o aplicaciones exigentes, se recomienda ampliar la memoria RAM (por ejemplo, pasar a ${Math.max(16, Math.ceil(ramTotal * 2))} GB) o cerrar tareas secundarias.`
      : `Capacidad de memoria adecuada: Consumiendo ${ramUsed} GB de ${ramTotal} GB (${ramPct}% en uso).`;

    // 2. Evaluación CPU
    const cpuPct = cpu.usagePercent;
    const cpuHigh = cpuPct >= 80;
    const cpuBadge = cpuHigh ? '⚠ Carga Elevada' : '✔ Óptimo';
    const cpuRec = cpuHigh
      ? `El procesador (${cpu.model}) está trabajando al ${cpuPct}% de su capacidad continua. Revisa procesos exigentes en segundo plano.`
      : `Procesador (${cpu.model}) operando al ${cpuPct}% de carga. Rendimiento estable.`;

    // 3. Evaluación Discos
    const fullDisk = disks.find(d => d.percentUsed >= 85);
    const diskBadge = fullDisk ? '⚠ Poco Espacio' : '✔ Óptimo';
    const diskRec = fullDisk
      ? `El disco ${fullDisk.drive} está al ${fullDisk.percentUsed}% de capacidad (solo ${fullDisk.freeGB || fullDisk.freeGb} GB libres de ${fullDisk.totalGB || fullDisk.totalGb} GB). Es necesario liberar espacio o ampliar almacenamiento con una unidad SSD adicional.`
      : `Almacenamiento en buen estado: Espacio libre suficiente en todas las unidades.`;

    // 4. Evaluación GPU
    const hotGpu = gpus.find(g => g.temperature != null && g.temperature >= 80);
    const warnGpu = gpus.find(g => g.driverStatus === 'warn');
    const gpuBadge = (hotGpu || warnGpu) ? '⚠ Revisar GPU' : '✔ Óptimo';
    let gpuRec = 'Tarjeta gráfica operando con temperatura y controladores estables.';
    if (hotGpu) gpuRec = `La GPU (${hotGpu.model}) alcanza los ${hotGpu.temperature}°C: Limpiar disipadores y revisar ventilación.`;
    else if (warnGpu) gpuRec = `El controlador de la GPU (${warnGpu.model}) requiere comprobación de actualización en la NVIDIA App o web oficial.`;

    // ── Score Global ─────────────────────────────────────────────────────────
    let score = 10;
    if (ramNeedUpgrade) score -= 2.5;
    if (cpuHigh) score -= 2.0;
    if (fullDisk) score -= 2.5;
    if (hotGpu || warnGpu) score -= 1.5;
    const globalScore = Math.max(1, Math.min(10, score));
    const cls = classifyGlobalScore(globalScore);

    // ── Render UI ────────────────────────────────────────────────────────────
    const scoreBox = document.createElement('div');
    scoreBox.className = `score-global ${cls.key}`;
    scoreBox.innerHTML = `<div class="value">⭐ ${globalScore.toFixed(1)} / 10</div><div class="label">${cls.label} — ${cls.detail}</div>`;
    resultsEl.appendChild(scoreBox);

    addSectionTitle('Comparativa: Capacidad Hardware vs Consumo Actual');

    const compGrid = document.createElement('div');
    compGrid.className = 'eval-comp-grid';

    // Card RAM
    compGrid.innerHTML += `
      <div class="eval-card">
        <div class="eval-card-header">
          <div>
            <div class="eval-card-title">💾 Memoria RAM</div>
            <div class="eval-card-subname">Memoria Total Instalada: ${ramTotal} GB</div>
          </div>
          <span class="eval-badge ${ramNeedUpgrade ? 'warn' : 'ok'}">${ramBadge}</span>
        </div>
        <div class="eval-meter-wrap">
          <div class="eval-meter-track">
            <div class="eval-meter-fill ${healthBarColor(ramPct)}" style="width:${ramPct}%"></div>
          </div>
          <div class="eval-meter-stats">
            <span>Uso Actual: ${ramUsed} GB (${ramPct}%)</span>
            <span>Libre: ${ramFree} GB</span>
          </div>
        </div>
        <div class="eval-recommendation ${ramNeedUpgrade ? 'warn' : ''}">${ramRec}</div>
      </div>
    `;

    // Card CPU
    compGrid.innerHTML += `
      <div class="eval-card">
        <div class="eval-card-header">
          <div>
            <div class="eval-card-title">⚡ Procesador</div>
            <div class="eval-card-subname">${cpu.model || 'CPU del Sistema'} (${cpu.cores} Núcleos)</div>
          </div>
          <span class="eval-badge ${cpuHigh ? 'warn' : 'ok'}">${cpuBadge}</span>
        </div>
        <div class="eval-meter-wrap">
          <div class="eval-meter-track">
            <div class="eval-meter-fill ${healthBarColor(cpuPct)}" style="width:${cpuPct}%"></div>
          </div>
          <div class="eval-meter-stats">
            <span>Carga CPU: ${cpuPct}%</span>
            <span>Frecuencia: ${cpu.clockGhz ? cpu.clockGhz + ' GHz' : 'Estándar'}</span>
          </div>
        </div>
        <div class="eval-recommendation ${cpuHigh ? 'warn' : ''}">${cpuRec}</div>
      </div>
    `;

    // Card Discos
    const mainDisk = disks[0] || { drive: 'C:', percentUsed: 50, freeGB: 100, totalGB: 500 };
    const mainDiskTotal = mainDisk.totalGB || mainDisk.totalGb || 0;
    const mainDiskFree = mainDisk.freeGB || mainDisk.freeGb || 0;
    compGrid.innerHTML += `
      <div class="eval-card">
        <div class="eval-card-header">
          <div>
            <div class="eval-card-title">💿 Almacenamiento</div>
            <div class="eval-card-subname">Unidad ${mainDisk.drive} (${mainDiskTotal} GB - ${disks.length} Unidades)</div>
          </div>
          <span class="eval-badge ${fullDisk ? 'warn' : 'ok'}">${diskBadge}</span>
        </div>
        <div class="eval-meter-wrap">
          <div class="eval-meter-track">
            <div class="eval-meter-fill ${healthBarColor(mainDisk.percentUsed)}" style="width:${mainDisk.percentUsed}%"></div>
          </div>
          <div class="eval-meter-stats">
            <span>Principal ${mainDisk.drive} (${mainDisk.percentUsed}% uso)</span>
            <span>Libre: ${mainDiskFree} GB / ${mainDiskTotal} GB</span>
          </div>
        </div>
        <div class="eval-recommendation ${fullDisk ? 'warn' : ''}">${diskRec}</div>
      </div>
    `;

    // Card GPU
    const mainGpu = gpus[0] || { model: 'GPU Principal', driverStatus: 'ok', temperature: null };
    compGrid.innerHTML += `
      <div class="eval-card">
        <div class="eval-card-header">
          <div>
            <div class="eval-card-title">🎮 Tarjeta Gráfica</div>
            <div class="eval-card-subname">${mainGpu.model || 'GPU del Sistema'}</div>
          </div>
          <span class="eval-badge ${(hotGpu || warnGpu) ? 'warn' : 'ok'}">${gpuBadge}</span>
        </div>
        <div class="eval-meter-wrap">
          <div class="eval-meter-stats">
            <span>Temperatura: ${mainGpu.temperature != null ? mainGpu.temperature + ' °C' : 'N/D'}</span>
            <span>Driver: ${mainGpu.driverStatus === 'ok' ? 'Estable' : 'Revisar'}</span>
          </div>
        </div>
        <div class="eval-recommendation ${(hotGpu || warnGpu) ? 'warn' : ''}">${gpuRec}</div>
      </div>
    `;

    resultsEl.appendChild(compGrid);

    addSectionTitle('Acciones de Mantenimiento y Ampliación Recomendadas');
    const recsList = [
      { pr: ramNeedUpgrade ? 'error' : 'ok', msg: ramRec },
      { pr: fullDisk ? 'error' : 'ok', msg: diskRec },
      { pr: (hotGpu || warnGpu) ? 'warn' : 'ok', msg: gpuRec },
      { pr: cpuHigh ? 'warn' : 'ok', msg: cpuRec },
    ];

    recsList.forEach(r => {
      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = `<span class="result-icon">${ICONS[r.pr]}</span><span class="result-value">${r.msg}</span>`;
      resultsEl.appendChild(row);
    });

    statusText.textContent = '✔ Operación completada correctamente';
  } catch (e) {
    statusText.textContent = `❌ Error durante la operación: ${e.message}`;
  } finally {
    setBusy(false);
  }
});
