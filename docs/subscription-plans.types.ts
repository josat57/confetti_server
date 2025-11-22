/**
 * TypeScript type definitions for Subscription Plans API
 *
 * Usage:
 * import { SubscriptionPlan, PlanPricing, GetPlansResponse } from './subscription-plans.types';
 */

/**
 * Currency codes supported by the platform
 */
export type Currency = "NGN" | "USD" | "GBP" | "EUR";

/**
 * Plan types available
 */
export type PlanType = "vendor" | "planner";

/**
 * Billing cycle options
 */
export type BillingCycle = "monthly" | "yearly";

/**
 * Pricing information for a specific currency
 */
export interface PlanPricing {
  currency: Currency;
  amount: number; // Amount in major units (naira, dollars)
  amountInMinorUnits: number; // Amount in minor units (kobo, cents)
  _id?: string;
}

/**
 * Complete subscription plan object
 */
export interface SubscriptionPlan {
  _id: string;
  planType: PlanType;
  planName: string;
  displayName: string;
  description: string;

  // Pricing array contains all available currencies
  pricing: PlanPricing[];

  // When currency query param is used, this field is populated
  selectedPricing?: PlanPricing;

  // Features and limitations
  features: string[];
  limitations: string[];

  // Metadata
  billingCycle: BillingCycle;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

/**
 * Response from GET /subscription-plans
 */
export interface GetPlansResponse {
  status: "success";
  results: number;
  data: {
    plans: SubscriptionPlan[];
  };
}

/**
 * Response from GET /subscription-plans/:id or /subscription-plans/find/:type/:name
 */
export interface GetPlanResponse {
  status: "success";
  data: {
    plan: SubscriptionPlan;
  };
}

/**
 * Query parameters for GET /subscription-plans
 */
export interface GetPlansQueryParams {
  planType?: PlanType;
  currency?: Currency;
  activeOnly?: boolean;
}

/**
 * Query parameters for GET /subscription-plans/find/:type/:name
 */
export interface GetPlanByTypeAndNameParams {
  planType: PlanType;
  planName: string;
  currency?: Currency;
}

/**
 * Registration payload with subscription plan
 */
export interface RegistrationWithPlanPayload {
  // User details
  email: string;
  password: string;
  confirmPassword: string;
  userName?: string;
  phone?: string;

  // Subscription plan details
  planType: PlanType;
  planName: string;
  amount: number; // Amount in major units (naira, dollars)
  currency: Currency;
  planId?: string; // Optional plan ID
}

/**
 * Registration response for paid plans
 */
export interface RegistrationPaidPlanResponse {
  status: "success";
  message: string;
  data: {
    userId: string;
    email: string;
    subscriptionId: string;
    paymentUrl: string;
    reference: string;
    amount: number;
  };
}

/**
 * Registration response for free plans
 */
export interface RegistrationFreePlanResponse {
  status: "success";
  message: string;
  data: {
    userId: string;
    email: string;
    subscriptionId: string;
  };
}

/**
 * Error response
 */
export interface ErrorResponse {
  status: "fail" | "error";
  message: string;
  statusCode: number;
}

/**
 * Currency symbols mapping
 */
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  NGN: "₦",
  USD: "$",
  GBP: "£",
  EUR: "€",
};

/**
 * Helper function to format price with currency symbol
 */
export function formatPrice(pricing: PlanPricing): string {
  const symbol = CURRENCY_SYMBOLS[pricing.currency];
  return `${symbol}${pricing.amount.toLocaleString()}`;
}

/**
 * Helper function to get pricing for specific currency
 */
export function getPricingForCurrency(
  plan: SubscriptionPlan,
  currency: Currency
): PlanPricing | undefined {
  return plan.pricing.find((p) => p.currency === currency);
}

/**
 * Helper function to check if plan is free
 */
export function isFree(plan: SubscriptionPlan): boolean {
  return plan.pricing.every((p) => p.amount === 0);
}
