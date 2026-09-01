#!/usr/bin/env node
/**
 * Migração única: normaliza source_value para URLs por view_all_page_id.
 * Uso: node scripts/normalize-library-urls.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../env-config') });
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { pool } = require('../apps/api/db');
const { buildPageLibraryUrl, extractPageIdFromUrl } = require('../apps/api/spy-url-builder');
const { launchBrowser, getPage, closeBrowser } = require('../apps/api/browser-manager');

function extractPageIdFromString(value) {
  if (!value) return null;

  const direct =
    value.match(/view_all_page_id=(\d+)/i)?.[1] ||
    value.match(/[?&]page_id=(\d+)/i)?.[1];
  if (direct) return direct;

  try {
    const fromUrl = extractPageIdFromUrl(value);
    if (fromUrl) return fromUrl;
  } catch {
    // ignore
  }

  const jsonMatch = value.match(/"page_id"\s*:\s*"?(\d+)"?/i);
  if (jsonMatch) return jsonMatch[1];

  return null;
}

async function fetchPageIdFromUrl(url) {
  let browser;
  try {
    browser = await launchBrowser({ useProxy: false });
    const page = await getPage(browser, { locale: 'pt-BR,pt;q=0.9' });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 3000));
    const html = await page.content();
    const currentUrl = page.url();

    return (
      extractPageIdFromUrl(currentUrl) ||
      html.match(/view_all_page_id=(\d+)/)?.[1] ||
      html.match(/"page_id"\s*:\s*"?(\d+)"?/)?.[1] ||
      null
    );
  } catch (err) {
    console.warn(`   ⚠️ Fetch falhou: ${err.message}`);
    return null;
  } finally {
    if (browser) await closeBrowser(browser);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔧 Normalização de URLs de bibliotecas');
  console.log('═══════════════════════════════════════════════════════\n');

  const { rows } = await pool.query(
    `SELECT id, name, source_value FROM libraries ORDER BY name`
  );

  let normalized = 0;
  let alreadyOk = 0;
  let failed = 0;

  for (const lib of rows) {
    const current = lib.source_value || '';

    if (/view_all_page_id=\d+/i.test(current)) {
      const pageId = extractPageIdFromString(current);
      const cleanUrl = buildPageLibraryUrl(pageId);
      if (current !== cleanUrl) {
        await pool.query('UPDATE libraries SET source_value = $1, updated_at = NOW() WHERE id = $2', [
          cleanUrl,
          lib.id,
        ]);
        console.log(`🔄 ${lib.name}: URL limpa → ${cleanUrl}`);
        normalized++;
      } else {
        alreadyOk++;
      }
      continue;
    }

    console.log(`\n🔍 ${lib.name}`);
    console.log(`   URL actual: ${current.slice(0, 120)}${current.length > 120 ? '...' : ''}`);

    let pageId = extractPageIdFromString(current);

    if (!pageId && current.startsWith('http')) {
      console.log('   A tentar fetch para extrair page_id...');
      pageId = await fetchPageIdFromUrl(current);
    }

    if (pageId) {
      const cleanUrl = buildPageLibraryUrl(pageId);
      await pool.query('UPDATE libraries SET source_value = $1, updated_at = NOW() WHERE id = $2', [
        cleanUrl,
        lib.id,
      ]);
      console.log(`   ✅ Normalizada → page_id=${pageId}`);
      normalized++;
    } else {
      console.log('   ❌ Não normalizável — page_id não encontrado');
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RELATÓRIO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total:              ${rows.length}`);
  console.log(`Já OK / limpas:     ${alreadyOk}`);
  console.log(`Normalizadas:       ${normalized}`);
  console.log(`Não normalizáveis:  ${failed}`);
  console.log('═══════════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch(async (err) => {
  console.error('❌ Erro:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
