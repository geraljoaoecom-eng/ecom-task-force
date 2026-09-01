'use client'

import { useEffect, useState, useCallback } from 'react'
import { Instagram, Wifi, WifiOff, RefreshCw, Send, Inbox, Plug, Trash2 } from 'lucide-react'
import AdminGuard from '@/components/AdminGuard'
import { instagramApi } from '@/lib/api'

const GOLD = '#F5D26C'
const CARD = '#141823'
const BORDER = 'rgba(245, 210, 108, 0.22)'

type IgAccount = {
  id: number
  username: string
  status: string
  status_detail?: string | null
  connected: boolean
  daily_cap: number
  sent_today: number
}

const TABS = [
  { key: 'definicoes', label: 'Definições', ready: true },
  { key: 'descoberta', label: 'Descoberta', ready: false },
  { key: 'prospects', label: 'Prospects', ready: false },
  { key: 'campanhas', label: 'Campanhas', ready: false },
  { key: 'funis', label: 'Funis', ready: false },
  { key: 'inbox', label: 'Inbox', ready: false },
]

const STATUS_LABEL: Record<string, string> = {
  connected: 'Conectada',
  disconnected: 'Desligada',
  pending_2fa: 'À espera de 2FA',
  checkpoint: 'Checkpoint',
  expired: 'Sessão expirada',
  error: 'Erro',
}

function btn(primary = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.5rem 0.85rem',
    borderRadius: '0.5rem',
    border: `1px solid ${primary ? GOLD : BORDER}`,
    background: primary ? GOLD : 'transparent',
    color: primary ? '#0b0e14' : '#E8EDF2',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.7rem',
  borderRadius: '0.5rem',
  border: `1px solid ${BORDER}`,
  background: '#0e121b',
  color: '#E8EDF2',
  fontSize: '0.9rem',
}

export default function InstagramTalksPage() {
  const [tab, setTab] = useState('definicoes')
  const [mobile, setMobile] = useState<boolean | null>(null)
  const [netInfo, setNetInfo] = useState<string>('')
  const [accounts, setAccounts] = useState<IgAccount[]>([])
  const [loading, setLoading] = useState(false)

  // form de login
  const [mode, setMode] = useState<'session' | 'password'>('session')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [sessionid, setSessionid] = useState('')
  const [csrftoken, setCsrftoken] = useState('')
  const [rur, setRur] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)

  const refreshAccounts = useCallback(async () => {
    try {
      const r = await instagramApi.listAccounts()
      setAccounts(r.accounts || [])
    } catch {
      /* ignore */
    }
  }, [])

  const checkNetwork = useCallback(async () => {
    try {
      const r = await instagramApi.networkCheck()
      setMobile(!!r.mobile)
      setNetInfo(`${r.org || r.isp || ''} ${r.asn ? '· ' + r.asn : ''}`.trim())
    } catch {
      setMobile(false)
      setNetInfo('Não foi possível verificar o IP')
    }
  }, [])

  useEffect(() => {
    checkNetwork()
    refreshAccounts()
  }, [checkNetwork, refreshAccounts])

  async function handleLogin() {
    setMsg(null)
    setLoading(true)
    try {
      const r = await instagramApi.login(username.trim(), password)
      if (r.status === 'connected') {
        setMsg({ type: 'ok', text: `Conta @${r.username} conectada.` })
        setUsername(''); setPassword(''); setPendingId(null)
      } else if (r.status === '2fa') {
        setPendingId(r.pendingId)
        setMsg({ type: 'info', text: 'Insere o código 2FA enviado pelo Instagram.' })
      } else {
        setMsg({ type: 'err', text: r.message || 'Falha no login.' })
      }
      refreshAccounts()
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.response?.data?.error || e.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleSessionImport() {
    setMsg(null)
    setLoading(true)
    try {
      // junta os 3 cookies numa string (extrai o valor caso colem "nome=valor")
      const val = (s: string) => {
        const t = s.trim()
        const i = t.indexOf('=')
        return i >= 0 && /^[a-z_]+$/i.test(t.slice(0, i)) ? t.slice(i + 1).trim() : t
      }
      const cookieStr = `sessionid=${val(sessionid)}; csrftoken=${val(csrftoken)}; rur=${val(rur)}`
      const r = await instagramApi.sessionImport(username.trim(), cookieStr)
      if (r.status === 'connected') {
        setMsg({ type: r.warn ? 'info' : 'ok', text: `Conta @${r.username} ligada via sessão.${r.warn || ''}` })
        setUsername(''); setSessionid(''); setCsrftoken(''); setRur('')
      } else {
        setMsg({ type: 'err', text: r.message || 'Falha a importar sessão.' })
      }
      refreshAccounts()
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.response?.data?.error || e.message })
    } finally {
      setLoading(false)
    }
  }

  async function handle2fa() {
    if (!pendingId) return
    setLoading(true)
    try {
      const r = await instagramApi.submit2fa(pendingId, code.trim())
      if (r.status === 'connected') {
        setMsg({ type: 'ok', text: `Conta @${r.username} conectada.` })
        setPendingId(null); setCode(''); setUsername(''); setPassword('')
      } else {
        setMsg({ type: 'err', text: r.message || 'Código inválido.' })
      }
      refreshAccounts()
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.response?.data?.error || e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminGuard>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ color: GOLD, fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Instagram size={28} /> Instagram Talks
        </h1>
        <p style={{ color: '#94a3b8', margin: '0 0 1.25rem', fontSize: '0.9rem' }}>
          Prospeção de experts + DMs em massa com funil automático. <strong style={{ color: '#cbd5e1' }}>Fase 0:</strong> ligar conta e testar envio.
        </p>

        {/* Gate de IP móvel */}
        <NetworkBanner mobile={mobile} info={netInfo} onRefresh={checkNetwork} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '1.25rem 0' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => t.ready && setTab(t.key)}
              style={{
                ...btn(tab === t.key),
                opacity: t.ready ? 1 : 0.45,
                cursor: t.ready ? 'pointer' : 'not-allowed',
              }}
            >
              {t.label}{!t.ready && ' · em breve'}
            </button>
          ))}
        </div>

        {tab === 'definicoes' && (
          <>
            {/* Ligar nova conta */}
            <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 style={{ color: '#E8EDF2', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plug size={18} color={GOLD} /> Ligar conta Instagram
              </h2>

              {/* Toggle de método */}
              {!pendingId && (
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.9rem' }}>
                  <button style={{ ...btn(mode === 'session'), fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => { setMode('session'); setMsg(null) }}>
                    Importar sessão (recomendado)
                  </button>
                  <button style={{ ...btn(mode === 'password'), fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => { setMode('password'); setMsg(null) }}>
                    Password
                  </button>
                </div>
              )}

              {!pendingId && mode === 'session' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', maxWidth: '560px' }}>
                  <div style={{ background: '#0e121b', border: `1px solid ${BORDER}`, borderRadius: '0.5rem', padding: '0.75rem 0.9rem', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    <strong style={{ color: GOLD }}>Como obter os 3 cookies:</strong>
                    <ol style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                      <li>No PC, abre <strong>instagram.com</strong> com login na conta.</li>
                      <li><strong>F12</strong> → aba <strong>Application</strong> → <strong>Cookies</strong> → <strong>instagram.com</strong>.</li>
                      <li>Copia o <strong>Value</strong> de cada um: <code>sessionid</code>, <code>csrftoken</code>, <code>rur</code> e cola nas 3 caixas abaixo.</li>
                      <li>O <code>rur</code> tem aspas no valor — copia <strong>tudo, com as aspas</strong>.</li>
                    </ol>
                  </div>
                  <input style={inputStyle} placeholder="username (sem @)" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
                  <input style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem' }} placeholder="sessionid" value={sessionid} onChange={(e) => setSessionid(e.target.value)} autoComplete="off" />
                  <input style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem' }} placeholder="csrftoken" value={csrftoken} onChange={(e) => setCsrftoken(e.target.value)} autoComplete="off" />
                  <input style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem' }} placeholder="rur (com aspas)" value={rur} onChange={(e) => setRur(e.target.value)} autoComplete="off" />
                  <button style={{ ...btn(true), opacity: loading || !username || !sessionid || !csrftoken || !rur ? 0.5 : 1 }} disabled={loading || !username || !sessionid || !csrftoken || !rur} onClick={handleSessionImport}>
                    {loading ? 'A validar sessão…' : 'Ligar via sessão'}
                  </button>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Este método não precisa de dados móveis — a sessão já foi criada por ti no Instagram.</span>
                </div>
              ) : !pendingId && mode === 'password' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', maxWidth: '420px' }}>
                  <input style={inputStyle} placeholder="username (sem @)" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
                  <input style={inputStyle} type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  <button style={{ ...btn(true), opacity: loading || !mobile ? 0.5 : 1 }} disabled={loading || !mobile} onClick={handleLogin}>
                    {loading ? 'A ligar…' : 'Ligar conta'}
                  </button>
                  {!mobile && <span style={{ color: '#f59e9e', fontSize: '0.8rem' }}>Liga os dados móveis para poder ligar a conta.</span>}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', maxWidth: '420px' }}>
                  <input style={inputStyle} placeholder="código 2FA" value={code} onChange={(e) => setCode(e.target.value)} />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ ...btn(true), opacity: loading ? 0.5 : 1 }} disabled={loading} onClick={handle2fa}>Confirmar código</button>
                    <button style={btn()} onClick={() => { setPendingId(null); setCode(''); setMsg(null) }}>Cancelar</button>
                  </div>
                </div>
              )}

              {msg && (
                <p style={{ marginTop: '0.85rem', fontSize: '0.85rem', color: msg.type === 'ok' ? '#86efac' : msg.type === 'err' ? '#f59e9e' : '#cbd5e1' }}>
                  {msg.text}
                </p>
              )}
            </section>

            {/* Contas ligadas */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 0.9rem' }}>
                <h2 style={{ color: '#E8EDF2', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Contas ({accounts.length})</h2>
                <button style={btn()} onClick={refreshAccounts}><RefreshCw size={14} /> Atualizar</button>
              </div>
              {accounts.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sem contas ligadas.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {accounts.map((a) => (
                  <AccountCard key={a.id} account={a} mobile={!!mobile} onChanged={refreshAccounts} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AdminGuard>
  )
}

function NetworkBanner({ mobile, info, onRefresh }: { mobile: boolean | null; info: string; onRefresh: () => void }) {
  const isMobile = mobile === true
  const bg = mobile === null ? 'rgba(148,163,184,0.12)' : isMobile ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'
  const border = mobile === null ? 'rgba(148,163,184,0.3)' : isMobile ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'
  const color = mobile === null ? '#cbd5e1' : isMobile ? '#86efac' : '#f59e9e'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: bg, border: `1px solid ${border}`, borderRadius: '0.6rem', padding: '0.7rem 0.95rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color, fontSize: '0.85rem' }}>
        {isMobile ? <Wifi size={18} /> : <WifiOff size={18} />}
        <span>
          {mobile === null ? 'A verificar rede…' : isMobile ? 'Dados móveis ativos — pronto para operar.' : 'Estás em WiFi — liga os dados móveis para proteger a conta.'}
          {info && <span style={{ color: '#94a3b8' }}> {info}</span>}
        </span>
      </div>
      <button style={btn()} onClick={onRefresh}><RefreshCw size={14} /></button>
    </div>
  )
}

function AccountCard({ account, mobile, onChanged }: { account: IgAccount; mobile: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [out, setOut] = useState<string>('')
  const [dmUser, setDmUser] = useState('')
  const [dmText, setDmText] = useState('')

  async function run(label: string, fn: () => Promise<any>) {
    setBusy(label); setOut('')
    try {
      const r = await fn()
      setOut(JSON.stringify(r, null, 2))
      onChanged()
    } catch (e: any) {
      setOut('Erro: ' + (e?.response?.data?.error || e.message))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '0.75rem', padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#E8EDF2', fontWeight: 600 }}>@{account.username}</div>
          <div style={{ color: account.connected ? '#86efac' : '#94a3b8', fontSize: '0.8rem' }}>
            {STATUS_LABEL[account.status] || account.status}
            {account.status_detail ? ` — ${account.status_detail}` : ''}
            {' · '}enviadas hoje: {account.sent_today}/{account.daily_cap}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button style={btn()} disabled={!!busy} onClick={() => run('check', () => instagramApi.check(account.id))}>
            <RefreshCw size={14} /> Verificar
          </button>
          <button style={btn()} disabled={!!busy} onClick={() => run('inbox', () => instagramApi.inbox(account.id, 10))}>
            <Inbox size={14} /> Inbox
          </button>
          <button style={btn()} disabled={!!busy} onClick={() => run('disconnect', () => instagramApi.disconnect(account.id))}>
            <Trash2 size={14} /> Desligar
          </button>
        </div>
      </div>

      {/* DM de teste */}
      <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inputStyle, width: '180px' }} placeholder="username destino" value={dmUser} onChange={(e) => setDmUser(e.target.value)} />
        <input style={{ ...inputStyle, flex: 1, minWidth: '220px' }} placeholder="mensagem de teste" value={dmText} onChange={(e) => setDmText(e.target.value)} />
        <button
          style={{ ...btn(true), opacity: busy || !mobile || !dmUser || !dmText ? 0.5 : 1 }}
          disabled={!!busy || !mobile || !dmUser || !dmText}
          onClick={() => run('send', () => instagramApi.send(account.id, dmUser.trim(), dmText))}
        >
          <Send size={14} /> Enviar DM
        </button>
      </div>
      {!mobile && <div style={{ color: '#f59e9e', fontSize: '0.75rem', marginTop: '0.4rem' }}>Liga os dados móveis para enviar.</div>}

      {out && (
        <pre style={{ marginTop: '0.85rem', background: '#0b0e14', border: `1px solid ${BORDER}`, borderRadius: '0.5rem', padding: '0.7rem', color: '#cbd5e1', fontSize: '0.75rem', overflowX: 'auto', maxHeight: '240px' }}>
          {busy ? `A executar (${busy})…` : out}
        </pre>
      )}
    </div>
  )
}
