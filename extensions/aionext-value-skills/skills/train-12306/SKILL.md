---
name: "12306"
description: Query China Railway 12306 for train schedules, remaining tickets, and station info. Use when user asks about train/高铁/火车 tickets, schedules, or availability within China.
metadata: {"openclaw":{"emoji":"🚄","requires":{"bins":["node"]}}}
---

# 12306 Train Query

Query train schedules and remaining tickets from China Railway 12306.

## Query Tickets

```bash
node {baseDir}/scripts/query.mjs <from> <to> [options]
```

- HTML mode (default): writes file, prints path to stdout
- Markdown mode (`-f md`): prints table to stdout

### Examples

```bash
# All trains from Beijing to Shanghai (defaults to today)
node {baseDir}/scripts/query.mjs 北京 上海

# Markdown table output (to stdout, good for chat)
node {baseDir}/scripts/query.mjs 北京 上海 -t G -f md

# Morning departures, 2h max, with second class available
node {baseDir}/scripts/query.mjs 上海 杭州 -t G --depart 06:00-12:00 --max-duration 1h --seat ze

# Only bookable trains arriving before 6pm
node {baseDir}/scripts/query.mjs 深圳 长沙 --available --arrive -18:00

# Custom output path
node {baseDir}/scripts/query.mjs 广州 武汉 -o /tmp/tickets.html

# JSON output (to stdout)
node {baseDir}/scripts/query.mjs 广州 武汉 --json
```

### Options

- `-d, --date <YYYY-MM-DD>`: Travel date (default: today)
- `-t, --type <G|D|Z|T|K>`: Filter train types (combinable, e.g. `GD`)
- `--depart <HH:MM-HH:MM>`: Depart time range (e.g. `08:00-12:00`, `18:00-`)
- `--arrive <HH:MM-HH:MM>`: Arrive time range (e.g. `-18:00`, `14:00-20:00`)
- `--max-duration <duration>`: Max travel time (e.g. `2h`, `90m`, `1h30m`)
- `--available`: Only show bookable trains
- `--seat <types>`: Only show trains with tickets for given seat types (comma-separated: `swz,zy,ze,rw,dw,yw,yz,wz`)
- `-f, --format <html|md>`: Output format — `html` (default, saves file) or `md` (markdown table to stdout)
- `-o, --output <path>`: Output file path, html mode only (default: `{baseDir}/data/<from>-<to>-<date>.html`)
- `--json`: Output raw JSON to stdout

### Output Columns

| Column | Meaning |
|--------|---------|
| 商务/特等 | Business class / Premium (swz) |
| 一等座 | First class (zy) |
| 二等座 | Second class (ze) |
| 软卧/动卧 | Soft sleeper / Bullet sleeper (rw/dw) |
| 硬卧 | Hard sleeper (yw) |
| 硬座 | Hard seat (yz) |
| 无座 | Standing (wz) |

Values: number = remaining seats, `有` = available (qty unknown), `—` = not applicable

## Station Lookup

```bash
node {baseDir}/scripts/stations.mjs 杭州
node {baseDir}/scripts/stations.mjs 香港西九龙
```

## Important Notes for AI Assistant

### ⚠️ Station Name Resolution Warning

**CRITICAL**: When querying by city name (e.g., "武汉", "上海", "深圳", "广州"), the API may return trains from/to ANY station in that city, not just the main station.

**Common Pitfalls:**
- **武汉** includes: 武汉站 (main), 汉口站 (Hankou), 武昌站 (Wuchang), 武汉东站
- **上海** includes: 上海虹桥 (Hongqiao), 上海站 (main), 上海南站, 上海松江站
- **深圳** includes: 深圳北站 (main), 深圳站 (Luohu), 福田站, 深圳东站
- **广州** includes: 广州南站 (main), 广州站, 广州东站, 广州北站

**Best Practice - Always verify exact stations:**
1. **First**, use `stations.mjs` to list all stations in the city:
   ```bash
   node {baseDir}/scripts/stations.mjs 武汉
   ```
2. **Then**, query with exact station names for accurate results:
   ```bash
   node {baseDir}/scripts/query.mjs 武汉 上海虹桥 -f md
   ```

### 🔄 Transfer/Connection Guidelines

When planning transfers (中转):
- **Use JSON output** (`--json`) to verify exact station names
- Ensure both segments use the **SAME station** (e.g., both use 武汉站, not 武汉→汉口)
- Recommended minimum transfer time: **20-30 minutes** for same station
- **Different stations** in same city require additional travel time (e.g., 武汉→汉口 = 30+ min by subway)

### 📋 Query Workflow Recommendation

**For accurate results, follow this workflow:**
1. **List stations** in departure city:
   ```bash
   node {baseDir}/scripts/stations.mjs 北京
   ```
2. **List stations** in arrival city:
   ```bash
   node {baseDir}/scripts/stations.mjs 上海
   ```
3. **Query with exact station names** (e.g., 北京南 → 上海虹桥):
   ```bash
   node {baseDir}/scripts/query.mjs 北京南 上海虹桥 -d 2026-03-05 -f md
   ```
4. **For transfers**: Always verify both segments use the same station by checking `fromStation` and `toStation` in JSON output.

## Technical Notes

- Data comes directly from 12306 official API (no key needed)
- Station data is cached for 7 days in `{baseDir}/data/stations.json`
- Works for all train types: G (高铁), D (动车), Z (直达), T (特快), K (快速)

---

_技能来源：https://github.com/kirorab/12306-skill_