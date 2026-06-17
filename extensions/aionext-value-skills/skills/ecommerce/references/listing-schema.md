# Listing CSV Schema

Use UTF-8 CSV. Required columns:

```text
sku,title,action,current_status,target_status,price,stock,category,image_1,image_2,description,tags
```

Allowed `action` values:

- `publish`
- `unpublish`
- `update`
- `delete`

Common status mappings:

| Generic | Shopify | WooCommerce | Meaning |
| --- | --- | --- | --- |
| online | active | publish | Visible and sellable |
| offline | draft | draft | Hidden or not yet listed |
| archived | archived | private | Removed from normal sale flow |

Rules:

- Keep SKU unique.
- Preserve `current_status` from the platform export.
- Set `target_status` explicitly.
- Do not use blank `target_status` for status-changing actions.
- Put platform-specific fields after the common columns.
