# Device Authorization az Edge-hez

## Jelenlegi helyzet

```
User manuálisan copy-paste-eli az API key-t a webről → terminálba.
Nincs perzisztencia, újraindításnál újra kell adni.
```

**Fájlok:**
- `bun/src/edge.ts:118-148` — `ensureApiKey()`: validálja vagy interaktívan bekéri
- `bun/src/api.ts:41-62` — `validateApiKey()`: REST hívás `x-api-key` headerrel
- `bun/src/config.ts` — `--api-key` / `TODOFORAI_API_KEY` env var

### Problémák

- **Rossz UX** — 4-5 lépés: regisztráció → login → /apikey → copy → paste
- **Nincs perzisztencia** — restart = újra kell adni a key-t
- **Nincs multi-device mgmt** — generic key nevek, nem látszik melyik device

---

## Megoldás: CLI login flow újrahasználása

A backend **már tartalmazza** a szükséges endpoint-okat (`../backend/src/trpc/routers/cli.ts`):
- `POST /api/v1/cli/login/init` → `{ code, url, expiresIn }`
- `POST /api/v1/cli/login/approve` → user a böngészőben jóváhagyja (protectedProcedure)
- `GET /api/v1/cli/login/poll` → `{ status: "pending" | "complete" | "expired", apiKey? }`

Végeredmény API key → natívan illeszkedik az edge REST (`x-api-key`) és WS (subprotocol) auth-jához.

### Flow

```
┌─────────┐                          ┌─────────┐                    ┌──────────┐
│  Edge    │  1. POST /cli/login/init │ Backend │                    │ Browser  │
│          │ ──────────────────────── │         │                    │          │
│          │  { code, url }           │         │                    │          │
│          │ ◄─────────────────────── │         │                    │          │
│          │                          │         │                    │          │
│          │  2. open browser: url    │         │                    │          │
│          │ ─────────────────────────────────────────────────────── │          │
│          │                          │         │  3. User "Approve" │          │
│          │                          │         │ ◄────────────────── │          │
│          │  4. Poll (3s interval)   │         │                    │          │
│          │ ──────────────────────── │         │                    │          │
│          │  { status: "complete",   │         │                    │          │
│          │    apiKey: "xxx" }       │         │                    │          │
│          │ ◄─────────────────────── │         │                    │          │
│          │                          │         │                    │          │
│          │  5. Save + WS connect    │         │                    │          │
└─────────┘                          └─────────┘                    └──────────┘
```

---

## Implementáció

### Változások: 2 fájl, ~60 sor

#### `bun/src/api.ts` — +2 metódus (~15 sor)

```typescript
async initDeviceLogin(clientName = 'edge'): Promise<{ code: string; url: string; expiresIn: number }> {
  const res = await fetch(`${this.apiUrl}/api/v1/cli/login/init`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientName }),
  });
  if (!res.ok) throw new Error(`Device login init failed: ${res.status}`);
  return res.json();
}

async pollDeviceLogin(code: string): Promise<{ status: 'pending' | 'complete' | 'expired'; apiKey?: string }> {
  const res = await fetch(`${this.apiUrl}/api/v1/cli/login/poll?code=${code}`);
  if (!res.ok) throw new Error(`Device login poll failed: ${res.status}`);
  return res.json();
}
```

#### `bun/src/edge.ts` — `ensureApiKey()` bővítés (~35 sor)

Auth prioritás:
```
1. --api-key / TODOFORAI_API_KEY env var → validate
2. Mentett key (~/.todoforai/credentials.json) → validate
   - Ha invalid → törlés, tovább
3. Device login:
   a. POST /cli/login/init
   b. Böngésző megnyitás (best-effort) + URL kiírás
   c. Poll (3s interval, 10min timeout)
   d. Mentés credentials.json-be
```

#### `bun/src/config.ts` — credential persistence (~20 sor)

```typescript
// ~/.todoforai/credentials.json — sima JSON map:
// { "https://api.todofor.ai": "sk_xxx", "http://localhost:3000": "sk_yyy" }

export function loadSavedApiKey(apiUrl: string): string | null { ... }
export function saveApiKey(apiUrl: string, apiKey: string): void { ... }
export function clearApiKey(apiUrl: string): void { ... }
```

Dev+prod use case megoldva: server URL a key, több environment-hez több key.

### Nem változik

- **Backend**: CLI endpoint-ok már kész (`../backend/src/trpc/routers/cli.ts`)
- **WS auth**: subprotocol = API key, változatlan
- **`--api-key` / env var**: továbbra is elsőbbséget élvez, device auth csak fallback

---

## Összehasonlítás

| | Jelenlegi | Device Auth |
|---|---|---|
| **Első indítás** | copy-paste webről | `todoforai-edge` → approve → kész |
| **Restart** | újra kell adni | automatikus (saved key) |
| **Headless/CI** | `--api-key` / env var | ugyanúgy működik |
| **Backend deploy** | — | nem kell |

Iparági standard: `gh auth login`, `gcloud auth login`, `stripe login`.
