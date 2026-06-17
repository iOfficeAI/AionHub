# Code Traps

Avoid these production mistakes:

- Payment idempotency missing: store payment intent/order transaction ids.
- Inventory race conditions: update stock atomically with a stock check.
- Frontend price trust: calculate price, discount, shipping, tax, and totals on the backend.
- Webhook signatures missing: reject unsigned callbacks.
- Product delete confusion: do not treat absent rows as delete requests.
- Bulk update without dry-run: always produce a preview before execution.
- Duplicate SKU handling: reject duplicates or pick a deterministic source of truth.
