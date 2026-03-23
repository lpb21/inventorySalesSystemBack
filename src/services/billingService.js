/**
 * Billing Service
 * Handles checkout creation, webhook processing and overdue subscriptions.
 * Integrated with ePayco Standard Checkout.
 */
const axios = require('axios');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Tenant, TenantSubscription, BillingWebhookEvent } = require('../models');
const billingPlans = require('../config/billingPlans');
const env = require('../config/env');
const auditService = require('./auditService');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

class BillingService {
  buildCheckoutReference(tenantId, planCode) {
    return `invleo-${tenantId}-${planCode}-${Date.now()}`;
  }

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

    const reference = this.buildCheckoutReference(tenantId, planCode);

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

    // Convert amount from cents to pesos for ePayco
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
      mode: 'redirect',
    };

    try {
      // Create payment reference with ePayco API
      const epaycoResponse = await axios.post(
        `${env.epayco.baseUrl}/payment/process`,
        {
          name: `${plan.displayName} - ${tenant.business_name || tenant.name}`,
          description: `Suscripcion ${plan.displayName} para ${tenant.business_name || tenant.name}`,
          invoice: reference,
          currency: plan.currency,
          amount: String(amountInPesos),
          tax_base: '0',
          tax: '0',
          country: 'CO',
          lang: 'es',
          external: 'false',
          extra1: String(tenantId),
          extra2: planCode,
          extra3: '',
          response: env.epayco.redirectUrl,
          confirmation: env.epayco.confirmationUrl,
          method_confirmation: 'POST',
          test: env.epayco.testMode,
        },
        {
          headers: {
            Authorization: `Bearer ${env.epayco.privateKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      const data = epaycoResponse.data && epaycoResponse.data.data;
      if (data && data.invoice) {
        result.checkoutUrl = `https://secure.epayco.co/validation/v1/reference/${data.invoice}`;
      }
    } catch (error) {
      throw new ValidationError(
        `Error al crear checkout con ePayco: ${error.response?.data?.message || error.message}`
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

    return expectedSignature === signature;
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
      const subscription = await TenantSubscription.findOne({
        where: { last_checkout_reference: reference },
      });

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
    const subscription = await TenantSubscription.findOne({ where: { tenant_id: tenantId } });
    if (!subscription) {
      return null;
    }

    return subscription;
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
}

module.exports = new BillingService();
