# LoadClarity Production Launch Checklist

This checklist distinguishes changes implemented in this project from external setup that cannot be completed without account credentials or deployment access.

## Implemented in this package

- Preserved Lemon Squeezy checkout overlay and all six supplied checkout links.
- Added signed-webhook verification using the exact raw request body.
- Added webhook-driven subscription status and plan synchronization. A paid plan is not activated by a frontend click.
- Added owner-email matching before a subscription webhook can change a workspace plan.
- Protected `Company.plan`, RateCon usage count, and subscription fields from generic client-side entity updates.
- Added authenticated server-side reservation/release endpoints for the five lifetime Free RateCon parses.
- Enforced Carrier and Truck create limits from the workspace plan on the server.
- Validated that assigned drivers and trucks belong to the same workspace; off-duty drivers cannot be newly assigned.
- Added additional baseline security response headers.
- Removed the Feedback & user reviews section from the shared login/register authentication layout. The separate `/feedback` page and footer link remain.
- Added regression tests for universal RateCon field parsing and Lemon Squeezy webhook signature verification.

## Required account/deployment configuration before real payments

1. Set `LEMON_SQUEEZY_WEBHOOK_SECRET` in production `.env`.
2. Set all six `LEMON_VARIANT_*` variables to the actual variant IDs from the Lemon Squeezy dashboard. These are product variant IDs, not checkout link UUIDs.
3. Configure the webhook URL `https://YOUR_DOMAIN/api/billing/lemonsqueezy-webhook` in Lemon Squeezy and enable subscription lifecycle and subscription payment events.
4. Run test-mode checkouts and verify subscription creation, renewal, cancellation at period end, expiration, pause, and payment recovery. Confirm the correct workspace is updated.
5. Confirm the checkout customer email matches the owner email for the workspace; unmatched webhook events are deliberately not applied.

## Required before a public multi-customer launch

- Migrate JSON file storage to a managed transactional database such as PostgreSQL. The current JSON store remains suitable for local development/small pilots, not concurrent production workloads.
- Connect a transactional email provider for email verification, password resets, and team invitations. Password reset currently logs a link in the server terminal.
- Configure HTTPS, production environment secrets, reverse-proxy settings, backups, monitoring, error tracking, and a tested restore/rollback process.
- Complete full browser end-to-end tests for registration, tenant isolation, PDF upload/OCR, Fleet/Load assignment, plan limits, checkout overlay, webhook activation, renewal and cancellation.
- Review privacy, terms, refund/cancellation disclosures, data retention/deletion, and applicable privacy/cookie requirements against the actual live deployment.
- Complete role-based team membership and seat enforcement before advertising Team seats as fully enforced.

## Test commands

```bash
npm install
npm test
npm run lint
npm run build
```

A passing parser/signature test suite does not replace live payment, browser, database, or deployment verification.
