# Device Authorization az Edge-hez — Terv

## Jelenlegi helyzet

### Hogyan működik most az edge autentikáció

```
┌─────────┐                          ┌─────────┐
│  Edge    │  1. API key (kézi input) │ Backend │
│  (CLI)   │ ──────────────────────── │         │
│          │  2. GET /apikey/validate  │         │
│          │ ──────────────────────── │         │
│          │  3. { valid, userId }    │         │
│          │ ◄─────────────────────── │         │
│          │  4. WS connect           │         │
│          │    (subprotocol=apiKey)  │         │
│          │ ──────────────────────── │         │
└─────────┘                          └─────────┘
```

**Fájlok:**
- `bun/src/edge.ts:118-148` — `ensureApiKey()`: validálja vagy interaktívan bekéri
- `bun/src/api.ts:41-62` — `validateApiKey()`: REST hívás `x-api-key` headerrel
- `bun/src/config.ts` — `--api-key` / `TODOFORAI_API_KEY` env var
- `bun/src/index.ts:60-62` — startup: `loadConfig()` → `ensureApiKey()` → `start()`

### Jelenlegi megoldás problémái

| Probléma | Részletek |
|----------|-----------|
| **Rossz UX** | A user-nek manuálisan kell átmásolnia az API key-t a weboldalról (`/apikey`) a terminálba |
| **Nincs perzisztencia** | Újraindításnál újra kell adni a key-t (hacsak nincs env var) |
| **Nincs revoke feedback** | Ha a user revoke-olja a key-t a weben, az edge csak a következő WS reconnect-nél veszi észre |
| **Nem TTY = halott** | Ha nincs terminál (pl. systemd service, Docker, sidecar), és nincs env var → `process.exit(1)` |
| **Nincs multi-device mgmt** | Nem látszik a weben, melyik device milyen key-t használ; generic key nevek |

---

## Miért a CLI flow és nem a Desktop auth flow?

A backend **két** device auth flow-t tartalmaz:

| | Desktop/Tauri flow | CLI flow |
|---|---|---|
| **Fájl** | `../backend/src/api/rest/routes/desktopAuthRoutes.ts` | `../backend/src/trpc/routers/cli.ts` |
| **Végeredmény** | Better Auth session (OTT token) | **API key** |
| **Biztonság** | nonce + secret (erősebb) | csak code (de 160-bit entropy) |
| **Edge kompatibilitás** | Session kezelést igényelne | **Natívan illeszkedik** (REST: `x-api-key`, WS: subprotocol) |

**Döntés: CLI flow**, mert az edge teljes auth modellje API key alapú. A desktop flow session-t ad, amit az edge nem tud használni a jelenlegi WS/REST auth-hoz.

### Új flow

```
┌─────────┐                          ┌─────────┐                    ┌──────────┐
│  Edge    │  1. POST /cli/login/init │ Backend │                    │ Browser  │
│  (CLI)   │ ──────────────────────── │         │                    │ (user)   │
│          │  { code, url, expiresIn }│         │                    │          │
│          │ ◄─────────────────────── │         │                    │          │
│          │                          │         │                    │          │
│          │  2. Megnyitja a böngészőt: url     │                    │          │
│          │ ─────────────────────────────────────────────────────── │          │
│          │                          │         │  3. User "Approve" │          │
│          │                          │         │ ◄────────────────── │          │
│          │                          │         │  (protectedProc)   │          │
│          │  4. Poll GET /cli/login/poll       │                    │          │
│          │ ──────────────────────── │         │                    │          │
│          │  { status: "pending" }   │         │                    │          │
│          │ ◄─────────────────────── │         │                    │          │
│          │  ...poll (3s interval)   │         │                    │          │
│          │  { status: "complete",   │         │                    │          │
│          │    apiKey: "xxx" }       │         │                    │          │
│          │ ◄─────────────────────── │         │                    │          │
│          │                          │         │                    │          │
│          │  5. Mentés + WS connect  │         │                    │          │
│          │ ──────────────────────── │         │                    │          │
└─────────┘                          └─────────┘                    └──────────┘
```

---

## Implementációs terv

### MVP (Fázis 1): Edge kliens oldal — csak edge repo változások

**Becsült effort: ~4-6 óra** (production quality)

A backend CLI login endpoint-ok (`/api/v1/cli/login/init`, `/api/v1/cli/login/poll`) már léteznek és működnek.

#### 1.1 API client bővítés — `bun/src/api.ts`

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

#### 1.2 Credential perzisztálás — `bun/src/credentials.ts` (új fájl)

```typescript
// Per-server credential fájlok (nem egy nagy JSON, hanem server-enként külön):
// ~/.todoforai/credentials/<sha256(apiUrl)>.json
// Tartalom: { "apiUrl": "...", "apiKey": "...", "createdAt": "..." }

export function loadSavedApiKey(apiUrl: string): string | null { ... }
export function saveApiKey(apiUrl: string, apiKey: string): void { ... }
export function clearApiKey(apiUrl: string): void { ... }
```

**Biztonsági követelmények:**
- `~/.todoforai/` dir: `0700`
- `~/.todoforai/credentials/` dir: `0700`
- Credential fájlok: `0600`
- Atomic write: temp file + rename (nem truncate+write)
- Soha ne logoljuk a raw API key-t

#### 1.3 Device login flow — `bun/src/edge.ts` `ensureApiKey()` bővítés

```
Auth prioritás sorrend:

1. --api-key CLI flag / TODOFORAI_API_KEY env var → validate
2. Mentett credential (~/.todoforai/credentials/) → validate
   - Ha invalid → törlés, tovább a 3. lépésre
3. TTY? → Device login flow:
   a. POST /cli/login/init (clientName = hostname)
   b. Böngésző megnyitás (best-effort) + URL kiírás stdout-ra
   c. Poll /cli/login/poll (3s interval, 10min timeout)
   d. Mentés credential fájlba
4. Nem TTY? → Fail fast:
   "No API key. Set TODOFORAI_API_KEY or run interactively: todoforai-edge --login"
```

#### 1.4 Böngésző megnyitás (best-effort)

```typescript
import { execFile } from 'child_process';

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? ['open', url]
    : process.platform === 'win32' ? ['cmd', '/c', 'start', '', url]
    : ['xdg-open', url];
  execFile(cmd[0], cmd.slice(1), (err) => {
    // Best-effort: ha nem sikerül, a URL már ki van írva stdout-ra
  });
}
```

> **Fontos:** `execFile` (nem `exec`) — nincs shell injection kockázat.
> Mindig kiírjuk a URL-t is, a böngésző nyitás csak kényelmi feature.

### Fázis 2: Key management CLI flags

**Becsült effort: ~1-2 óra**

```bash
todoforai-edge --logout          # törli a mentett key-t
todoforai-edge --login           # kényszerített device login (felülírja a mentett key-t)
```

### Fázis 3: Backend finomítások (ajánlott follow-up)

**Becsült effort: ~2-3 óra**

A jelenlegi CLI router (`../backend/src/trpc/routers/cli.ts`) működik, de javítható:

| Változás | Miért | Fájl |
|----------|-------|------|
| `clientName` felhasználása az API key nevében | Jelenleg ignorálva, a key neve generic `CLI login 2025-01-15` | `cli.ts:72-75` |
| Edge-specifikus key naming | `Edge: <hostname> (2025-01-15)` lenne informatívabb a weben | `cli.ts:72-75` |
| Poll secret hozzáadása (mint a desktop flow-ban) | Erősebb biztonság: code + secret kell a poll-hoz | `cli.ts:84-98` |
| Frontend `/cli-auth` oldal "Edge device" szöveg | UX javítás | frontend repo |

---

## Összehasonlítás

| Szempont | Jelenlegi (API key paste) | Device Auth |
|----------|--------------------------|-------------|
| **UX** | Copy-paste a webről | Egy kattintás a böngészőben |
| **Első indítás** | 4-5 lépés (reg → login → /apikey → copy → paste) | 2 lépés (edge indítás → approve) |
| **Headless/CI** | ✅ `--api-key` / env var | ✅ Ugyanúgy működik fallback-ként |
| **Multi-device** | Nem látszik melyik device melyik key | Minden device saját named key-t kap* |
| **Perzisztencia** | Nincs (újraindításnál újra kell adni) | `~/.todoforai/credentials/` |
| **Backend változás** | — | MVP: **nincs**; polish: kis backend PR |
| **Non-TTY** | `process.exit(1)` | Fail fast + actionable hibaüzenet |
| **Revoked key** | Csendben hal meg | Törlés + újra login flow |

*\* Teljes device naming a Fázis 3 backend változásokkal.*

---

## Fájl-szintű változások összefoglalása

### MVP módosítandó fájlok (edge repo)

| Fájl | Változás | ~Sorok |
|------|----------|--------|
| `bun/src/api.ts` | +`initDeviceLogin()`, +`pollDeviceLogin()` | +15 |
| `bun/src/credentials.ts` | **Új fájl**: load/save/clear credential per server | +50 |
| `bun/src/edge.ts` | `ensureApiKey()` bővítés: saved key → device login → persist | +50 |
| `bun/src/config.ts` | +`--login`, `--logout` flags | +10 |
| `bun/src/index.ts` | `--logout`/`--login` kezelés startup-ban | +15 |

### Nem módosítandó fájlok (MVP)

| Fájl | Miért nem |
|------|-----------|
| `../backend/src/trpc/routers/cli.ts` | Endpoint-ok működnek |
| `../backend/src/api/ws/WebSocketService.ts` | API key auth marad |
| WS kapcsolat logika | Subprotocol auth változatlan |

---

## Kockázatok és megjegyzések

1. **Credential fájl plain text** — Elfogadható kompromisszum (ahogy `~/.docker/config.json`, `~/.npmrc`, `~/.kube/config` is csinálja). OS keychain (`keytar`) natív dependency → bonyolítja a buildet. Később bevezethető.

2. **Poll endpoint biztonsága** — A device code 160-bit entropy (`randomBytes(16).toString('hex')`), ami elég erős. De a desktop flow-val ellentétben nincs külön secret. Fázis 3-ban érdemes hozzáadni.

3. **Frontend `/cli-auth` approve page** — Már létezik, nem kell új frontend oldal. Tesztelni kell, hogy edge kontextusban is jó-e az UX.

4. **Visszafelé kompatibilis** — `--api-key` és `TODOFORAI_API_KEY` továbbra is elsőbbséget élvez. Device auth csak fallback ha nincs explicit key.

5. **Non-TTY viselkedés** — Device auth NEM indul el automatikusan non-TTY módban. Explicit `--login` flag kell hozzá, vagy env var/CLI key. Ez megakadályozza, hogy háttérszolgáltatások végtelen poll-ciklusba kerüljenek.

6. **API key rotáció/expiry** — A device auth önmagában nem old meg key expiry-t. A backend API key-ek továbbra is long-lived. Ez egy külön feature lenne.

---

## Konklúzió

**Egyszerű bevezetni.** A backend CLI login infrastruktúra kész. Az edge oldalon ~140 sor kód (MVP), ~4-6 óra munka. Nincs backend deploy szükséges az MVP-hez.

A legnagyobb nyereség az **UX**: `todoforai-edge` → böngésző approve → kész. Iparági standard pattern (`gh auth login`, `gcloud auth login`, `az login`, `stripe login`).

**Ajánlott sorrend:**
1. **MVP** (edge-only): device login + credential persistence → azonnal használható
2. **Polish** (backend PR): device naming + poll secret → jobb biztonság és management
3. **Later**: key rotation/expiry, OS keychain integration
