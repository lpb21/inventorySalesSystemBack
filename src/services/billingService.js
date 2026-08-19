/**
 * Billing Service
 * Handles checkout creation, webhook processing and overdue subscriptions.
 * Integrated with ePayco SDK for PSE payments (Bank Redirect)
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Tenant, TenantSubscription, BillingWebhookEvent } = require('../models');
const billingPlans = require('../config/billingPlans');
const env = require('../config/env');
const auditService = require('./auditService');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const {
  createPaymentSession,
  getTransaction,
  buildCheckoutReference,
  buildAnonymousCheckoutReference,
} = require('../config/epaycoClient');

class BillingService {
  async createCheckoutSession({ tenantId, user, planCode }) {
    const plan = billingPlans[planCode];
    if (!plan) {
      throw new ValidationError('El plan seleccionado no es valido');
    }

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant no encontrado');
    }

    if (!tenant.is_active) {
      throw new ConflictError('No se puede iniciar checkout para una empresa inactiva');
    }

    if (!env.epayco.publicKey) {
      throw new ValidationError('Falta EPAYCO_PUBLIC_KEY en configuracion del servidor');
    }

    if (!env.epayco.privateKey) {
      throw new ValidationError('Falta EPAYCO_PRIVATE_KEY en configuracion del servidor');
    }

    const reference = buildCheckoutReference(tenantId, planCode);
    const amountInPesos = Math.round(plan.amountInCents / 100);

    const [subscription, created] = await TenantSubscription.findOrCreate({
      where: { tenant_id: tenantId },
      defaults: {
        tenant_id: tenantId,
        provider: 'epayco',
        plan_code: planCode,
        status: 'pending',
        last_checkout_reference: reference,
        metadata: {
          checkoutAttempts: 1,
          requestedBy: user.id,
        },
      },
    });

    if (!created) {
      const checkoutAttempts = (subscription.metadata && subscription.metadata.checkoutAttempts) || 0;
      await subscription.update({
        provider: 'epayco',
        plan_code: planCode,
        status: 'pending',
        last_checkout_reference: reference,
        metadata: {
          ...(subscription.metadata || {}),
          checkoutAttempts: checkoutAttempts + 1,
          requestedBy: user.id,
          requestedAt: new Date().toISOString(),
        },
      });
    }

    const result = {
      provider: 'epayco',
      plan: {
        code: plan.code,
        name: plan.displayName,
        amountInCents: plan.amountInCents,
        amountInPesos: amountInPesos,
        currency: plan.currency,
      },
      checkoutUrl: null,
      mode: 'pse',
      reference: reference,
    };

    try {
      // Create payment session using ePayco PSE (Bank Redirect)
      // Using the official SDK with proper field mapping
      const pse_info = {
        bank: '1022', // Default bank code (can be overridden)
        invoice: reference,
        description: `Suscripción ${plan.displayName} para ${tenant.business_name || tenant.name}`,
        value: String(amountInPesos),
        tax: '0',
        tax_base: '0',
        currency: plan.currency,
        type_person: '1', // 1 = Empresa, 0 = Persona Natural
        doc_type: 'CC',
        doc_number: '1234567890', // Placeholder - ideally get from tenant
        name: tenant.business_name || tenant.name,
        last_name: tenant.name,
        email: user.email,
        country: 'CO',
        city: tenant.address ? 'Bogota' : 'N/A',
        address: tenant.address || 'N/A',
        phone: tenant.phone || '3000000000',
        cell_phone: tenant.phone || '3000000000',
        ip: '127.0.0.1', // Should be client IP from request
        url_response: env.epayco.redirectUrl,
        url_confirmation: env.epayco.confirmationUrl,
        method_confirmation: 'POST',
        // Pass tenant and plan info in extra fields for webhook
        extra1: String(tenantId),
        extra2: planCode,
        extra3: 'checkout-session',
        extra4: user.id,
      };

      const epaycoResponse = await createPaymentSession(pse_info);


      if (epaycoResponse && epaycoResponse.success) {
        // ePayco SDK returns urlbanco (the PSE bank redirect URL)
        result.checkoutUrl = epaycoResponse.data?.urlbanco || epaycoResponse.urlbanco;
        result.transactionId = epaycoResponse.data?.ref_payco || epaycoResponse.ref_payco;
        result.factura = epaycoResponse.data?.factura || epaycoResponse.factura;
        result.recibo = epaycoResponse.data?.recibo || epaycoResponse.recibo;
      } else {
        throw new Error(epaycoResponse?.data?.message || 'ePayco did not return success');
      }
    } catch (error) {
      console.error('[EPAYCO ERROR] Checkout creation failed:', error);
      throw new ValidationError(
        `Error al crear checkout con ePayco: ${error.message}`
      );
    }

    await auditService.log({
      tenantId,
      userId: user.id,
      entityType: 'Tenant',
      entityId: tenantId,
      action: 'update',
      description: `Inicio de checkout ePayco para plan ${planCode}`,
      changes: {
        billing: {
          provider: 'epayco',
          reference,
          mode: result.mode,
          plan: planCode,
        },
      },
    });

    return result;
  }

  async createAnonymousCheckoutSession({ email, planCode, name, businessName }) {
    const plan = billingPlans[planCode];
    if (!plan) {
      throw new ValidationError('El plan seleccionado no es valido');
    }

    if (!env.epayco.publicKey) {
      throw new ValidationError('Falta EPAYCO_PUBLIC_KEY en configuracion del servidor');
    }

    if (!env.epayco.privateKey) {
      throw new ValidationError('Falta EPAYCO_PRIVATE_KEY en configuracion del servidor');
    }

    const reference = buildAnonymousCheckoutReference(email, planCode);
    const amountInPesos = Math.round(plan.amountInCents / 100);

    const result = {
      provider: 'epayco',
      plan: {
        code: plan.code,
        name: plan.displayName,
        amountInCents: plan.amountInCents,
        amountInPesos: amountInPesos,
        currency: plan.currency,
      },
      checkoutUrl: null,
      mode: 'pse',
      reference: reference,
    };

    try {
      // Create payment session using ePayco PSE (Bank Redirect)
      // Using the official SDK with proper field mapping
      const pse_info = {
        bank: '1022', // Default bank code
        invoice: reference,
        description: `Suscripción ${plan.displayName} para ${businessName}`,
        value: String(amountInPesos),
        tax: '0',
        tax_base: '0',
        currency: plan.currency,
        type_person: '0', // 0 = Persona Natural
        doc_type: 'CC',
        doc_number: '0000000000', // Placeholder - will be collected before payment
        name: name || 'Usuario',
        last_name: businessName,
        email: email,
        country: 'CO',
        city: 'Bogota',
        address: 'N/A',
        phone: '3000000000',
        cell_phone: '3000000000',
        ip: '127.0.0.1', // Should be client IP from request
        url_response: env.epayco.redirectUrl,
        url_confirmation: env.epayco.confirmationUrl,
        method_confirmation: 'POST',
        // Pass info in extra fields for webhook processing
        extra1: email,
        extra2: planCode,
        extra3: name,
        extra4: businessName,
        extra5: 'anonymous-checkout',
      };

      const epaycoResponse = await createPaymentSession(pse_info);


      if (epaycoResponse && epaycoResponse.success) {
        // ePayco SDK returns urlbanco (the PSE bank redirect URL)
        result.checkoutUrl = epaycoResponse.data?.urlbanco || epaycoResponse.urlbanco;
        result.transactionId = epaycoResponse.data?.ref_payco || epaycoResponse.ref_payco;
        result.factura = epaycoResponse.data?.factura || epaycoResponse.factura;
        result.recibo = epaycoResponse.data?.recibo || epaycoResponse.recibo;
      } else {
        throw new Error(epaycoResponse?.data?.message || 'ePayco did not return success');
      }
    } catch (error) {
      console.error('[EPAYCO ERROR] Anonymous checkout creation failed:', error);
      throw new ValidationError(
        `Error al crear checkout con ePayco: ${error.message}`
      );
    }

    return result;
  }

  /**
   * Create Smart Checkout v2 Session (Widget/Modal)
   * Similar to anonymous checkout but returns token instead of URL
   * For new users or existing users with expired subscriptions (with renewal_token)
   */
  async createSmartCheckoutSession({ email, planCode, name, businessName, renewalToken, isRenewal }) {
    const plan = billingPlans[planCode];
    if (!plan) {
      throw new ValidationError('El plan seleccionado no es valido');
    }

    if (!env.epayco.publicKey) {
      throw new ValidationError('Falta EPAYCO_PUBLIC_KEY en configuracion del servidor');
    }

    if (!env.epayco.privateKey) {
      throw new ValidationError('Falta EPAYCO_PRIVATE_KEY en configuracion del servidor');
    }

    const reference = buildAnonymousCheckoutReference(email, planCode);
    const amountInPesos = Math.round(plan.amountInCents / 100);

    // Prepare checkout metadata to track if this is a renewal
    const checkoutMetadata = {
      checkout_type: isRenewal ? 'renewal' : 'anonymous',
      email: email,
      plan_code: planCode,
      created_at: new Date().toISOString(),
    };

    if (isRenewal) {
      checkoutMetadata.renewal_token = renewalToken;
    }

    const result = {
      provider: 'epayco',
      plan: {
        code: plan.code,
        name: plan.displayName,
        amountInCents: plan.amountInCents,
        amountInPesos: amountInPesos,
        currency: plan.currency,
      },
      checkoutToken: null,
      sessionId: null,
      mode: 'smart-checkout-v2',
      reference: reference,
      is_renewal: isRenewal, // Include in response for frontend tracking
    };

    try {
      // Create Smart Checkout v2 session using ePayco SDK
      // SDK creates PSE session, frontend renders widget with token
      // Same params as PSE redirect, SDK returns token instead of URL
      const pse_info = {
        bank: '1022', // Default bank code
        invoice: reference,
        description: `Suscripción ${plan.displayName} para ${businessName}`,
        value: String(amountInPesos),
        tax: '0',
        tax_base: '0',
        currency: plan.currency,
        type_person: '0', // 0 = Persona Natural
        doc_type: 'CC',
        doc_number: '0000000000',
        name: name || 'Usuario',
        last_name: businessName,
        email: email,
        country: 'CO',
        city: 'Bogota',
        address: 'N/A',
        phone: '3000000000',
        cell_phone: '3000000000',
        ip: '127.0.0.1',
        url_response: env.epayco.redirectUrl,
        url_confirmation: env.epayco.confirmationUrl,
        method_confirmation: 'POST'
      };

      const epaycoResponse = await createPaymentSession(pse_info);


      if (epaycoResponse && epaycoResponse.success) {
        // ePayco SDK bank.create() returns urlbanco (PSE redirect URL)
        // For Smart Checkout widget, we need to generate a JWT token
        // using the transaction data returned by ePayco
        
        const transactionData = {
          ref_payco: epaycoResponse.data?.ref_payco,
          factura: epaycoResponse.data?.factura,
          transactionID: epaycoResponse.data?.transactionID,
          urlbanco: epaycoResponse.data?.urlbanco,
          moneda: epaycoResponse.data?.moneda,
          valor: epaycoResponse.data?.valor,
          estado: epaycoResponse.data?.estado,
        };

        // Generate JWT token for Smart Checkout widget
        // Using transaction data from ePayco
        const checkoutToken = crypto
          .createHmac('sha256', env.epayco.privateKey || 'secret')
          .update(JSON.stringify(transactionData))
          .digest('hex');

        // Alternative: Create a base64 encoded token with transaction data
        const tokenPayload = Buffer.from(JSON.stringify(transactionData)).toString('base64');
        
        result.checkoutToken = tokenPayload;
        result.sessionId = reference;
        result.transactionId = epaycoResponse.data?.ref_payco;
        result.urlbanco = epaycoResponse.data?.urlbanco; // Include URL for fallback
        
        console.log('[SMART_CHECKOUT] Generated widget token from ePayco data');
        console.log('[SMART_CHECKOUT] Token contains:', {
          ref_payco: transactionData.ref_payco,
          factura: transactionData.factura,
          urlForContext: epaycoResponse.data?.urlbanco ? 'included' : 'missing',
        });
      } else {
        throw new Error(epaycoResponse?.data?.message || 'ePayco did not return success');
      }
    } catch (error) {
      console.error('[EPAYCO ERROR] Smart Checkout v2 creation failed:', error);
      throw new ValidationError(
        `Error al crear Smart Checkout con ePayco: ${error.message}`
      );
    }

    await auditService.log({
      entityType: 'Checkout',
      entityId: reference,
      action: 'create',
      description: `Inicio de Smart Checkout v2 para ${email} - plan ${planCode}`,
      changes: {
        checkout: {
          provider: 'epayco',
          reference,
          mode: result.mode,
          plan: planCode,
          email,
        },
      },
    });

    return result;
  }

  verifyWebhookSignature(payload) {
    if (env.epayco.skipWebhookSignatureValidation) {
      return true;
    }

    if (!env.epayco.pKey || !env.epayco.pCustId) {
      throw new ValidationError('Falta EPAYCO_P_KEY o EPAYCO_P_CUST_ID en configuracion del servidor');
    }

    const signature = payload.x_signature;
    if (!signature) {
      return false;
    }

    // ePayco signature format: p_cust_id^p_key^x_ref_payco^x_transaction_id^x_amount^x_currency_code
    const signatureString = `${env.epayco.pCustId}^${env.epayco.pKey}^${payload.x_ref_payco}^${payload.x_transaction_id}^${payload.x_amount}^${payload.x_currency_code}`;
    const expectedSignature = crypto.createHash('sha256').update(signatureString).digest('hex');

    const a = Buffer.from(expectedSignature, 'hex');
    const b = Buffer.from(String(signature), 'hex');
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  mapEpaycoResponseToStatus(epaycoResponse) {
    const normalized = String(epaycoResponse || '').toLowerCase();

    if (normalized === 'aceptada') {
      return { tenantStatus: 'active', subscriptionStatus: 'active' };
    }

    // All other states: Pendiente, Rechazada, Fallida
    return { tenantStatus: 'past_due', subscriptionStatus: 'past_due' };
  }

  async processEpaycoWebhook(payload) {
    const isSignatureValid = this.verifyWebhookSignature(payload);
    if (!isSignatureValid) {
      throw new ValidationError('Firma de webhook invalida');
    }

    const eventId = payload.x_ref_payco;
    const reference = payload.x_id_invoice;
    const transactionStatus = payload.x_response;

    if (!eventId) {
      throw new ValidationError('Webhook sin x_ref_payco');
    }

    if (!reference) {
      throw new ValidationError('Webhook sin x_id_invoice');
    }

    const alreadyProcessed = await BillingWebhookEvent.findOne({
      where: {
        provider: 'epayco',
        event_id: String(eventId),
      },
    });

    if (alreadyProcessed) {
      return {
        duplicated: true,
        message: 'Evento ya procesado',
      };
    }

    const eventRecord = await BillingWebhookEvent.create({
      provider: 'epayco',
      event_id: String(eventId),
      event_type: 'payment.confirmation',
      status: 'processing',
      payload,
    });

    try {
      let subscription = await TenantSubscription.findOne({
        where: { last_checkout_reference: reference },
      });

      // If not found, try to match by email (for anonymous/renewal checkout)
      // Reference format for anonymous: "anon-{email}-{planCode}"
      if (!subscription) {
        // Extract email from reference (if it's in anonymous format)
        const referencePattern = /^anon-(.+)-([a-z0-9]+)$/;
        const match = reference.match(referencePattern);

        if (match) {
          const [, emailFromRef, planCodeFromRef] = match;
          
          console.log(`[WEBHOOK] Búsqueda por email desde reference: ${emailFromRef}`);
          
          // Look for tenant with this email
          const tenant = await Tenant.findOne({
            where: { email: emailFromRef },
          });

          if (tenant) {
            // Found tenant - this is either a renewal or email-based payment
            subscription = await TenantSubscription.findOne({
              where: { tenant_id: tenant.id },
            });

            if (!subscription) {
              // Create new subscription for this tenant
              subscription = await TenantSubscription.create({
                tenant_id: tenant.id,
                provider: 'epayco',
                plan_code: planCodeFromRef,
                status: 'pending',
                last_checkout_reference: reference,
              });
            }
          }
        }
      }

      if (!subscription) {
        await eventRecord.update({
          status: 'ignored',
          error_message: `No existe checkout para referencia ${reference}`
        });
        return {
          duplicated: false,
          ignored: true,
          message: 'No existe una suscripcion pendiente para esta referencia',
        };
      }

      const tenant = await Tenant.findByPk(subscription.tenant_id);
      if (!tenant) {
        throw new NotFoundError('Tenant asociado a la suscripcion no encontrado');
      }

      // Check if this is a renewal transaction
      const isRenewal = subscription.metadata?.checkout_type === 'renewal';

      const mapping = this.mapEpaycoResponseToStatus(transactionStatus);
      const oldTenantPlan = tenant.plan;
      const oldTenantSubscriptionStatus = tenant.subscription_status;
      const now = new Date();
      const graceUntil = new Date(now.getTime() + env.billing.gracePeriodDays * 24 * 60 * 60 * 1000);
      const planConfig = billingPlans[subscription.plan_code];
      const cycleDays = planConfig ? planConfig.cycleDays : 30;
      const periodEnd = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);

      const subscriptionUpdate = {
        status: mapping.subscriptionStatus,
        external_subscription_id: String(payload.x_transaction_id || ''),
        external_customer_id: payload.x_customer_email || null,
        metadata: {
          ...(subscription.metadata || {}),
          lastTransactionStatus: transactionStatus,
          lastTransactionId: payload.x_transaction_id,
          lastWebhookEvent: 'payment.confirmation',
          epaycoRefPayco: payload.x_ref_payco,
        },
      };

      if (mapping.subscriptionStatus === 'active') {
        subscriptionUpdate.current_period_start = now;
        subscriptionUpdate.current_period_end = periodEnd;
        subscriptionUpdate.grace_until = null;
        subscriptionUpdate.last_payment_at = now;
      } else {
        subscriptionUpdate.last_payment_failed_at = now;
        subscriptionUpdate.grace_until = graceUntil;
      }

      await subscription.update(subscriptionUpdate);
      await tenant.update({
        plan: mapping.subscriptionStatus === 'active' ? subscription.plan_code : tenant.plan,
        subscription_status: mapping.tenantStatus,
      });

      await eventRecord.update({
        status: 'processed',
        tenant_id: tenant.id,
        processed_at: new Date(),
      });

      await auditService.log({
        tenantId: tenant.id,
        userId: null,
        entityType: 'Tenant',
        entityId: tenant.id,
        action: 'update',
        description: `Webhook ePayco procesado: ${transactionStatus}`,
        changes: {
          plan: {
            old: oldTenantPlan,
            new: mapping.subscriptionStatus === 'active' ? subscription.plan_code : oldTenantPlan,
          },
          subscription_status: {
            old: oldTenantSubscriptionStatus,
            new: mapping.tenantStatus,
          },
          epayco: {
            reference,
            transactionId: payload.x_transaction_id,
            refPayco: payload.x_ref_payco,
          },
        },
      });

      return {
        duplicated: false,
        ignored: false,
        tenantId: tenant.id,
        status: mapping.subscriptionStatus,
        message: 'Webhook procesado correctamente',
      };
    } catch (error) {
      await eventRecord.update({
        status: 'failed',
        error_message: error.message,
      });
      throw error;
    }
  }

  async getTenantSubscription(tenantId) {
    // Get subscription with tenant info
    const subscription = await TenantSubscription.findOne({
      where: { tenant_id: tenantId },
      include: [
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['id', 'name', 'business_name', 'plan', 'subscription_status']
        }
      ]
    });

    if (!subscription) {
      // Return basic info even if no subscription exists
      const tenant = await Tenant.findByPk(tenantId, {
        attributes: ['id', 'name', 'business_name', 'plan', 'subscription_status']
      });

      if (!tenant) {
        return null;
      }

      return {
        subscription: null,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          business_name: tenant.business_name,
          current_plan: tenant.plan || 'free',
          status: tenant.subscription_status || 'inactive'
        },
        plan_info: billingPlans[tenant.plan] ? {
          code: tenant.plan,
          display_name: billingPlans[tenant.plan].displayName,
          amount_in_cents: billingPlans[tenant.plan].amountInCents,
          amount_formatted: `$${(billingPlans[tenant.plan].amountInCents / 100).toLocaleString()} COP`,
          currency: billingPlans[tenant.plan].currency,
          cycle_days: billingPlans[tenant.plan].cycleDays,
          is_free: billingPlans[tenant.plan].amountInCents === 0
        } : null,
        has_active_subscription: false,
        needs_attention: true,
        can_access_system: false
      };
    }

    // Calculate subscription details
    const now = new Date();
    const planInfo = billingPlans[subscription.plan_code] || null;

    let daysRemaining = null;
    let daysInGrace = null;
    let isExpired = false;
    let isInGracePeriod = false;

    if (subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end);
      const diffTime = periodEnd - now;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isExpired = daysRemaining < 0 && subscription.status !== 'active';
    }

    if (subscription.grace_until) {
      const graceEnd = new Date(subscription.grace_until);
      const graceDiffTime = graceEnd - now;
      daysInGrace = Math.ceil(graceDiffTime / (1000 * 60 * 60 * 24));
      isInGracePeriod = daysInGrace > 0 && subscription.status === 'past_due';
    }

    // Determine overall status
    let overallStatus = subscription.status;
    if (subscription.status === 'past_due' && isInGracePeriod) {
      overallStatus = 'grace_period';
    } else if (isExpired) {
      overallStatus = 'expired';
    }

    return {
      subscription: {
        id: subscription.id,
        tenant_id: subscription.tenant_id,
        provider: subscription.provider,
        plan_code: subscription.plan_code,
        status: subscription.status,
        overall_status: overallStatus,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        grace_until: subscription.grace_until,
        last_payment_at: subscription.last_payment_at,
        last_payment_failed_at: subscription.last_payment_failed_at,
        last_checkout_reference: subscription.last_checkout_reference,
        created_at: subscription.created_at,
        updated_at: subscription.updated_at
      },
      tenant: {
        id: subscription.tenant.id,
        name: subscription.tenant.name,
        business_name: subscription.tenant.business_name,
        current_plan: subscription.tenant.plan,
        status: subscription.tenant.subscription_status
      },
      plan_info: planInfo ? {
        code: planInfo.code,
        display_name: planInfo.displayName,
        amount_in_cents: planInfo.amountInCents,
        amount_formatted: `$${(planInfo.amountInCents / 100).toLocaleString()} COP`,
        currency: planInfo.currency,
        cycle_days: planInfo.cycleDays,
        is_free: planInfo.amountInCents === 0
      } : null,
      time_info: {
        days_remaining: daysRemaining,
        days_in_grace: daysInGrace,
        is_expired: isExpired,
        is_in_grace_period: isInGracePeriod,
        renewal_needed: isExpired || isInGracePeriod || (daysRemaining !== null && daysRemaining <= 7),
        current_period_end_formatted: subscription.current_period_end ?
          new Date(subscription.current_period_end).toLocaleDateString('es-CO') : null,
        grace_until_formatted: subscription.grace_until ?
          new Date(subscription.grace_until).toLocaleDateString('es-CO') : null
      },
      has_active_subscription: subscription.status === 'active',
      needs_attention: overallStatus === 'past_due' || overallStatus === 'cancelled' || overallStatus === 'expired',
      can_access_system: subscription.status === 'active' || (subscription.status === 'past_due' && isInGracePeriod)
    };
  }

  async enforceOverdueSubscriptions() {
    const now = new Date();
    const overdueSubscriptions = await TenantSubscription.findAll({
      where: {
        status: { [Op.in]: ['past_due', 'pending'] },
        grace_until: { [Op.not]: null, [Op.lt]: now },
      },
    });

    let updated = 0;
    for (const subscription of overdueSubscriptions) {
      const tenant = await Tenant.findByPk(subscription.tenant_id);
      if (!tenant) continue;

      await subscription.update({ status: 'cancelled' });
      const oldTenantPlan = tenant.plan;
      const oldTenantSubscriptionStatus = tenant.subscription_status;
      await tenant.update({
        plan: 'free',
        subscription_status: 'cancelled',
      });

      await auditService.log({
        tenantId: tenant.id,
        userId: null,
        entityType: 'Tenant',
        entityId: tenant.id,
        action: 'update',
        description: 'Suscripcion vencida por no renovar pago',
        changes: {
          plan: {
            old: oldTenantPlan,
            new: 'free',
          },
          subscription_status: {
            old: oldTenantSubscriptionStatus,
            new: 'cancelled',
          },
        },
      });

      updated += 1;
    }

    return {
      scanned: overdueSubscriptions.length,
      updated,
    };
  }

  /**
   * Initiate Renewal Flow
   * Validates that email has an expired/cancelled subscription and generates temporary renewal token
   * Returns renewal token that can be used for Smart Checkout
   */
  async initiateRenewal(email) {
    if (!email) {
      throw new ValidationError('Email es requerido');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Formato de email inválido');
    }

    console.log(`[RENEWAL] Buscando tenant con email: ${email}`);

    // Find tenant by email
    const tenant = await Tenant.findOne({
      where: { email: email },
    });

    console.log(`[RENEWAL] Tenant encontrado:`, tenant ? `ID: ${tenant.id}` : 'NO ENCONTRADO');

    if (!tenant) {
      throw new NotFoundError('No encontramos una empresa registrada con este email');
    }

    if (!tenant.is_active) {
      throw new ConflictError('La empresa está inactiva y no puede renovar su suscripción');
    }

    // Get subscription status
    const subscription = await TenantSubscription.findOne({
      where: { tenant_id: tenant.id },
    });

    if (!subscription) {
      throw new NotFoundError('No existe suscripción para esta empresa');
    }

    // Check if subscription is in renewable state
    const renewableStates = ['cancelled', 'expired', 'past_due'];
    if (!renewableStates.includes(subscription.status)) {
      throw new ConflictError(
        `Esta suscripción no puede ser renovada. Estado actual: ${subscription.status}`
      );
    }

    // Generate temporary renewal token (valid for 24 hours)
    const renewalToken = crypto
      .randomBytes(32)
      .toString('hex');

    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store renewal token in subscription metadata
    await subscription.update({
      metadata: {
        ...(subscription.metadata || {}),
        renewal_token: renewalToken,
        renewal_token_expires: tokenExpires.toISOString(),
        renewal_initiated_at: new Date().toISOString(),
      },
    });

    console.log(`[RENEWAL] Token generado para ${email} (tenant: ${tenant.id})`);

    return {
      renewal_token: renewalToken,
      tenant_id: tenant.id,
      email: tenant.email,
      company_name: tenant.business_name,
      current_subscription_status: subscription.status,
      token_expires_in_hours: 24,
    };
  }

  /**
   * Validate Renewal Token
   * Validates that renewal token is valid and belongs to the email/plan
   */
  async validateRenewalToken(email, renewalToken) {
    if (!email || !renewalToken) {
      throw new ValidationError('Email y renewal_token son requeridos');
    }

    console.log(`[RENEWAL] Validando token para email: ${email}`);

    const tenant = await Tenant.findOne({
      where: { email: email },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant no encontrado');
    }

    const subscription = await TenantSubscription.findOne({
      where: { tenant_id: tenant.id },
    });

    if (!subscription || !subscription.metadata?.renewal_token) {
      throw new ValidationError('No hay token de renovación activo para esta empresa');
    }

    // Validate token matches and hasn't expired
    if (subscription.metadata.renewal_token !== renewalToken) {
      throw new ValidationError('Token de renovación inválido');
    }

    const tokenExpires = new Date(subscription.metadata.renewal_token_expires);
    if (new Date() > tokenExpires) {
      throw new ValidationError('Token de renovación ha expirado. Por favor, inicia el proceso nuevamente');
    }

    console.log(`[RENEWAL] Token validado exitosamente para ${email}`);

    return {
      valid: true,
      tenant_id: tenant.id,
      email: tenant.email,
    };
  }
}

module.exports = new BillingService();
