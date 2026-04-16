/* app.js – Playwright Reports index page */
(function () {
  'use strict';

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
    return new Date(iso).toLocaleString('de-DE', {
      year:   'numeric', month:  '2-digit', day: '2-digit',
      hour:   '2-digit', minute: '2-digit',
      hour12: false,
    });
  }

  async function loadReports() {
    const subtitle = document.getElementById('subtitle');
    const table    = document.getElementById('reports-table');
    const tbody    = document.getElementById('reports-body');

    try {
      const res = await fetch('reports.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reports = await res.json();

      if (!reports.length) {
        subtitle.textContent = 'No reports yet.';
        return;
      }

      subtitle.textContent = `${reports.length} run${reports.length !== 1 ? 's' : ''}`;

      for (const r of reports) {
        const passed = (r.total || 0) - (r.failed || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge badge-${r.status}">${r.status}</span></td>
          <td title="${formatDate(r.timestamp)}">${relativeTime(r.timestamp)}</td>
          <td>${passed}/${r.total || 0}${r.failed ? ` (${r.failed} failed)` : ''}</td>
          <td>${r.runUrl
            ? `<a href="${r.runUrl}">${r.sha}</a>`
            : (r.sha || '–')}</td>
          <td><a href="${r.reportUrl}">View</a></td>`;
        tbody.appendChild(tr);
      }

      table.hidden = false;
    } catch (e) {
      subtitle.textContent = `Failed to load reports: ${e.message}`;
    }
  }

  loadReports();
})();
