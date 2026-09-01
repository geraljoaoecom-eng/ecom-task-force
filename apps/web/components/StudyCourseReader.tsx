'use client'

import Link from 'next/link'
import { ArrowLeft, BookOpen, Clock } from 'lucide-react'
import type { StudyCourseMeta } from '@/lib/study/courses'

const gold = '#F5D26C'
const muted = '#94a3b8'
const text = '#E8EDF2'
const card = '#141823'
const border = 'rgba(245, 210, 108, 0.22)'

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} style={{ scrollMarginTop: '1.5rem', marginBottom: '2.5rem' }}>
      <h2
        style={{
          color: gold,
          fontSize: '1.125rem',
          fontWeight: 700,
          margin: '0 0 1rem',
          paddingBottom: '0.5rem',
          borderBottom: `1px solid ${border}`,
          letterSpacing: '0.02em',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Callout({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'warn' | 'gold' }) {
  const styles =
    variant === 'warn'
      ? { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.35)', color: '#fecaca' }
      : variant === 'gold'
        ? { bg: 'rgba(245, 210, 108, 0.08)', border: 'rgba(245, 210, 108, 0.35)', color: text }
        : { bg: 'rgba(96, 165, 250, 0.08)', border: 'rgba(96, 165, 250, 0.3)', color: '#cbd5e1' }

  return (
    <div
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: '0.75rem',
        padding: '1.125rem 1.25rem',
        marginBottom: '1rem',
        lineHeight: 1.65,
        fontSize: '0.9375rem',
        color: styles.color,
      }}
    >
      {children}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.7, color: text }}>
      {items.map((item) => (
        <li key={item} style={{ marginBottom: '0.35rem' }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

function PrincipleCard({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <div
      style={{
        background: card,
        border: `1px solid ${border}`,
        borderRadius: '0.75rem',
        padding: '1.125rem 1.25rem',
        marginBottom: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
        <span
          style={{
            flexShrink: 0,
            width: '2rem',
            height: '2rem',
            borderRadius: '0.5rem',
            background: 'rgba(245, 210, 108, 0.15)',
            color: gold,
            fontWeight: 800,
            fontSize: '0.9375rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {n}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ color: gold, fontWeight: 700, marginBottom: '0.375rem', fontSize: '0.9375rem' }}>{title}</div>
          <div style={{ color: muted, fontSize: '0.875rem', lineHeight: 1.65 }}>{body}</div>
        </div>
      </div>
    </div>
  )
}

function DayBlock({ day, title, items, note }: { day: string; title: string; items: string[]; note?: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '4.5rem 1fr',
        gap: '1rem',
        marginBottom: '1rem',
        padding: '1rem',
        background: card,
        border: `1px solid ${border}`,
        borderRadius: '0.75rem',
      }}
    >
      <div
        style={{
          color: gold,
          fontWeight: 800,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          paddingTop: '0.125rem',
        }}
      >
        {day}
      </div>
      <div>
        <div style={{ color: text, fontWeight: 600, marginBottom: '0.5rem' }}>{title}</div>
        <BulletList items={items} />
        {note && (
          <p style={{ margin: '0.75rem 0 0', color: gold, fontSize: '0.8125rem', fontStyle: 'italic' }}>{note}</p>
        )}
      </div>
    </div>
  )
}

function BenchmarkRow({ range, label, desc, tone }: { range: string; label: string; desc: string; tone: 'bad' | 'ok' | 'good' }) {
  const colors =
    tone === 'bad'
      ? { dot: '#f87171', bg: 'rgba(239,68,68,0.1)' }
      : tone === 'ok'
        ? { dot: '#fcd34d', bg: 'rgba(245,158,11,0.1)' }
        : { dot: '#4ade80', bg: 'rgba(74,222,128,0.1)' }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(100px, 140px) 1fr',
        gap: '1rem',
        alignItems: 'start',
        padding: '0.875rem 1rem',
        marginBottom: '0.5rem',
        borderRadius: '0.625rem',
        background: colors.bg,
        border: `1px solid ${border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
        <span style={{ color: text, fontWeight: 600, fontSize: '0.875rem' }}>{range}</span>
      </div>
      <div>
        <div style={{ color: gold, fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.25rem' }}>{label}</div>
        <div style={{ color: muted, fontSize: '0.8125rem', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

function PhaseTable({ rows }: { rows: { phase: string; metric: string; goal: string }[] }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${border}` }}>
            <th style={{ textAlign: 'left', padding: '0.625rem', color: muted, fontWeight: 600 }}>Fase</th>
            <th style={{ textAlign: 'left', padding: '0.625rem', color: muted, fontWeight: 600 }}>Métrica</th>
            <th style={{ textAlign: 'left', padding: '0.625rem', color: muted, fontWeight: 600 }}>Objetivo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.phase} style={{ borderBottom: `1px solid rgba(245,210,108,0.08)` }}>
              <td style={{ padding: '0.625rem', color: gold, fontWeight: 600 }}>{r.phase}</td>
              <td style={{ padding: '0.625rem', color: text }}>{r.metric}</td>
              <td style={{ padding: '0.625rem', color: muted }}>{r.goal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', counterReset: 'step' }}>
      {items.map((item, i) => (
        <li
          key={item}
          style={{
            display: 'flex',
            gap: '0.875rem',
            marginBottom: '0.625rem',
            alignItems: 'flex-start',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '999px',
              background: 'rgba(245, 210, 108, 0.12)',
              color: gold,
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i + 1}
          </span>
          <span style={{ color: text, fontSize: '0.9375rem', lineHeight: 1.55, paddingTop: '0.125rem' }}>{item}</span>
        </li>
      ))}
    </ol>
  )
}

const TOC = [
  { id: 'filosofia', label: 'Filosofia principal' },
  { id: 'principios', label: '3 princípios' },
  { id: 'equacao', label: 'Equação da oferta' },
  { id: 'metricas', label: 'Métricas diárias' },
  { id: 'tres-dias', label: 'Regra dos 3 dias' },
  { id: 'hook-rate', label: 'Hook rate' },
  { id: 'teste', label: 'Teste e validação' },
  { id: 'pre-escala', label: 'Pré-escala' },
  { id: 'escala', label: 'Escala' },
  { id: 'lateralizacao', label: 'Lateralização' },
  { id: 'mentalidade', label: 'Mentalidade final' },
]

export function LowTicketXistoContent() {
  return (
    <article style={{ lineHeight: 1.65 }}>
      <Section id="filosofia" title="Filosofia principal">
        <Callout>
          <p style={{ margin: '0 0 0.75rem' }}>
            A otimização <strong>não</strong> é baseada em regras fixas. É baseada em leitura de dados, identificação de
            padrões e tomada de decisão.
          </p>
          <p style={{ margin: 0 }}>
            O objetivo não é seguir fórmulas — é entender o que está a acontecer na oferta e tomar a melhor decisão
            possível naquele momento.
          </p>
        </Callout>
        <Callout variant="warn">
          <strong>Erro mais comum:</strong> acreditar que «não vendeu = problema do tráfego». Na maioria das vezes isso é
          falso.
        </Callout>
      </Section>

      <Section id="principios" title="Os 3 princípios do Low Ticket">
        <PrincipleCard
          n={1}
          title="Testar rápido"
          body={
            <>
              Encontrar vencedores o mais rápido possível. Não procurar perfeição — procurar <strong style={{ color: text }}>validação</strong>.
            </>
          }
        />
        <PrincipleCard
          n={2}
          title="Matar rápido"
          body={
            <>
              Sem apego emocional aos anúncios. Se os dados mostram que não funciona: pausar, analisar, seguir em frente.
            </>
          }
        />
        <PrincipleCard
          n={3}
          title="Escalar rápido"
          body={
            <>
              Quando algo funciona, aproveitar imediatamente. Não esperar demais — escalar enquanto existe oportunidade.
            </>
          }
        />
      </Section>

      <Section id="equacao" title="Equação da oferta">
        <p style={{ color: muted, margin: '0 0 0.75rem', fontSize: '0.9375rem' }}>
          Uma oferta é composta por várias peças. Se qualquer uma estiver quebrada, o resultado final será afetado.
          <strong style={{ color: text }}> Nunca analisar apenas o tráfego.</strong>
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          {[
            'Mercado',
            'Oferta',
            'Copy',
            'Criativo',
            'Tráfego',
            'Funil',
            'Recuperação',
            'Operação',
          ].map((pill) => (
            <span
              key={pill}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(245, 210, 108, 0.1)',
                border: `1px solid ${border}`,
                color: text,
                fontSize: '0.8125rem',
              }}
            >
              {pill}
            </span>
          ))}
        </div>
      </Section>

      <Section id="metricas" title="Métricas na ponta da língua">
        <p style={{ color: muted, margin: '0 0 0.75rem', fontSize: '0.875rem' }}>Diariamente:</p>
        <BulletList
          items={[
            'ROAS de ontem',
            'ROAS da semana passada',
            'CPA atual',
            'Ticket médio',
            'Budget ativo',
            'Número de anúncios ativos',
            'Anúncios em teste',
            'Anúncios em pré-escala',
            'Anúncios em escala',
          ]}
        />
        <Callout variant="gold" >
          <strong>Métrica mais importante: ROAS.</strong> Não CPC, CPM ou CTR. Pergunta principal: «Estou a ganhar dinheiro?» Se sim, o resto é secundário.
        </Callout>
      </Section>

      <Section id="tres-dias" title="Regra dos 3 dias">
        <DayBlock
          day="Dia 1"
          title="Funcionamento"
          items={['Está a gastar?', 'Está a receber cliques?', 'Existem Initiate Checkout?']}
          note="Não procurar lucro — procurar funcionamento."
        />
        <DayBlock
          day="Dia 2"
          title="Sinais iniciais"
          items={['Vendas', 'ROAS', 'Hook Rate', 'IC Rate']}
          note="Ainda não escalar. Ainda não aumentar orçamento."
        />
        <DayBlock
          day="Dia 3"
          title="Validar"
          items={['Existe venda?', 'Existe lucro?', 'Existe padrão?']}
          note="Se sim → prosseguir. Se não → matar."
        />
        <Callout variant="warn">
          <strong>Pausar imediatamente</strong> (mesmo no dia 1) se CPM ou CPC estiverem absurdos — ex.: CPM &gt; 100 ou CPC &gt; 2. Parar e investigar.
        </Callout>
      </Section>

      <Section id="hook-rate" title="Hook rate">
        <p style={{ color: muted, margin: '0 0 1rem', fontSize: '0.9375rem' }}>
          A primeira métrica de um criativo — capacidade de <strong style={{ color: text }}>parar o scroll</strong>.
        </p>
        <BenchmarkRow range="&lt; 30%" label="Gancho fraco" desc="Necessita substituição." tone="bad" />
        <BenchmarkRow range="30% – 60%" label="Aceitável" desc="Pode melhorar." tone="ok" />
        <BenchmarkRow range="&gt; 60%" label="Muito bom" desc="Escalável." tone="good" />
        <Callout>
          <strong>Regra dos ganchos:</strong> quando encontrares um criativo vencedor, NÃO mudes o corpo. Testa apenas novos hooks, primeiros 3 segundos e headlines — isolar variáveis.
        </Callout>
      </Section>

      <Section id="teste" title="Teste e validação">
        <p style={{ color: muted, margin: '0 0 0.75rem' }}>
          <strong style={{ color: text }}>Segmentação:</strong> o mais aberto possível (Broad, sem interesses). Limitar só sexo, idade e idioma quando necessário.
        </p>
        <p style={{ color: muted, margin: '0 0 0.75rem' }}>
          <strong style={{ color: text }}>Orçamento de teste:</strong> entre 0,5 CPA e 1 CPA por conjunto. Ex.: CPA alvo 18€ → orçamento 9€–18€ por conjunto.
        </p>
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
          {[
            { n: '1 venda', t: 'Pausar e analisar' },
            { n: '2–3 vendas', t: 'Manter — existe potencial' },
            { n: '4+ vendas', t: 'Pré-escala — provavelmente vencedor' },
          ].map((row) => (
            <div
              key={row.n}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '0.75rem 1rem',
                background: card,
                border: `1px solid ${border}`,
                borderRadius: '0.625rem',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ color: gold, fontWeight: 600 }}>{row.n}</span>
              <span style={{ color: muted, textAlign: 'right' }}>{row.t}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="pre-escala" title="Pré-escala">
        <Callout variant="warn">
          A fase mais crítica — é onde as pessoas escalam demasiado, escalam cedo demais ou matam vencedores.
        </Callout>
        <p style={{ color: text, margin: 0, fontSize: '0.9375rem' }}>
          Não aumentar orçamento imediatamente. Deixar o Facebook aprender: <strong>Dia 1 → manter · Dia 2 → manter · Dia 3 → começar otimização</strong>.
        </p>
        <div style={{ marginTop: '1.25rem' }}>
          <p style={{ color: muted, fontSize: '0.8125rem', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            CPA vs ROAS por fase
          </p>
          <PhaseTable
            rows={[
              { phase: 'Teste', metric: 'CPA', goal: 'Validar' },
              { phase: 'Pré-escala', metric: 'CPA + ROAS', goal: 'Eficiência' },
              { phase: 'Escala', metric: 'ROAS', goal: 'Lucro' },
            ]}
          />
        </div>
      </Section>

      <Section id="escala" title="Escala">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '0.75rem', padding: '1rem' }}>
            <div style={{ color: gold, fontWeight: 700, marginBottom: '0.5rem' }}>Escala vertical</div>
            <p style={{ margin: 0, color: muted, fontSize: '0.875rem', lineHeight: 1.55 }}>
              Aumentar orçamento — referência <strong style={{ color: text }}>+20% por vez</strong>. Nunca duplicar agressivamente.
            </p>
          </div>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '0.75rem', padding: '1rem' }}>
            <div style={{ color: gold, fontWeight: 700, marginBottom: '0.5rem' }}>Escala horizontal</div>
            <p style={{ margin: 0, color: muted, fontSize: '0.875rem', lineHeight: 1.55 }}>
              Mais segura: duplicar campanhas/conjuntos, testar noutras contas e estruturas.
            </p>
          </div>
        </div>
        <Callout variant="gold" >
          <strong>Regra de ouro:</strong> validar em <strong>ABO</strong> → escalar vencedor em <strong>CBO</strong>.
        </Callout>
      </Section>

      <Section id="lateralizacao" title="Lateralização">
        <p style={{ color: muted, margin: '0 0 1rem' }}>
          O verdadeiro motor da escala — criar novos anúncios baseados em vencedores.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ textAlign: 'center', padding: '1.25rem', background: 'rgba(245,210,108,0.1)', borderRadius: '0.75rem', border: `1px solid ${border}` }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: gold }}>70%</div>
            <div style={{ color: muted, fontSize: '0.8125rem' }}>Criativos baseados em vencedores</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1.25rem', background: card, borderRadius: '0.75rem', border: `1px solid ${border}` }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: text }}>30%</div>
            <div style={{ color: muted, fontSize: '0.8125rem' }}>Criativos totalmente novos</div>
          </div>
        </div>
        <p style={{ color: muted, fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>Elementos testáveis:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div>
            <div style={{ color: gold, fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.375rem' }}>Criativo</div>
            <BulletList items={['Hook', 'Headline', 'Visual inicial', 'Música', 'Voz', 'Efeitos sonoros']} />
          </div>
          <div>
            <div style={{ color: gold, fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.375rem' }}>Facebook</div>
            <BulletList items={['Texto principal', 'Headline do anúncio', 'Estrutura da campanha']} />
          </div>
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ color: gold, fontWeight: 600, marginBottom: '0.75rem' }}>Processo de escala</p>
          <Steps
            items={[
              'Encontrar vencedor',
              'Validar durante vários dias',
              'Criar variações',
              'Lateralizar',
              'Escalar horizontalmente',
              'Escalar verticalmente',
              'Repetir',
            ]}
          />
        </div>
      </Section>

      <Section id="mentalidade" title="Mentalidade final">
        <Callout>
          <BulletList
            items={[
              'Nunca otimizar cedo demais',
              'Nunca escalar cedo demais',
              'Nunca assumir que o problema está no tráfego',
            ]}
          />
          <p style={{ margin: '1rem 0 0', color: text }}>
            A otimização é: <strong>Diagnóstico → Decisão → Execução</strong>.
          </p>
          <p style={{ margin: '0.75rem 0 0', color: gold, fontWeight: 600 }}>
            Quem lê melhor os dados ganha — não quem mexe mais no Facebook.
          </p>
        </Callout>
      </Section>
    </article>
  )
}

export function StudyCourseLayout({
  course,
  children,
}: {
  course: StudyCourseMeta
  children: React.ReactNode
}) {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <Link
        href="/study"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: muted,
          fontSize: '0.8125rem',
          textDecoration: 'none',
          marginBottom: '1.25rem',
        }}
      >
        <ArrowLeft size={16} /> Resumo de cursos
      </Link>

      <header
        style={{
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: `1px solid ${border}`,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
          {course.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.375rem',
                background: 'rgba(245, 210, 108, 0.12)',
                color: gold,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <h1 style={{ color: gold, fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, margin: '0 0 0.35rem', lineHeight: 1.2 }}>
          {course.title}
          <span style={{ color: muted, fontWeight: 600, fontSize: '0.55em', marginLeft: '0.5rem' }}>{course.author}</span>
        </h1>
        <p style={{ color: text, fontSize: '1.0625rem', margin: '0 0 0.75rem', fontWeight: 500 }}>{course.module}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: muted, fontSize: '0.8125rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={14} /> ~{course.readMinutes} min de leitura
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <BookOpen size={14} /> Resumo
          </span>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: '2rem',
        }}
        className="study-layout"
      >
        <aside
          style={{
            order: -1,
          }}
          className="study-toc"
        >
          <nav
            style={{
              position: 'sticky',
              top: '1rem',
              background: card,
              border: `1px solid ${border}`,
              borderRadius: '0.75rem',
              padding: '1rem 1.125rem',
            }}
          >
            <div
              style={{
                color: muted,
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.75rem',
              }}
            >
              Neste resumo
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {TOC.map((item) => (
                <li key={item.id} style={{ marginBottom: '0.375rem' }}>
                  <a
                    href={`#${item.id}`}
                    style={{
                      color: muted,
                      fontSize: '0.8125rem',
                      textDecoration: 'none',
                      display: 'block',
                      padding: '0.25rem 0',
                      transition: 'color 0.15s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = gold
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = muted
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div style={{ minWidth: 0, maxWidth: '720px' }}>{children}</div>
      </div>

      <style jsx global>{`
        @media (min-width: 900px) {
          .study-layout {
            grid-template-columns: 220px minmax(0, 1fr) !important;
          }
          .study-toc {
            order: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
