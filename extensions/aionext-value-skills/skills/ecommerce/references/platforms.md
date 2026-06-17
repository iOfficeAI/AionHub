# Platform Notes

## Shopify

- Product `status`: `active`, `draft`, `archived`.
- Publication channels can hide an active product from a specific sales channel.
- Inventory tracking is variant-level.

## WooCommerce

- Product `status`: `publish`, `draft`, `private`.
- Stock status can be independent from publish status.
- CSV import supports updating by SKU.

## Marketplace Feeds

Amazon, eBay, and many regional marketplaces use feed files with asynchronous validation. Always keep the feed submission result and rejected row file.

## China Platforms

Taobao, JD, Pinduoduo, Douyin, and Kuaishou stores often require category-specific attributes, image compliance checks, and manual review. Treat generic CSV output as a staging artifact unless a platform-specific connector is configured.
