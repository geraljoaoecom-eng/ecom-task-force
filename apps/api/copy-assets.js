const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getAssetsRoot() {
  const root =
    process.env.COPY_ASSETS_DIR ||
    path.join(__dirname, '../../data/copy-assets');
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

function extensionFromUrl(url, contentType) {
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('gif')) return '.gif';
  try {
    const ext = path.extname(new URL(url).pathname);
    if (ext && ext.length <= 5) return ext;
  } catch {
    // ignore
  }
  return '.jpg';
}

/**
 * Descarrega imagem do criativo para disco.
 * @returns {Promise<string|null>} path relativo a COPY_ASSETS_DIR ou null
 */
async function downloadCopyImage(imageUrl, { libraryId, metaAdId } = {}) {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return null;

  const libDir = path.join(getAssetsRoot(), String(libraryId || 'unknown').replace(/\W/g, ''));
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });

  const safeId = String(metaAdId || crypto.randomBytes(6).toString('hex')).replace(/\W/g, '');

  try {
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(45000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ECOMTaskForce/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return null;

    const ext = extensionFromUrl(imageUrl, res.headers.get('content-type'));
    const filename = `${safeId}${ext}`;
    const fullPath = path.join(libDir, filename);
    fs.writeFileSync(fullPath, buf);

    return path.relative(getAssetsRoot(), fullPath).replace(/\\/g, '/');
  } catch (err) {
    console.warn(`   ⚠️ Copy image download: ${err.message}`);
    return null;
  }
}

function resolveAssetPath(relativePath) {
  if (!relativePath) return null;
  return path.join(getAssetsRoot(), relativePath);
}

module.exports = {
  getAssetsRoot,
  downloadCopyImage,
  resolveAssetPath,
};
