#!/usr/bin/env node
/**
 * publish-report.js
 *
 * Copies the latest Playwright HTML report into the `public/` directory
 * (which the CI workflow checks out from gh-pages) and updates the rolling
 * reports.json manifest (last MAX_REPORTS entries).
 *
 * The GitHub Actions workflow then uses actions/upload-pages-artifact +
 * actions/deploy-pages to publish the result.
 *
 * Environment variables (set automatically by the workflow):
 *   GITHUB_REPOSITORY – e.g. "owner/repo"
 *   GITHUB_SHA        – commit SHA of the triggering run
 *   GITHUB_RUN_ID     – Actions run ID
 *
 * Optional:
 *   REPORT_DIR   – path to the playwright HTML report (default: playwright-report)
 *   JUNIT_FILE   – path to the JUnit XML file         (default: test-results/junit.xml)
 *   PUBLIC_DIR   – output directory                   (default: public)
 *   MAX_REPORTS  – how many reports to keep           (default: 30)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

const REPORT_DIR  = process.env.REPORT_DIR  || 'playwright-report';
const JUNIT_FILE  = process.env.JUNIT_FILE  || 'test-results/junit.xml';
const PUBLIC_DIR  = process.env.PUBLIC_DIR  || 'public';
const MAX_REPORTS = parseInt(process.env.MAX_REPORTS || '30', 10);

const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '';
const GITHUB_SHA        = process.env.GITHUB_SHA        || 'local';
const GITHUB_RUN_ID     = process.env.GITHUB_RUN_ID     || '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a JUnit XML and return { total, failed } */
function parseJunit(file) {
  if (!fs.existsSync(file)) {
    console.warn(`⚠️  JUnit file not found: ${file} – assuming all passed.`);
    return { total: 0, failed: 0 };
  }
  const xml      = fs.readFileSync(file, 'utf8');
  const total    = parseInt((xml.match(/tests="(\d+)"/)    || [0, '0'])[1], 10);
  const failures = parseInt((xml.match(/failures="(\d+)"/) || [0, '0'])[1], 10);
  const errors   = parseInt((xml.match(/errors="(\d+)"/)   || [0, '0'])[1], 10);
  return { total, failed: failures + errors };
}

/** Copy a directory recursively */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

(function main() {
  // 1. Determine pass / fail from JUnit output
  const { total, failed } = parseJunit(JUNIT_FILE);
  const status    = failed > 0 ? 'failed' : 'success';
  const timestamp = new Date().toISOString();

  // slug: e.g. 2024-01-15_12-30-00
  const slug       = timestamp.replace(/\.\d+Z$/, 'Z').replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const reportSlug = `reports/${slug}`;

  console.log(`\n📋  Run summary: ${total} tests, ${failed} failed → ${status}`);
  console.log(`📁  Report slug: ${reportSlug}`);

  // 2. Ensure public/ exists (CI checks it out; locally it may not)
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  // 3. Copy playwright HTML report into timestamped subfolder
  if (!fs.existsSync(REPORT_DIR)) {
    console.error(`❌  Report directory "${REPORT_DIR}" not found. Did the tests run?`);
    process.exit(1);
  }
  const reportDest = path.join(PUBLIC_DIR, reportSlug);
  console.log(`\n📂  Copying "${REPORT_DIR}" → "${reportDest}"…`);
  copyDir(REPORT_DIR, reportDest);

  // 4. Update rolling reports.json manifest
  const manifestPath = path.join(PUBLIC_DIR, 'reports.json');
  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { manifest = []; }
  }

  const runUrl = GITHUB_RUN_ID && GITHUB_REPOSITORY
    ? `https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : '';

  manifest.unshift({
    slug:      reportSlug,
    timestamp,
    status,
    total,
    failed,
    sha:       GITHUB_SHA.slice(0, 7),
    runUrl,
    reportUrl: `${reportSlug}/index.html`,
  });

  // Evict oldest entries beyond MAX_REPORTS and remove their folders
  if (manifest.length > MAX_REPORTS) {
    const removed = manifest.splice(MAX_REPORTS);
    for (const old of removed) {
      const oldDir = path.join(PUBLIC_DIR, old.slug);
      if (fs.existsSync(oldDir)) {
        fs.rmSync(oldDir, { recursive: true, force: true });
        console.log(`🗑   Removed old report: ${old.slug}`);
      }
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅  reports.json updated (${manifest.length} entries).`);

  // 5. Copy static page assets (index.html, app.js, style.css) from scripts dir
  const assetsDir = __dirname;
  for (const asset of ['index.html', 'app.js', 'style.css']) {
    const src  = path.join(assetsDir, asset);
    const dest = path.join(PUBLIC_DIR, asset);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`📄  Copied ${asset}`);
    } else {
      console.warn(`⚠️   Asset not found, skipping: ${src}`);
    }
  }

  console.log('\n🚀  public/ is ready for deployment.');
})();
