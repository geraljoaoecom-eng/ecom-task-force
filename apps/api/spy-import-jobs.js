const { randomUUID } = require('crypto');
const { pool } = require('./db');
const { getDiscovery, markDiscoveryImported, getSpySession } = require('./spy-db');
const { onDiscoveryImported } = require('./spy-import-feedback');
const { buildImportDraft } = require('./spy-taxonomy');
const { createLibraryFromAnalysis } = require('./library-analyzer-service');
const { recordImportedFromDiscovery } = require('./spy-page-intel');
const { updateSingleLibrary } = require('./library-scraper-service');
const {
  findExistingLibrary,
  resolveCanonicalSourceValue,
  LIBRARY_DUPLICATE_MESSAGE,
} = require('./library-source-key');
const { ensureFilterOptionsFromDraft } = require('./filter-helpers');
const { countryLabelFromCode } = require('./meta-ads-library-options');

const jobs = new Map();
const JOB_TTL_MS = 60 * 60 * 1000;

function pruneJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

function getImportJob(jobId, userId) {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) return null;
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    done: job.done,
    results: job.results,
    error: job.error || null,
  };
}

async function importOneDiscovery(discoveryId, userId) {
  const discovery = await getDiscovery(discoveryId, userId);
  if (!discovery) return { id: discoveryId, success: false, error: 'Não encontrado' };
  if (discovery.alreadyImported) {
    return { id: discoveryId, success: false, error: 'Já importado', alreadyImported: true };
  }

  const session = await getSpySession(discovery.sessionId, userId);
  if (!session) return { id: discoveryId, success: false, error: 'Pesquisa não encontrada' };

  const draft = buildImportDraft(discovery, session);
  if (session.country && !draft.paises) {
    draft.paises = countryLabelFromCode(session.country);
  }
  await ensureFilterOptionsFromDraft(draft).catch((err) =>
    console.warn('⚠️ filter_options:', err.message)
  );
  const hints = { country: session.country, paises: draft.paises };
  const { canonical } = resolveCanonicalSourceValue(draft.sourceValue, hints);
  if (canonical) draft.sourceValue = canonical;

  const existing = await findExistingLibrary(pool, draft.sourceValue, hints);
  if (existing) {
    await markDiscoveryImported(discoveryId, existing.library.id);
    return {
      id: discoveryId,
      success: false,
      duplicate: true,
      error: `${LIBRARY_DUPLICATE_MESSAGE}: «${existing.library.name}»`,
      libraryId: existing.library.id,
      name: existing.library.name,
    };
  }

  let library;
  try {
    library = await createLibraryFromAnalysis(userId, draft, null);
  } catch (err) {
    if (err.code === 'LIBRARY_DUPLICATE') {
      const libId = err.existingLibraryId;
      if (libId) await markDiscoveryImported(discoveryId, libId);
      return {
        id: discoveryId,
        success: false,
        duplicate: true,
        error: err.message || LIBRARY_DUPLICATE_MESSAGE,
        libraryId: libId,
        name: err.existingLibraryName,
      };
    }
    throw err;
  }
  updateSingleLibrary(library.id).catch(() => {});
  await markDiscoveryImported(discoveryId, library.id);
  await recordImportedFromDiscovery(discoveryId, library.id).catch((err) =>
    console.warn(`⚠️ spy_page_intel discovery ${discoveryId}:`, err.message)
  );

  const { enqueueLibraryCopyScan } = require('./copy-library-scanner');
  enqueueLibraryCopyScan(library.id);

  // Feedback de aprendizagem — boost da keyword + extracção de novas keywords via Gemini.
  // Corre em background (não bloqueia nem falha o import se houver erro).
  setImmediate(() => onDiscoveryImported(discovery, session).catch(() => {}));

  return {
    id: discoveryId,
    success: true,
    libraryId: library.id,
    name: library.name,
  };
}

function startImportJob(discoveryIds, userId) {
  pruneJobs();
  const jobId = randomUUID();
  const uniqueIds = [...new Set(discoveryIds.filter(Boolean))];
  const job = {
    id: jobId,
    userId,
    total: uniqueIds.length,
    done: 0,
    status: 'running',
    results: [],
    createdAt: Date.now(),
    error: null,
  };
  jobs.set(jobId, job);

  setImmediate(async () => {
    try {
      for (const id of uniqueIds) {
        try {
          const result = await importOneDiscovery(id, userId);
          job.results.push(result);
        } catch (err) {
          job.results.push({ id, success: false, error: err.message || 'Erro na importação' });
        }
        job.done += 1;
      }
      job.status = 'completed';
    } catch (err) {
      job.status = 'failed';
      job.error = err.message || 'Erro no job de importação';
    }
  });

  return { jobId, total: uniqueIds.length };
}

module.exports = {
  startImportJob,
  getImportJob,
  importOneDiscovery,
};
