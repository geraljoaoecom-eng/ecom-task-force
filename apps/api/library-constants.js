const {
  LIBRARY_DUPLICATE_MESSAGE,
  findExistingLibrary,
  resolveCanonicalSourceValue,
} = require('./library-source-key');

async function findLibraryBySourceValue(pool, sourceValue, hints = {}) {
  const hit = await findExistingLibrary(pool, sourceValue, hints);
  return hit?.library || null;
}

async function assertLibrarySourceIsUnique(pool, sourceValue, hints = {}) {
  const hit = await findExistingLibrary(pool, sourceValue, hints);
  if (hit) {
    const error = new Error(`${LIBRARY_DUPLICATE_MESSAGE}: «${hit.library.name}»`);
    error.code = 'LIBRARY_DUPLICATE';
    error.existingLibraryId = hit.library.id;
    error.existingLibraryName = hit.library.name;
    throw error;
  }
}

module.exports = {
  LIBRARY_DUPLICATE_MESSAGE,
  findLibraryBySourceValue,
  assertLibrarySourceIsUnique,
  resolveCanonicalSourceValue,
};
