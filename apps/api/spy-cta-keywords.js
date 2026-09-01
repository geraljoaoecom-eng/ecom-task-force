/**
 * CTA Hunt — keywords de chamada-à-acção por tipo de funil e idioma.
 * Usadas como `q=` na Meta Ads Library, somando-se às keywords manuais/GPT.
 *
 * Tipos: universal | quiz | test | plano | resultado | elegib | perfil |
 *        diagnostico | recomend | perguntas | calc | vsl | lead | venda | sorteio
 *
 * Entradas com generic:true → mais cobertura, mais lixo possível.
 * O motor usa prioridade mais baixa para frases genéricas.
 *
 * PRIORIDADES:
 *   universal  → prioridade ALTA  (padrões de copy DR reais, sem nicho)
 *   específico → prioridade normal
 *   generic:true → prioridade BAIXA (-10)
 *   literal quiz/test → generic:true (prioridade baixa)
 */

// ---------------------------------------------------------------------------
// PORTUGUÊS
// ---------------------------------------------------------------------------
const PT = {
  // ---------------------------------------------------------------------------
  // UNIVERSAL DR PATTERNS — frases que aparecem na copy real dos anúncios.
  // Funcionam sem nicho: apanham emagrecimento, finanças, saúde, apps, etc.
  // ---------------------------------------------------------------------------
  universal: [
    'porque não consegues',
    'por que você não consegue',
    'descobre porque',
    'descubra por que',
    'descobre o que',
    'descubra o que',
    'responde a estas perguntas',
    'responda estas perguntas',
    'com base nas tuas respostas',
    'com base nas suas respostas',
    'obtém o teu plano personalizado',
    'obtenha seu plano personalizado',
    'vê os teus resultados',
    'veja seus resultados',
    'descobre os teus resultados',
    'descubra seus resultados',
    'calcula o teu',
    'calcule seu',
    'vê se qualificas',
    'veja se você se qualifica',
    'plano personalizado',
    'resultado personalizado',
  ],
  quiz: [
    { phrase: 'faz o quiz',                    generic: true },
    { phrase: 'faça o quiz',                   generic: true },
    { phrase: 'começa o quiz',                 generic: true },
    { phrase: 'responde ao quiz',              generic: true },
    { phrase: 'responda ao quiz',              generic: true },
    { phrase: 'faz o teste',                   generic: true },
    { phrase: 'faça o teste',                  generic: true },
    { phrase: 'responde ao teste',             generic: true },
    { phrase: 'teste agora',                   generic: true },
    { phrase: 'testa os teus conhecimentos',   generic: true },
  ],
  test: [
    'diagnóstico gratuito',
    'avaliação gratuita',
    'avaliação personalizada',
    'análise gratuita',
    'análise personalizada',
    'descobre o teu perfil',
    'descubra seu perfil',
    'descobre o teu tipo',
    'faz o diagnóstico',
    'faça o diagnóstico',
  ],
  plano: [
    'recebe o teu plano',
    'receba seu plano',
    'plano personalizado',
    'obtém o teu plano',
    'cria o teu plano',
    'plano gratuito',
    'descobre o teu plano',
    'plano feito para ti',
    'plano à medida',
    { phrase: 'plano para ti', generic: true },
  ],
  resultado: [
    'descobre o teu resultado',
    'descubra seu resultado',
    'vê os teus resultados',
    'veja seus resultados',
    'resultado em segundos',
    'descobre a tua pontuação',
    'vê a tua pontuação',
    { phrase: 'score personalizado', generic: true },
  ],
  elegib: [
    'vê se és elegível',
    'veja se você se qualifica',
    'verifica se tens direito',
    'descobre se qualificas',
    'verifica a tua elegibilidade',
    'verifica se és candidato',
    'vê se te qualificas',
  ],
  perfil: [
    'qual é o teu tipo',
    'qual é o seu perfil',
    'encontra o teu perfil',
    'descobre qual é o teu',
    'identifica o teu perfil',
  ],
  diagnostico: [
    'descobre o teu problema',
    'identifica a tua causa',
    'analisa o teu caso',
    { phrase: 'descobre o porquê', generic: true },
  ],
  recomend: [
    'recebe recomendações',
    'receba recomendações',
    'recomendações personalizadas',
    'descobre o que precisas',
    'vê o que é ideal para ti',
    'solução personalizada',
    'descobre a tua solução',
  ],
  perguntas: [
    'responde a estas perguntas',
    'responda a estas perguntas',
    'responde a 3 perguntas',
    'responda a 5 perguntas',
    'só te demora 1 minuto',
    'leva menos de 2 minutos',
    { phrase: 'responde agora',    generic: true },
    { phrase: 'perguntas rápidas', generic: true },
  ],
  calc: [
    'calculadora gratuita',
    'calcula agora',
    'estima o teu resultado',
    'quanto podes perder',
    'calcula o teu plano',
    'estimativa gratuita',
    'descobre quanto',
    { phrase: 'simula agora', generic: true },
  ],
  vsl: [
    'assista ao vídeo',
    'veja a apresentação',
    'assista até ao fim',
    'veja como',
    'assiste ao vídeo',
    'vê o vídeo completo',
  ],
  lead: [
    'garanta a sua vaga',
    'inscreva-se grátis',
    'baixe o ebook',
    'receba grátis',
    'inscreve-te grátis',
    'download gratuito',
    'acesso gratuito',
  ],
  venda: [
    'compre agora',
    'aproveite o desconto',
    'última chance',
    'garanta o seu',
    'compra agora',
    'oferta por tempo limitado',
  ],
  sorteio: [
    'participe agora',
    'concorra a',
    'inscreva-se no sorteio',
    'participa agora',
    { phrase: 'ganhe agora', generic: true },
  ],
};

// ---------------------------------------------------------------------------
// ESPANHOL
// ---------------------------------------------------------------------------
const ES = {
  // ---------------------------------------------------------------------------
  // UNIVERSAL DR PATTERNS — frases de copy DR reais, sem nicho específico.
  // ---------------------------------------------------------------------------
  universal: [
    'por qué no consigues',
    'por qué te cuesta',
    'descubre por qué',
    'descubre qué',
    'averigua por qué',
    'averigua si',
    'responde estas preguntas',
    'responde unas preguntas',
    'según tus respuestas',
    'basado en tus respuestas',
    'obtén tu plan personalizado',
    'consigue tu plan personalizado',
    'mira tus resultados',
    've tus resultados',
    'descubre tus resultados',
    'calcula tu',
    'comprueba si calificas',
    'averigua si calificas',
    'descubre si calificas',
    'plan personalizado',
    'resultado personalizado',
  ],
  quiz: [
    { phrase: 'haz el quiz',              generic: true },
    { phrase: 'toma el quiz',             generic: true },
    { phrase: 'empieza el quiz',          generic: true },
    { phrase: 'responde el quiz',         generic: true },
    { phrase: 'haz el test',              generic: true },
    { phrase: 'responde el test',         generic: true },
    { phrase: 'toma el test',             generic: true },
    { phrase: 'empieza el test',          generic: true },
    { phrase: 'haz la prueba',            generic: true },
    { phrase: 'prueba gratis',            generic: true },
    { phrase: 'responde estas preguntas', generic: true },
    { phrase: 'prueba ahora',             generic: true },
  ],
  test: [
    'diagnóstico gratuito',
    'evaluación gratuita',
    'análisis gratuito',
    'test gratuito',
    'evaluación personalizada',
    'descubre tu tipo',
    'descubre tu perfil',
    'haz el diagnóstico',
  ],
  plano: [
    'obtén tu plan',
    'obtén tu plan personalizado',
    'crea tu plan',
    'plan gratuito',
    'descubre tu plan',
    'plan hecho para ti',
    'plan personalizado',
    'consigue tu plan',
    'recibe tu plan',
    { phrase: 'plan para ti', generic: true },
  ],
  resultado: [
    'descubre tu resultado',
    've tus resultados',
    'resultado en segundos',
    'descubre tu puntuación',
    've tu puntuación',
    'mira tus resultados',
    'resultados personalizados',
    'cuál es tu resultado',
    'obtén tus resultados',
    { phrase: 'descubre tu score', generic: true },
  ],
  elegib: [
    'comprueba si calificas',
    'mira si eres candidato',
    'verifica si calificas',
    'descubre si eres elegible',
    'comprueba tu elegibilidad',
    'descubre si calificas',
    { phrase: 'ver si califico',     generic: true },
    { phrase: 'descubre si aplicas', generic: true },
  ],
  perfil: [
    'descubre cuál es tu tipo',
    'encuentra tu perfil',
    'identifica tu tipo',
    'cuál es tu tipo',
    'descubre cuál es tu',
    'encuentra tu tipo',
  ],
  diagnostico: [
    'análisis personalizado',
    'descubre tu problema',
    'identifica tu causa',
    'analiza tu caso',
    'diagnóstico en segundos',
    { phrase: 'descubre el porqué', generic: true },
  ],
  recomend: [
    'recibe recomendaciones',
    'recomendaciones personalizadas',
    'descubre qué necesitas',
    'solución personalizada',
    'descubre tu solución',
    've lo que es ideal para ti',
  ],
  perguntas: [
    'responde estas preguntas',
    'responde 3 preguntas',
    'solo toma 1 minuto',
    'menos de 2 minutos',
    'cuestionario rápido',
    { phrase: 'responde ahora',    generic: true },
    { phrase: 'preguntas rápidas', generic: true },
  ],
  calc: [
    'calculadora gratuita',
    'calcula ahora',
    'estima tu resultado',
    'cuánto puedes perder',
    'calcula tu plan',
    'estimación gratuita',
    'descubre cuánto',
    { phrase: 'simula ahora', generic: true },
  ],
  vsl: [
    'mira el video',
    'mira la presentación',
    'mira hasta el final',
    'descubre cómo',
    've el video completo',
  ],
  lead: [
    'reserva tu lugar',
    'regístrate gratis',
    'descarga el ebook',
    'recibe gratis',
    'acceso gratuito',
    'descarga gratuita',
  ],
  venda: [
    'compra ahora',
    'aprovecha el descuento',
    'última oportunidad',
    'consigue el tuyo',
    'oferta por tiempo limitado',
  ],
  sorteio: [
    'participa ahora',
    'gana un',
    'únete al sorteo',
    { phrase: 'gana ahora', generic: true },
  ],
};

// ---------------------------------------------------------------------------
// INGLÊS
// ---------------------------------------------------------------------------
const EN = {
  // ---------------------------------------------------------------------------
  // UNIVERSAL DR PATTERNS — frases de copy DR reais, sem nicho específico.
  // ---------------------------------------------------------------------------
  universal: [
    "why can't you",
    'why do you',
    'why are you',
    "what's causing",
    "what's stopping you",
    'find out why',
    'discover why',
    "discover what's",
    'answer a few questions',
    'answer these questions',
    'based on your answers',
    'get your personalized',
    'get your custom',
    'see your results',
    'get your results',
    'calculate your',
    'check your',
    'find out if',
    'see if you qualify',
    'are you eligible',
    'do you qualify',
    'get your plan',
    'get my plan',
    'personalized plan',
    'custom plan',
  ],
  quiz: [
    { phrase: 'take the quiz',           generic: true },
    { phrase: 'start the quiz',          generic: true },
    { phrase: 'start quiz',              generic: true },
    { phrase: 'take this quiz',          generic: true },
    { phrase: 'answer the quiz',         generic: true },
    { phrase: 'begin the quiz',          generic: true },
    { phrase: 'take this test',          generic: true },
    { phrase: 'start the test',          generic: true },
    { phrase: 'take the 30 second quiz', generic: true },
    { phrase: '30 second quiz',          generic: true },
    { phrase: 'try the quiz',            generic: true },
    { phrase: 'answer these questions',  generic: true },
  ],
  test: [
    'take the assessment',
    'free assessment',
    'free evaluation',
    'free analysis',
    'take the test',
    'free diagnosis',
    'personal evaluation',
    'quick assessment',
    'get a free diagnosis',
  ],
  plano: [
    'get my plan',
    'get your plan',
    'get a personalized plan',
    'build my plan',
    'create my plan',
    'free plan',
    'get your free plan',
    'claim your plan',
    'claim your free plan',
    { phrase: 'plan for you', generic: true },
  ],
  resultado: [
    'see my results',
    'get your results',
    'get personalized results',
    'see your score',
    "what's your score",
    'discover your score',
    'results in seconds',
    'get your personalized results',
    'view your results',
  ],
  elegib: [
    'check eligibility',
    'see if you qualify',
    'check if you qualify',
    'find out if you qualify',
    'see if you are eligible',
    'check your eligibility',
    { phrase: 'am i eligible', generic: true },
    { phrase: 'do i qualify',  generic: true },
  ],
  perfil: [
    'find your type',
    'discover your type',
    'find out your type',
    'what is your type',
    'discover your profile',
    'find your profile',
    'identify your type',
    'find out which type you are',
    'discover what is right for you',
  ],
  diagnostico: [
    'free diagnosis',
    'free analysis',
    'personalized analysis',
    'discover your issue',
    'identify your root cause',
    'find out why',
    'find out now',
    { phrase: 'analyze your case', generic: true },
  ],
  recomend: [
    'get recommendations',
    'get personalized recommendations',
    'find out what you need',
    'personalized solution',
    'discover your solution',
    'get your recommendations',
    'see what works for you',
  ],
  perguntas: [
    'answer these questions',
    'answer 3 questions',
    'takes only 1 minute',
    'less than 2 minutes',
    'just 3 questions',
    { phrase: 'quick questions', generic: true },
    { phrase: 'answer now',      generic: true },
  ],
  calc: [
    'free calculator',
    'calculate now',
    'estimate your results',
    'how much can you lose',
    'calculate your plan',
    'free estimate',
    'find out how much',
    { phrase: 'use the calculator', generic: true },
  ],
  vsl: [
    'watch the video',
    'watch this presentation',
    'watch until the end',
    'see how',
    'watch the full video',
    { phrase: 'get started', generic: true },
    { phrase: 'start now',   generic: true },
  ],
  lead: [
    'claim your spot',
    'sign up free',
    'download the ebook',
    'get it free',
    'free access',
    'free download',
  ],
  venda: [
    'buy now',
    'get the discount',
    'last chance',
    'order yours',
    'limited time offer',
  ],
  sorteio: [
    'enter now',
    'win a',
    'join the giveaway',
    { phrase: 'win now', generic: true },
  ],
};

// ---------------------------------------------------------------------------
// Mapa idioma → bucket (adicionar novos idiomas aqui)
// ---------------------------------------------------------------------------
const LANG_MAP = {
  portugues:  PT,
  espanhol:   ES,
  ingles:     EN,
  pt:         PT,
  es:         ES,
  en:         EN,
  portuguese: PT,
  spanish:    ES,
  english:    EN,
};

const VALID_TYPES = [
  'universal',  // sempre primeiro — padrões de copy DR reais
  'quiz', 'test', 'plano', 'resultado', 'elegib', 'perfil',
  'diagnostico', 'recomend', 'perguntas', 'calc',
  'vsl', 'lead', 'venda', 'sorteio',
];

function normKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function resolveBucket(language) {
  const key = normKey(language);
  if (LANG_MAP[key]) return LANG_MAP[key];
  if (!key || key === 'todos os idiomas') return PT;
  return EN;
}

/**
 * Gera keywords CTA com flag de genericidade.
 * @returns {{ phrase: string, generic: boolean }[]}
 */
function generateCtaKeywordsTagged({ language, types, nicho, max = 60 } = {}) {
  const bucket = resolveBucket(language);
  const wanted = (Array.isArray(types) && types.length ? types : VALID_TYPES)
    .map(normKey);

  const seen = new Set();
  const out = [];
  const nichoStr = nicho ? String(nicho).trim().toLowerCase() : '';

  for (const type of wanted) {
    for (const entry of bucket[type] || []) {
      const phrase  = typeof entry === 'string' ? entry : entry.phrase;
      const generic = typeof entry === 'object' ? !!entry.generic : false;

      const variants = nichoStr
        ? [{ phrase, generic }, { phrase: `${phrase} ${nichoStr}`, generic }]
        : [{ phrase, generic }];

      for (const v of variants) {
        const key = normKey(v.phrase);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(v);
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

/**
 * Versão compatível com código existente — devolve só strings.
 * @returns {string[]}
 */
function generateCtaKeywords({ language, types, nicho, max = 60 } = {}) {
  return generateCtaKeywordsTagged({ language, types, nicho, max }).map((e) => e.phrase);
}

module.exports = {
  CTA_TEMPLATES: { portugues: PT, espanhol: ES, ingles: EN },
  VALID_TYPES,
  generateCtaKeywords,
  generateCtaKeywordsTagged,
};
