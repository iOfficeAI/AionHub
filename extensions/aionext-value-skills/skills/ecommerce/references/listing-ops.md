# Product Up/Down Listing Operations

Use this checklist for bulk listing status changes.

## Intake

Collect:

- platform name
- current product export file
- target SKUs or matching rule
- desired action: publish, unpublish, update, or delete
- effective time if scheduled
- whether inventory should also change

## Validation

Reject or flag rows when:

- SKU is blank
- action is blank or unsupported
- title is blank for publish/update
- price is missing or less than or equal to zero for publish/update
- stock is missing when inventory is managed
- image URL/path is missing for publish/update
- current status is already equal to requested status

## Preview Report

Include:

- total source rows
- rows to publish
- rows to unpublish
- rows to update
- rejected rows
- duplicate SKUs
- platform-specific warnings

## Execution Safety

Use dry-run first. For API execution, require:

- explicit user confirmation
- platform connector name
- sandbox/test mode when available
- rollback or previous-state export
