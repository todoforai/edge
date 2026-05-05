# Plan: Meta Ads CLI hozzáadása a tool catalog-hoz — DONE

## Cél
Meta Ads CLI (`meta-ads` PyPI) felvétele a `tool_catalog.json`-ba. Csak CLI, MCP nem kell.

## Tényadatok (verifikálva, meta-ads 1.0.1)
- **Csomag**: `meta-ads` (PyPI 1.0.1, 1.0.0), `pip install meta-ads`
- **Bináris név**: `meta`
- **Auth**: **env var alapú** — `ACCESS_TOKEN` + `AD_ACCOUNT_ID` (act_…), opcionálisan `BUSINESS_ID`. **Nincs OAuth login flow**, nincs `meta auth login`, nincs credential fájl.
- **Auth parancsok**: csak `meta auth status` (exit 0 = auth, exit 3 = "Not authenticated. Set the ACCESS_TOKEN environment variable.")
- **Top-level**: `meta ads {campaign,adset,ad,adaccount,creative,catalog,product-feed,product-set,product-item,dataset,page,insights} ...`, output `-o table|json|plain`
- **Kategória**: `marketing`

## Eltérés az eredeti plan-től
A plan OAuth-ot és `meta auth login` / `meta accounts list` / `~/.config/meta/credentials.json`-t feltételezett — a kiadott CLI ebben a verzióban **nem** ezt csinálja, csak env var-okat olvas. Ezért:
- `loginCmd` **nincs**
- `credentialPaths` **nincs**
- `description` az env var alapú beállítást magyarázza

## Megvalósított entry (`packages/shared-fbe/src/tool_catalog.json:85`)

```json
"meta-ads": {
  "category": "marketing",
  "pkg": "meta-ads",
  "installer": "pip",
  "label": "Meta Ads",
  "statusCmd": "meta auth status 2>&1",
  "capabilities": "Meta/Facebook & Instagram ad campaigns: campaigns/adsets/ads CRUD, insights & reporting, catalog/product-feed/product-set/product-item, ad creatives, datasets (pixels), pages — Marketing API via the official `meta` CLI.",
  "description": "Auth via env vars (no login command): set ACCESS_TOKEN (Meta Marketing API user/system token) and AD_ACCOUNT_ID (e.g. act_123456); optionally BUSINESS_ID for dataset commands. Verify with `meta auth status`. Examples: `meta ads campaign list`, `meta ads insights get --date-preset last_7d`, `meta ads adset get 123456 --output json`. Output: table|json|plain via `-o`.",
  "versionCmd": "meta --version 2>/dev/null | head -1"
}
```

## Érintett fájlok
- `packages/shared-fbe/src/tool_catalog.json` — +10 sor, `apollo-api` után
- `edge/bun/src/tool-catalog.ts` — érintetlen (pip installer-hez nem kell `BINARY_URL_FUNCS`)

## Hátralévő (követő) lépések
- Build & restart: `bun` rebuild a shared-fbe re-export miatt, `pm2 restart edge`
- Smoke test: edge UI-n `marketing` kategóriában megjelenik-e, `pip install meta-ads` lefut-e, `meta auth status` helyesen jelzi-e a state-et `ACCESS_TOKEN` set/unset esetén
- Ha jövőbeli verzió bevezet OAuth-ot: `loginCmd` + `credentialPaths` pótolható

## Nem érintett (szándékosan)
- MCP server endpoint (`https://mcp.facebook.com/ads`) — bináris/CLI-alapú a rendszer
- Brixon-Group/attainmentlabs verziók — nem hivatalosak

## MCP — csak referenciaként (nem integráljuk)
Ha mégis kódminta / tool-séma kéne, itt találunk:
- **Hivatalos endpoint**: `https://mcp.facebook.com/ads` (Meta MCP server, ugyanaz a 29 tool mint a CLI-ben)
- **Hivatalos Meta docs**: https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/
- **PyPI**: `meta-ads-mcp` — open-source MCP wrapper, kódbázisként hasznos lehet ha CLI-ben hiányzik valami
- **GitHub**: `pipeboard-co/meta-ads-mcp` — közösségi MCP impl., példákhoz / tool-leírásokhoz jó
- A rendszerünk binárisokra/CLI-kre épül, így ezeket csak inspirációnak használjuk, nem integráljuk.
