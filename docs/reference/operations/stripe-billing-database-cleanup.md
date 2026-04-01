# Stripe Billing Database Cleanup

This plan captures the remaining legacy billing columns left over from the Polar-to-Stripe migration. Runtime launch paths now use Stripe only, but these columns should be removed in a separate database migration after a final production backup.

## Preconditions

- Confirm Stripe is the only active billing provider in production.
- Confirm there are no operational scripts left that depend on legacy `polar_*` fields.
- Take a production database backup/snapshot before running destructive schema changes.

## Legacy columns to drop

### `billing_customer`

- `polar_customer_id`
- `polar_external_id`

Indexes:

- `billing_customer_polar_customer_idx`
- `billing_customer_polar_external_idx`

### `billing_subscription`

- `polar_subscription_id`
- `polar_customer_id`
- `polar_checkout_id`
- `polar_product_id`

Indexes:

- `billing_subscription_polar_subscription_idx`

### `billing_order`

- `polar_order_id`
- `polar_customer_id`
- `polar_subscription_id`
- `polar_checkout_id`
- `polar_product_id`

Indexes:

- `billing_order_polar_order_idx`

### `referral_reward_grant`

- `polar_discount_id`
- `polar_discount_code`

### `affiliate_offer`

- `polar_discount_id`

### `affiliate_commission_event`

- `polar_order_id`
- `polar_subscription_id`

Indexes:

- `affiliate_commission_event_order_idx`

## Recommended migration order

1. Drop indexes that depend on legacy Polar columns.
2. Drop the legacy Polar columns from billing and affiliate tables.
3. Update Drizzle schema definitions to match the new Stripe-only shape.
4. Run type checks and billing smoke tests.

## Smoke test checklist after migration

- Stripe checkout creates a billing order.
- Billing portal opens correctly.
- Invoice history still renders in settings.
- Referral paid conversions still mark correctly on Stripe invoice payment.
- Affiliate commission events still record and appear in affiliate dashboards.

## Suggested migration file shape

Use a new migration after the current latest migration, for example `0052_drop_legacy_polar_billing_columns.sql`, with this structure:

```sql
DROP INDEX IF EXISTS "billing_customer_polar_customer_idx";
DROP INDEX IF EXISTS "billing_customer_polar_external_idx";
DROP INDEX IF EXISTS "billing_subscription_polar_subscription_idx";
DROP INDEX IF EXISTS "billing_order_polar_order_idx";
DROP INDEX IF EXISTS "affiliate_commission_event_order_idx";

ALTER TABLE "billing_customer"
  DROP COLUMN IF EXISTS "polar_customer_id",
  DROP COLUMN IF EXISTS "polar_external_id";

ALTER TABLE "billing_subscription"
  DROP COLUMN IF EXISTS "polar_subscription_id",
  DROP COLUMN IF EXISTS "polar_customer_id",
  DROP COLUMN IF EXISTS "polar_checkout_id",
  DROP COLUMN IF EXISTS "polar_product_id";

ALTER TABLE "billing_order"
  DROP COLUMN IF EXISTS "polar_order_id",
  DROP COLUMN IF EXISTS "polar_customer_id",
  DROP COLUMN IF EXISTS "polar_subscription_id",
  DROP COLUMN IF EXISTS "polar_checkout_id",
  DROP COLUMN IF EXISTS "polar_product_id";

ALTER TABLE "referral_reward_grant"
  DROP COLUMN IF EXISTS "polar_discount_id",
  DROP COLUMN IF EXISTS "polar_discount_code";

ALTER TABLE "affiliate_offer"
  DROP COLUMN IF EXISTS "polar_discount_id";

ALTER TABLE "affiliate_commission_event"
  DROP COLUMN IF EXISTS "polar_order_id",
  DROP COLUMN IF EXISTS "polar_subscription_id";
```
