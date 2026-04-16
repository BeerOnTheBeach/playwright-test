/* app.js – Playwright Reports index page */
(function () {
  'use strict';

  const ICONS = {
    success: `<svg viewBox="0 0 16 16"><path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>`,
    failed:  `<svg viewBox="0 0 16 16"><path fill-rule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>`,
    link:    `<svg viewBox="0 0 16 16"><path fill-rule="evenodd" d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 012.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"/></svg>`,
  };

  /** Format an ISO timestamp as a friendly relative string */
  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs  < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  /** Format an ISO timestamp as a readable date/time string */
  function formatDate(iso) {
    return new Date(iso).toLocaleString(undefined, {
      year:   'numeric', month:  'short', day: 'numeric',
      hour:   '2-digit', minute: '2-digit',
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildRow(report) {
    const isSuccess = report.status === 'success';
    const passed    = (report.total || 0) - (report.failed || 0);

    const statusBadge = `
      <span class="badge badge-${isSuccess ? 'success' : 'failed'}">
        ${isSuccess ? ICONS.success : ICONS.failed}
        ${isSuccess ? 'Passed' : 'Failed'}
      </span>`;

    const timestamp = `
      <span class="ts-relative">${relativeTime(report.timestamp)}</span>
      <span class="ts-absolute">${formatDate(report.timestamp)}</span>`;

    const results = `
      <span class="results">
        <span class="pass-count">${passed}</span>
        <span> / </span>
        <span>${report.total || 0}</span>
        ${report.failed > 0 ? `<span> &nbsp;<span class="fail-count">${report.failed} failed</span></span>` : ''}
      </span>`;

    const shaCell = report.sha
      ? (report.runUrl
          ? `<a class="sha-link" href="${escapeHtml(report.runUrl)}" target="_blank" rel="noopener">${escapeHtml(report.sha)}</a>`
          : `<span class="sha-link">${escapeHtml(report.sha)}</span>`)
      : '–';

    const reportBtn = `
      <a class="btn-report" href="${escapeHtml(report.reportUrl)}" target="_blank" rel="noopener">
        ${ICONS.link} View report
      </a>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${statusBadge}</td>
      <td>${timestamp}</td>
      <td>${results}</td>
      <td>${shaCell}</td>
      <td>${reportBtn}</td>`;
    return tr;
  }

  async function loadReports() {
    const errorEl   = document.getElementById('error');
    const tableEl   = document.getElementById('reports-table');
    const bodyEl    = document.getElementById('reports-body');
    const emptyEl   = document.getElementById('empty-msg');
    const countEl   = document.getElementById('report-count');

    try {
      const res = await fetch('reports.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const reports = await res.json();
      if (!reports || reports.length === 0) {
        emptyEl.hidden = false;
        return;
      }

      countEl.textContent = reports.length;
      for (const report of reports) {
        bodyEl.appendChild(buildRow(report));
      }

      tableEl.hidden = false;
    } catch (err) {
      errorEl.hidden   = false;
      errorEl.textContent = `Failed to load reports: ${err.message}`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadReports);
  } else {
    loadReports();
  }
})();

