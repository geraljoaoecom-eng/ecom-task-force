async function sendMail(to, subject, body) {
  console.log(`📧 SPY email → ${to}: ${subject}`);
  console.log(body);

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    return;
  }

  const host = process.env.SMTP_HOST;
  if (!host) return;

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@ecoomtaskforce.site',
      to,
      subject,
      text: body,
    });
  } catch (err) {
    console.warn(`⚠️ SPY email falhou (${subject}):`, err.message);
  }
}

async function sendSpyCompletionEmail(session, stats) {
  const to = process.env.SPY_NOTIFY_EMAIL || 'geral.joaoecoom@gmail.com';
  const subject = `[SPY] Pesquisa concluída: ${session.name}`;
  const body = `A pesquisa SPY "${session.name}" terminou.

Discoveries: ${stats.discoveriesCount || 0}
Keywords processadas: ${stats.keywordsDone || 0}
Ads analisados: ${stats.adsScanned || 0}

Ver resultados: ${process.env.FRONTEND_URL || 'https://ecoomtaskforce.site'}/spy/${session.id}`;

  await sendMail(to, subject, body);
}

async function sendSpyExpiringEmail(discovery) {
  const to = process.env.SPY_NOTIFY_EMAIL || 'geral.joaoecoom@gmail.com';
  const expires = new Date(discovery.expires_at).toLocaleDateString('pt-PT');
  const subject = `[SPY] Discovery expira em breve: ${discovery.name}`;
  const body = `O discovery «${discovery.name}» (${discovery.session_name}) expira em ${expires}.

Importa antes de ser apagado automaticamente.

${process.env.FRONTEND_URL || 'https://ecoomtaskforce.site'}/spy`;

  await sendMail(to, subject, body);
}

module.exports = { sendSpyCompletionEmail, sendSpyExpiringEmail };
