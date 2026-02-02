export const BILLING_CONSTANTS = {
  // MCP base cost
  MCP_BASE_COST: 0.0, // Base cost for MCP operations

  // Balance settings
  INITIAL_BALANCE: 1.0,   // Default starting balance for new users
  MIN_BALANCE: 0.0,       // Minimum allowed balance
  TEMP_USER_BALANCE: 0.5, // Initial balance for temporary users

  // Conversion settings
  MIN_CONVERSION_BALANCE: 1.0, // Minimum balance when converting temp to regular

  // Tax settings
  TAX_RATE: 0.27,       // 27% tax rate
  TAX_INCLUSIVE: false, // Whether prices are tax-inclusive

  MIN_AMOUNT: 5,    // Minimum amount for a payment
  MAX_AMOUNT: 5000, // Maximum amount for a payment
} as const;

// ============================================
// Subscription Types
// ============================================

export type SubscriptionTier = 'hobby' | 'starter' | 'pro' | 'ultra' | 'none';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';
export type BillingInterval = 'monthly' | 'yearly';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;           // Display name
  priceMonthly: number;   // in cents (EUR), 0 = free
  priceYearly: number;    // in cents (EUR), 0 = free
  usageLimit: number;     // in USD
  features: string[];
  isFree?: boolean;
}

// Shared features included in ALL plans (displayed once above pricing cards)
export const SHARED_FEATURES = [
  'All AI models (Opus 4.5, GPT-5.2, Gemini & more)',
  'MCP integrations for tools & data',
  '14-day money-back guarantee',
] as const;

export const SUBSCRIPTION_PLANS: Record<Exclude<SubscriptionTier, 'none'>, SubscriptionPlan> = {
  hobby: {
    tier: 'hobby',
    name: 'Hobby',
    priceMonthly: 0,      // Free
    priceYearly: 0,       // Free
    usageLimit: 5,        // $5/month AI usage
    isFree: true,
    features: [
      'Test and explore AI automations',
      'Basic MCP integrations',
      'Community support',
    ],
  },
  starter: {
    tier: 'starter',
    name: 'Starter',
    priceMonthly: 2000,   // €20
    priceYearly: 19200,   // €192/yr (~€16/mo, 20% off)
    usageLimit: 25,       // $25/month AI usage
    features: [
      'For small teams and early startups',
      'All MCP integrations',
      'Email support',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: 6000,   // €60
    priceYearly: 57600,   // €576 (20% off)
    usageLimit: 120,      // $120/month AI usage
    features: [
      'For growing startups and teams',
      'All MCP integrations',
      'Priority support',
      'Early access to new features',
    ],
  },
  ultra: {
    tier: 'ultra',
    name: 'Ultra',
    priceMonthly: 20000,  // €200
    priceYearly: 192000,  // €1920 (20% off)
    usageLimit: 9999,     // Effectively unlimited ($9999/month)
    features: [
      'Heavy automation or multiple projects',
      'All MCP integrations',
      'Dedicated support',
      'Early access to new features',
    ],
  },
} as const;

// Helper functions for subscription pricing
export function getSubscriptionPrice(tier: Exclude<SubscriptionTier, 'none'>, interval: BillingInterval): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  return interval === 'monthly' ? plan.priceMonthly : plan.priceYearly;
}

export function getMonthlyEquivalent(tier: Exclude<SubscriptionTier, 'none'>, interval: BillingInterval): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (interval === 'monthly') return plan.priceMonthly;
  return Math.round(plan.priceYearly / 12);
}

export function getUsageLimit(tier: SubscriptionTier): number | null {
  if (tier === 'none') return null;
  const limit = SUBSCRIPTION_PLANS[tier].usageLimit;
  // Treat 9999+ as unlimited
  return limit >= 9999 ? null : limit;
}

export function isFreeSubscription(tier: SubscriptionTier): boolean {
  if (tier === 'none') return false;
  return SUBSCRIPTION_PLANS[tier].isFree === true;
}

export const UNSET_SCHEDULED_TIMESTAMP = 0;
export const INTERNAL_SCHEDULED_TIMESTAMP = 1;

export const NEVER_SCHEDULED_TIMESTAMP = 8640000000000000; // Max possible date (approx. year 275760)
