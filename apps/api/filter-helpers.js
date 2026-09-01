const { pool } = require('./db');

async function ensureFilterOption(type, value) {
  const v = String(value || '').trim();
  if (!v || v === '—') return;
  await pool.query(
    `INSERT INTO filter_options (type, value) VALUES ($1, $2)
     ON CONFLICT (type, value) DO NOTHING`,
    [type, v]
  );
}

async function ensureFilterOptionsFromDraft(draft = {}) {
  const tasks = [];
  const nicho = (draft.nichos || draft.nicho || '').split(/[,;|]/)[0]?.trim();
  const produto = (draft.produtos || draft.produto || '').split(/[,;|]/)[0]?.trim();
  const idioma = (draft.idiomas || draft.language || '').split(/[,;|]/)[0]?.trim();
  const pais = (draft.paises || draft.country || '').split(/[,;|]/)[0]?.trim();

  if (nicho) tasks.push(ensureFilterOption('nichos', nicho.toUpperCase()));
  if (produto) tasks.push(ensureFilterOption('produtos', produto));
  if (idioma) tasks.push(ensureFilterOption('idiomas', idioma));
  if (pais) tasks.push(ensureFilterOption('paises', pais));

  await Promise.all(tasks);
}

module.exports = { ensureFilterOption, ensureFilterOptionsFromDraft };
