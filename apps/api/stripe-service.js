const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Configuração Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Configuração Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Função para criar customer no Stripe
async function createStripeCustomer(user) {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        user_id: user.id
      }
    });

    // Atualizar usuário com customer_id
    await supabase
      .from('users')
      .update({ stripe_customer_id: customer.id })
      .eq('id', user.id);

    return customer;
  } catch (error) {
    console.error('Erro ao criar customer no Stripe:', error);
    throw error;
  }
}

// Função para criar checkout session
async function createCheckoutSession(userId, priceId, planId, billingCycle) {
  try {
    // Buscar usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error('Usuário não encontrado');
    }

    // Criar customer se não existir
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await createStripeCustomer(user);
      customerId = customer.id;
    }

    // Criar checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: {
        user_id: userId,
        plan_id: planId,
        billing_cycle: billingCycle
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan_id: planId,
          billing_cycle: billingCycle
        }
      }
    });

    return session;
  } catch (error) {
    console.error('Erro ao criar checkout session:', error);
    throw error;
  }
}

// Função para criar portal session (gerenciar assinatura)
async function createPortalSession(userId) {
  try {
    // Buscar usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.stripe_customer_id) {
      throw new Error('Customer não encontrado');
    }

    // Criar portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });

    return session;
  } catch (error) {
    console.error('Erro ao criar portal session:', error);
    throw error;
  }
}

// Função para processar webhook
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Handler para checkout completado
async function handleCheckoutCompleted(session) {
  try {
    const { user_id, plan_id, billing_cycle } = session.metadata;
    
    // Buscar subscription
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    // Criar registro de subscription
    await supabase
      .from('subscriptions')
      .insert({
        user_id,
        plan_id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        status: subscription.status,
        billing_cycle,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      });

    // Atualizar plano do usuário
    await supabase
      .from('users')
      .update({ current_plan_id: plan_id })
      .eq('id', user_id);

    console.log(`✅ Checkout completado para usuário ${user_id}, plano ${plan_id}`);
  } catch (error) {
    console.error('Erro ao processar checkout completado:', error);
  }
}

// Handler para subscription atualizada
async function handleSubscriptionUpdated(subscription) {
  try {
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      })
      .eq('stripe_subscription_id', subscription.id);

    console.log(`✅ Subscription atualizada: ${subscription.id}`);
  } catch (error) {
    console.error('Erro ao atualizar subscription:', error);
  }
}

// Handler para subscription deletada
async function handleSubscriptionDeleted(subscription) {
  try {
    // Buscar subscription
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (subData) {
      // Remover plano do usuário (volta para plano gratuito)
      await supabase
        .from('users')
        .update({ current_plan_id: null })
        .eq('id', subData.user_id);

      // Atualizar status da subscription
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id);
    }

    console.log(`✅ Subscription cancelada: ${subscription.id}`);
  } catch (error) {
    console.error('Erro ao cancelar subscription:', error);
  }
}

// Handler para pagamento bem-sucedido
async function handlePaymentSucceeded(invoice) {
  try {
    // Buscar subscription
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    // Criar registro de pagamento
    await supabase
      .from('payments')
      .insert({
        user_id: subscription.metadata.user_id,
        subscription_id: subscription.id,
        stripe_payment_intent_id: invoice.payment_intent,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'succeeded',
        description: `Pagamento ${invoice.billing_reason} - ${subscription.metadata.billing_cycle}`,
        metadata: {
          invoice_id: invoice.id,
          subscription_id: subscription.id
        }
      });

    console.log(`✅ Pagamento processado: ${invoice.payment_intent}`);
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
  }
}

// Handler para pagamento falhado
async function handlePaymentFailed(invoice) {
  try {
    // Buscar subscription
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    // Criar registro de pagamento falhado
    await supabase
      .from('payments')
      .insert({
        user_id: subscription.metadata.user_id,
        subscription_id: subscription.id,
        stripe_payment_intent_id: invoice.payment_intent,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        description: `Pagamento falhado - ${invoice.billing_reason}`,
        metadata: {
          invoice_id: invoice.id,
          subscription_id: subscription.id,
          failure_reason: invoice.last_payment_error?.message
        }
      });

    console.log(`❌ Pagamento falhado: ${invoice.payment_intent}`);
  } catch (error) {
    console.error('Erro ao processar pagamento falhado:', error);
  }
}

// Função para verificar limite de bibliotecas
async function checkLibraryLimit(userId) {
  try {
    const { data, error } = await supabase
      .rpc('check_library_limit', { user_id_param: userId });

    if (error) {
      console.error('Erro ao verificar limite:', error);
      return false;
    }

    return data;
  } catch (error) {
    console.error('Erro ao verificar limite de bibliotecas:', error);
    return false;
  }
}

// Função para buscar plano atual do usuário
async function getUserCurrentPlan(userId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        current_plan_id,
        plans (
          id,
          name,
          description,
          libraries_limit,
          price_monthly,
          price_annual,
          features
        )
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
      return null;
    }

    return user.plans || null;
  } catch (error) {
    console.error('Erro ao buscar plano do usuário:', error);
    return null;
  }
}

// Função para buscar todas as assinaturas do usuário
async function getUserSubscriptions(userId) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plans (
          id,
          name,
          description,
          libraries_limit,
          price_monthly,
          price_annual
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar assinaturas:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar assinaturas do usuário:', error);
    return [];
  }
}

// Função para enviar email de ativação
async function sendActivationEmail(email, token) {
  try {
    // Por enquanto, vamos apenas logar o email
    // Em produção, você deve integrar com um serviço de email como SendGrid, Resend, etc.
    const activationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/activate?token=${token}&email=${encodeURIComponent(email)}`;
    
    console.log(`📧 EMAIL DE ATIVAÇÃO PARA: ${email}`);
    console.log(`🔗 Link de ativação: ${activationLink}`);
    console.log(`📝 Conteúdo do email:`);
    console.log(`
    ============================================
    Ecoom Task Force - Ativação de Conta
    ============================================
    
    Olá!
    
    Obrigado por adquirir o Ecoom Task Force!
    
    Para ativar sua conta e começar a monitorar anúncios, clique no link abaixo:
    
    ${activationLink}
    
    Este link é válido por 7 dias.
    
    Se você não solicitou esta conta, pode ignorar este email.
    
    Atenciosamente,
    Equipe Ecoom Task Force
    ============================================
    `);
    
    // TODO: Implementar envio real de email
    // Exemplo com SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // 
    // const msg = {
    //   to: email,
    //   from: 'noreply@ecoomtaskforce.com',
    //   subject: 'Ecoom Task Force - Ative sua conta',
    //   html: `...`
    // };
    // 
    // await sgMail.send(msg);
    
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de ativação:', error);
    throw error;
  }
}

module.exports = {
  createCheckoutSession,
  createPortalSession,
  handleStripeWebhook,
  checkLibraryLimit,
  getUserCurrentPlan,
  getUserSubscriptions
};
