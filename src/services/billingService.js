/**
 * Billing Service
 * Handles checkout creation, webhook processing and overdue subscriptions.
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

  buildIntegritySignature(reference, amountInCents, currency) {
    const base = `${reference}${amountInCents}${currency}${env.wompi.integritySecret}`;
    return crypto.createHash('sha256').update(base).digest('hex');
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

    if (!env.wompi.publicKey) {
      throw new ValidationError('Falta WOMPI_PUBLIC_KEY en configuracion del servidor');
    }

    if (!env.wompi.integritySecret) {
      throw new ValidationError('Falta WOMPI_INTEGRITY_SECRET en configuracion del servidor');
    }

    const reference = this.buildCheckoutReference(tenantId, planCode);

    const [subscription, created] = await TenantSubscription.findOrCreate({
      where: { tenant_id: tenantId },
      defaults: {
        tenant_id: tenantId,
        provider: 'wompi',
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
        provider: 'wompi',
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

    const integrity = this.buildIntegritySignature(reference, plan.amountInCents, plan.currency);

    const result = {
      provider: 'wompi',
      plan: {
        code: plan.code,
        name: plan.displayName,
        amountInCents: plan.amountInCents,
        currency: plan.currency,
      },
      checkoutConfig: {
        reference,
        amountInCents: plan.amountInCents,
        currency: plan.currency,
        publicKey: env.wompi.publicKey,
        integrity,
        redirectUrl: env.wompi.redirectUrl,
      },
      checkoutUrl: null,
      mode: 'widget',
    };

    if (env.wompi.privateKey && env.wompi.enablePaymentLinks) {
      try {
        const wompiResponse = await axios.post(
          `${env.wompi.baseUrl}/v1/payment_links`,
          {
            name: `${plan.displayName} - ${tenant.business_name || tenant.name}`,
            description: `Suscripcion ${plan.displayName} para ${tenant.business_name || tenant.name}`,
            single_use: false,
            collect_shipping: false,
            currency: plan.currency,
            amount_in_cents: plan.amountInCents,
            redirect_url: env.wompi.redirectUrl,
            reference,
          },
          {
            headers: {
              Authorization: `Bearer ${env.wompi.privateKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        );

        const data = wompiResponse.data && wompiResponse.data.data;
        if (data && data.id) {
          result.checkoutUrl = `https://checkout.wompi.co/l/${data.id}`;
          result.mode = 'payment_link';
        }
      } catch (error) {
        result.warning = 'No se pudo crear payment link en Wompi. Usa checkoutConfig con el widget.';
      }
    }

    await auditService.log({
      tenantId,
      userId: user.id,
      entityType: 'Tenant',
      entityId: tenantId,
      action: 'update',
      description: `Inicio de checkout Wompi para plan ${planCode}`,
      changes: {
        billing: {
          provider: 'wompi',
          reference,
          mode: result.mode,
          plan: planCode,
        },
      },
    });

    return result;
  }

  getNestedValue(source, path) {
    if (!source || !path) return undefined;
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source);
  }

  verifyWebhookSignature(payload) {
    if (env.wompi.skipWebhookSignatureValidation) {
      return true;
    }

    if (!env.wompi.eventsSecret) {
      throw new ValidationError('Falta WOMPI_EVENTS_SECRET en configuracion del servidor');
    }

    const signature = payload && payload.signature;
    if (!signature || !Array.isArray(signature.properties) || !signature.checksum) {
      return false;
    }

    const baseData = payload.data || {};
    const timestamp = signature.timestamp || payload.timestamp;
    const concatenated = signature.properties
      .map((propertyPath) => {
        const value = this.getNestedValue(baseData, propertyPath) ?? this.getNestedValue(payload, propertyPath);
        return value === undefined || value === null ? '' : String(value);
      })
      .join('');

    const hashInput = `${concatenated}${timestamp}${env.wompi.eventsSecret}`;
    const expectedChecksum = crypto.createHash('sha256').update(hashInput).digest('hex');

    return expectedChecksum === signature.checksum;
  }

  mapTransactionToSubscriptionStatus(transactionStatus) {
    const normalized = String(transactionStatus || '').toUpperCase();
    if (normalized === 'APPROVED') {
      return { tenantStatus: 'active', subscriptionStatus: 'active' };
    }

    if (normalized === 'PENDING') {
      return { tenantStatus: 'past_due', subscriptionStatus: 'past_due' };
    }

    if (['DECLINED', 'VOIDED', 'ERROR'].includes(normalized)) {
      return { tenantStatus: 'past_due', subscriptionStatus: 'past_due' };
    }

    return { tenantStatus: 'past_due', subscriptionStatus: 'past_due' };
  }

  async processWompiWebhook(payload) {
    const isSignatureValid = this.verifyWebhookSignature(payload);
    if (!isSignatureValid) {
      throw new ValidationError('Firma de webhook invalida');
    }

    const eventType = payload.event || payload.type || 'unknown';
    const transaction = payload.data && payload.data.transaction ? payload.data.transaction : null;
    const eventId = payload.id || payload.event_id || (transaction && transaction.id);

    if (!eventId) {
      throw new ValidationError('Webhook sin event_id/transaction.id');
    }

    const alreadyProcessed = await BillingWebhookEvent.findOne({
      where: {
        provider: 'wompi',
        event_id: String(eventId),
      },
    });

    if (alreadyProcessed) {
      return {
        duplicated: true,
        message: 'Evento ya procesado',
      };
    }

    const reference = transaction ? transaction.reference : null;
    const transactionStatus = transaction ? transaction.status : 'UNKNOWN';

    const eventRecord = await BillingWebhookEvent.create({
      provider: 'wompi',
      event_id: String(eventId),
      event_type: String(eventType),
      status: 'processing',
      payload,
    });

    try {
      if (!transaction || !reference) {
        await eventRecord.update({ status: 'ignored', error_message: 'Evento sin transaction/reference' });
        return {
          duplicated: false,
          ignored: true,
          message: 'Evento ignorado por no incluir referencia de checkout',
        };
      }

      const subscription = await TenantSubscription.findOne({
        where: { last_checkout_reference: reference },
      });

      if (!subscription) {
        await eventRecord.update({ status: 'ignored', error_message: `No existe checkout para referencia ${reference}` });
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

      const mapping = this.mapTransactionToSubscriptionStatus(transactionStatus);
      const oldTenantPlan = tenant.plan;
      const oldTenantSubscriptionStatus = tenant.subscription_status;
      const now = new Date();
      const graceUntil = new Date(now.getTime() + env.billing.gracePeriodDays * 24 * 60 * 60 * 1000);
      const planConfig = billingPlans[subscription.plan_code];
      const cycleDays = planConfig ? planConfig.cycleDays : 30;
      const periodEnd = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);

      const subscriptionUpdate = {
        status: mapping.subscriptionStatus,
        external_subscription_id: String(transaction.id || ''),
        external_customer_id: transaction.customer_email || null,
        metadata: {
          ...(subscription.metadata || {}),
          lastTransactionStatus: transactionStatus,
          lastTransactionId: transaction.id,
          lastWebhookEvent: eventType,
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
        description: `Webhook Wompi procesado: ${transactionStatus}`,
        changes: {
          plan: {
            old: oldTenantPlan,
            new: mapping.subscriptionStatus === 'active' ? subscription.plan_code : oldTenantPlan,
          },
          subscription_status: {
            old: oldTenantSubscriptionStatus,
            new: mapping.tenantStatus,
          },
          wompi: {
            reference,
            transactionId: transaction.id,
            eventType,
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
