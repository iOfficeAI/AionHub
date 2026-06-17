---
name: ecommerce
description: Build and operate online stores with payment security, inventory management, marketplace integration, conversion optimization, and product listing workflows. Use when Codex or OpenClaw needs ecommerce product up/down listing planning, SKU preparation, CSV import/export checks, inventory status updates, marketplace integration guidance, or operational controls for stores.
---

# Ecommerce

This skill helps design, secure, and operate ecommerce stores. For product up/down listing tasks, treat store changes as controlled operations: prepare import files, validate SKUs and required fields, preview the diff, then let the user execute through the platform admin or a separately configured connector.

Source basis: the public OpenClaw `ecommerce` skill describes ecommerce store operation with payment security, inventory management, marketplace integration, and conversion optimization. It does not connect to live store APIs or execute live changes by itself.

## Quick Reference

| Topic | File |
| --- | --- |
| Product up/down listing workflow | `references/listing-ops.md` |
| Import/export CSV schema | `references/listing-schema.md` |
| Douyin/Doudian API listing workflow | `references/douyin.md` |
| Platform comparison and integration notes | `references/platforms.md` |
| Code traps that break production | `references/code-traps.md` |

## Core Rules

### When Preparing Product Listings

- Normalize each product to a stable SKU.
- Keep `action` explicit: `publish`, `unpublish`, `update`, or `delete`.
- Never infer destructive deletes from missing rows.
- Validate title, category, price, stock, images, status, and platform-specific required attributes.
- Generate a preview report before any upload or API execution.
- Preserve the original export file and write a timestamped changed file.

### When Operating Stores

- Monitor stock thresholds, not only zero stock.
- Track products stuck in draft, pending review, or failed sync states.
- Avoid duplicate SKUs across platform channels.
- Keep product availability, inventory, and fulfillment settings consistent.
- Log who requested the change, source file, row count, and output file path.

### When Building Integrations

- Recalculate prices server-side. Do not trust client totals.
- Verify webhook signatures before going live.
- Use idempotency keys for orders and payments.
- Update inventory with atomic operations, not read-then-write.
- Use dry-run mode by default for bulk product status changes.

## Up/Down Listing Workflow

1. Ask which platform is being used if it is not obvious.
2. Ask for or locate the latest product export CSV/XLSX.
3. Convert the user request into a listing plan:
   - SKUs to publish
   - SKUs to unpublish
   - products to update
   - fields to validate
4. Validate the source file against `references/listing-schema.md`.
5. Create an import-ready CSV in `exports/`, preferably with `scripts/apply-listing-plan.ps1`.
6. Create a human-readable preview report.
7. Tell the user what changed and what still needs manual platform confirmation.

Do not log in to a real store, click destructive actions, or call live APIs unless the user explicitly provides a configured connector and asks for execution.

## Platform Notes

- Shopify: product status is usually `active`, `draft`, or `archived`; inventory and publication channels may be separate.
- WooCommerce: product status is usually `publish`, `draft`, or `private`; stock status may be separate.
- Amazon/eBay marketplace flows often require feed files and asynchronous processing.
- Taobao/JD/Pinduoduo/Douyin-style workflows usually require platform-specific required attributes, category templates, and image compliance checks.
- Douyin/Doudian: read `references/douyin.md`; use request generation first, then execute only after the user fills platform credentials and confirms live changes.

## Outputs

For bulk listing tasks, prefer producing:

- `exports/listing-update-YYYYMMDD-HHMM.csv`
- `exports/listing-preview-YYYYMMDD-HHMM.md`
- `exports/rejected-rows-YYYYMMDD-HHMM.csv` when validation fails

Keep the workflow reversible: include previous status and requested status in every generated change file.

## Local Script

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\apply-listing-plan.ps1 -PlanPath C:\path\to\listing-plan.json
```

The script reads a CSV export, applies SKU-based rules, and writes an update CSV plus a preview report. It does not call store APIs.

For Douyin/Doudian API request preparation:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-douyin-requests.ps1 -PlanPath C:\path\to\douyin-doudian-plan.json -ConfigPath C:\path\to\douyin-api.config.json
```

This creates request JSONL and a preview report. It does not execute live API calls.
