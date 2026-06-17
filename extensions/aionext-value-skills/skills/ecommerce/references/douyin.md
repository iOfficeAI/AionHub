# Douyin and Doudian Listing Operations

Use this reference when the user asks for Douyin, Doudian, 抖音电商, 抖店, 本地生活, 团购, 餐饮, 酒旅, or 生活服务 product up/down listing.

## Modes

Use `doudian` for 抖店电商货架商品.

- Launch endpoint path: `/product/launchProduct`
- Offline endpoint path: `/product/setOffline`
- List endpoint path: `/product/listV2`
- Typical identifiers: `product_id`, sometimes SKU/product mapping from an export file
- Required user-side setup: app key, app secret, access token, shop authorization, 商品上下架权限包

Use `goodlife` for 抖音生活服务/团购商品.

- Operate endpoint: `https://open.douyin.com/goodlife/v1/goods/product/operate/`
- `op_type`: `1` online, `2` offline, `3` delete
- Required scope: `life.capacity.goods.found`
- Required user-side setup: client key, client secret, access token, account/shop authorization

## Safety Rules

- Default to dry-run and generate request JSONL.
- Require explicit user confirmation before live execution.
- Never infer delete from missing rows.
- Preserve previous status and target status in the preview.
- For failed rows, keep platform error response and original row data.

## Config

Ask the user to copy `config/douyin-api.config.template.json` to `config/douyin-api.config.json` and fill placeholders:

- `app_key` or `client_key`
- `app_secret` or `client_secret`
- `access_token`
- `shop_id` when used by the store integration
- `operator`

The bundled request builder does not store credentials anywhere else.

## Request Plans

Use examples:

- `examples/douyin-doudian-plan.json`
- `examples/douyin-goodlife-plan.json`

The request builder creates:

- `exports/douyin-api-requests.jsonl`
- `exports/douyin-api-preview.md`

Each JSONL line contains one planned API request with endpoint, action, ids, and payload.
