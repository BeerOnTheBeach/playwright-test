#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const PLAYWRIGHT_REPORT_DIR = path.join(ROOT_DIR, 'playwright-report');
const JUNIT_FILE = path.join(ROOT_DIR, 'test-results', 'junit.xml');
const PUBLIC_REPORTS_DIR = path.join(ROOT_DIR, 'public', 'reports');
const RETENTION_DAYS = 30;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTimestampUTC(date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join('-') + '_' + [pad(date.getUTCHours()), pad(date.getUTCMinutes())].join('-');
}

function parseTimestampDirName(name) {
  const match = name.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
}

function getStatusFromJUnit(junitPath) {
  if (!fs.existsSync(junitPath)) {
    return 'FAILED';
  }

  const xml = fs.readFileSync(junitPath, 'utf8');

  const testsuitesTag = xml.match(/<testsuites\b[^>]*>/i);
  if (testsuitesTag) {
    const failures = Number((testsuitesTag[0].match(/\bfailures="(\d+)"/i) || [])[1] || 0);
    const errors = Number((testsuitesTag[0].match(/\berrors="(\d+)"/i) || [])[1] || 0);
    return failures + errors > 0 ? 'FAILED' : 'PASSED';
  }

  const testsuiteTags = [...xml.matchAll(/<testsuite\b[^>]*>/gi)];
  let failureCount = 0;
  let errorCount = 0;

  for (const suite of testsuiteTags) {
    const tag = suite[0];
    failureCount += Number((tag.match(/\bfailures="(\d+)"/i) || [])[1] || 0);
    errorCount += Number((tag.match(/\berrors="(\d+)"/i) || [])[1] || 0);
  }

  return failureCount + errorCount > 0 ? 'FAILED' : 'PASSED';
}

function cleanupOldReports(baseDir, retentionDays) {
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

  if (!fs.existsSync(baseDir)) {
    return;
  }

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const reportDate = parseTimestampDirName(entry.name);
    if (!reportDate) {
      continue;
    }

    if (now - reportDate.getTime() > maxAgeMs) {
      fs.rmSync(path.join(baseDir, entry.name), { recursive: true, force: true });
    }
  }
}

function writeIndex(baseDir) {
  const entries = fs.existsSync(baseDir)
    ? fs.readdirSync(baseDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];

  const reports = entries
    .map((entry) => {
      const metaPath = path.join(baseDir, entry.name, 'meta.json');
      let status = 'UNKNOWN';
      let commit = '';
      let runId = '';

      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          status = meta.status || 'UNKNOWN';
          commit = meta.commitSha || '';
          runId = meta.runId || '';
        } catch {
          status = 'UNKNOWN';
        }
      }

      return {
        timestamp: entry.name,
        status,
        commit,
        runId
      };
    })
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const rows = reports
    .map((report) => {
      const statusClass = report.status === 'PASSED' ? 'passed' : report.status === 'FAILED' ? 'failed' : 'unknown';
      const commitText = report.commit ? `<code>${report.commit.slice(0, 12)}</code>` : '<span class="muted">-</span>';
      const runText = report.runId ? `<code>${report.runId}</code>` : '<span class="muted">-</span>';
      return `<tr>
        <td><a href="./${report.timestamp}/index.html">${report.timestamp}</a></td>
        <td><span class="status ${statusClass}">${report.status}</span></td>
        <td>${commitText}</td>
        <td>${runText}</td>
      </tr>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Playwright Reports</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: Arial, sans-serif; margin: 2rem; }
    table { border-collapse: collapse; width: 100%; max-width: 960px; }
    th, td { padding: 0.6rem 0.8rem; border-bottom: 1px solid #ccc; text-align: left; }
    .status { font-weight: 700; padding: 0.2rem 0.45rem; border-radius: 999px; display: inline-block; }
    .passed { background: #d4edda; color: #155724; }
    .failed { background: #f8d7da; color: #721c24; }
    .unknown { background: #e2e3e5; color: #383d41; }
    .muted { color: #666; }
  </style>
</head>
<body>
  <h1>Playwright Reports</h1>
  <p>Stored reports for the last ${RETENTION_DAYS} days.</p>
  <table>
    <thead>
      <tr>
        <th>Timestamp (UTC)</th>
        <th>Status</th>
        <th>Commit</th>
        <th>Run ID</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4" class="muted">No reports yet.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(path.join(baseDir, 'index.html'), html, 'utf8');
}

function main() {
  if (!fs.existsSync(PLAYWRIGHT_REPORT_DIR)) {
    throw new Error(`Missing playwright report at ${PLAYWRIGHT_REPORT_DIR}. Run tests first.`);
  }

  const timestamp = formatTimestampUTC(new Date());
  const status = getStatusFromJUnit(JUNIT_FILE);
  const targetDir = path.join(PUBLIC_REPORTS_DIR, timestamp);

  fs.mkdirSync(PUBLIC_REPORTS_DIR, { recursive: true });
  fs.cpSync(PLAYWRIGHT_REPORT_DIR, targetDir, { recursive: true });

  const meta = {
    timestamp,
    commitSha: process.env.GITHUB_SHA || '',
    runId: process.env.GITHUB_RUN_ID || '',
    status
  };

  fs.writeFileSync(path.join(targetDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  cleanupOldReports(PUBLIC_REPORTS_DIR, RETENTION_DAYS);
  writeIndex(PUBLIC_REPORTS_DIR);

  console.log(`Published report: ${targetDir}`);
  console.log(`Status: ${status}`);
}

main();

