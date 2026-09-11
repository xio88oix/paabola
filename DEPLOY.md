# Deploying Paabola to the Synology NAS

Target: **https://epl.eusoof.com**, behind Cloudflare Access, served by the
existing `nas-tunnel` Cloudflare Tunnel. Mirrors the `siglulutamu` (f1picks)
deployment, with one difference: **paabola runs on host port 3001** because
f1picks already owns host port 3000.

```
Users (email OTP via Cloudflare Access)
        ↓
Cloudflare  ── f1.eusoof.com ──┐
            ── epl.eusoof.com ─┤
        ↓                      │
Cloudflare Tunnel "nas-tunnel" │  (no open router ports)
        ↓                      │
Synology NAS (192.168.1.57)    │
  ├── f1picks  → host :3000 ───┘
  └── paabola  → host :3001
```

Everything below is free: Cloudflare Tunnel is free, Access is free to 50 users.

---

## Part 0 — Already done for you (no action needed)

These were verified/fixed locally before you start:

| Item                                                                             | Status                                  |
| -------------------------------------------------------------------------------- | --------------------------------------- |
| All work merged to `main`, pushed to `origin`                                    | ✅ clean, no unmerged branches          |
| `Dockerfile` (node:22-alpine, better-sqlite3 build deps, migrate → seed → start) | ✅ correct                              |
| `docker-compose.yml` host port                                                   | ⚠️ **changed 3000 → 3001** (see Part 1) |
| `./data:/app/data` volume, `DATABASE_URL=file:/app/data/paabola.db`              | ✅ correct                              |
| `next.config.ts` `serverExternalPackages: ["better-sqlite3"]`                    | ✅ correct                              |
| `force-dynamic` on DB-querying pages (`/admin`, `/leaderboard`, TRMNL route)     | ✅ correct                              |
| `.gitignore` now excludes `*.txt` (your notes files hold live secrets)           | ✅ added                                |

---

## Part 1 — Push the port fix to GitHub

On your Mac:

```bash
cd ~/Development/paabola
git add docker-compose.yml .env.example .gitignore DEPLOY.md
git commit -m "Deploy to NAS on host port 3001; add deployment runbook"
git push
```

> The two `.txt` note files stay local and untracked — they contain live
> secrets. See **Part 8**.

---

## Part 2 — Deploy the container on the NAS

SSH in from your Mac:

```bash
ssh mseusoof@192.168.1.57
```

Clone into its own folder (alongside `f1picks`):

```bash
mkdir -p /volume1/docker/paabola
cd /volume1/docker/paabola
git clone https://github.com/xio88oix/paabola.git .
```

Create the `.env` file. Paabola needs **three** values (f1picks only needed one):

```bash
cat > .env << 'EOF'
NEXTAUTH_SECRET=PASTE_GENERATED_SECRET_HERE
NEXTAUTH_URL=https://epl.eusoof.com
FOOTBALL_DATA_TOKEN=6ba7a6f43c3d4dd4895776edfe138cc4
EOF
```

Generate the secret and drop it in:

```bash
sed -i "s|PASTE_GENERATED_SECRET_HERE|$(openssl rand -base64 32)|" .env
cat .env   # confirm it looks right
```

- **`NEXTAUTH_URL` must be the public https URL**, not the NAS IP. Login
  redirects break if this is wrong.
- **`FOOTBALL_DATA_TOKEN`** — free key from
  https://www.football-data.org/client/register. Needed only for Admin →
  Schedule "Import season" / "Sync results". Leave blank to set up later.

Build and start (DSM 7.1 uses the hyphenated `docker-compose`):

```bash
sudo docker-compose up -d --build
```

First build takes several minutes — it compiles `better-sqlite3` natively.

Verify:

```bash
sudo docker ps                      # expect 0.0.0.0:3001->3000/tcp
curl -I http://localhost:3001       # expect a 307 redirect to /login
```

On first start the container runs `prisma migrate deploy`, then
`prisma/seed-if-empty.mjs` — which seeds **only if the User table is empty**.
Restarting or rebuilding later will never wipe your data; the DB lives in
`/volume1/docker/paabola/data/paabola.db` on the NAS.

---

## Part 3 — Add epl.eusoof.com to the Cloudflare Tunnel

The `nas-tunnel` tunnel (ID `93d6fb41-92d7-4aa3-833a-6d983cd57c3e`) already
exists and already serves f1. You are **adding a second ingress rule**, not
creating a new tunnel.

### 3a. Find which config file is actually live

Your notes show two candidates. Check both:

```bash
sudo cat /etc/cloudflared/config.yml
sudo cat /volume1/docker/cloudflared/.cloudflared/config.yml
```

Also check how the tunnel is running:

```bash
ps aux | grep cloudflared
sudo systemctl status cloudflared 2>/dev/null
```

**Settled on this NAS (checked 2026-09-11):**

- `nas-tunnel` is a **locally configured** tunnel — the Zero Trust dashboard
  says so outright and offers only a Migrate button. So
  **`/etc/cloudflared/config.yml` is the live config**, even though the systemd
  service also passes `--token`. → Use **3b**, not 3c.
- **Do not accept the Migrate offer.** It is irreversible and buys nothing when
  you already have SSH access to the file.
- A **second, stray cloudflared** was running as user `mseusoof` from
  `/volume1/docker/cloudflared/.cloudflared/config.yml` — a leftover from the
  manual `nohup` runs, now killed. See 3a-bis.

Confirm for yourself:

```bash
sudo cloudflared tunnel info nas-tunnel   # expect exactly ONE connector row
```

Zero Trust → Networks → Tunnels → nas-tunnel: "cannot be managed from the Zero
Trust dashboard as it is a locally configured tunnel" confirms local mode. A
populated **Public Hostnames** tab instead would mean remotely-managed (3c).

### 3a-bis. Kill any duplicate cloudflared process

Two processes connected to the same tunnel ID register as **two replicas**, and
Cloudflare load-balances requests across them. Everything looks fine while both
configs happen to agree — but add a hostname to only one and roughly half your
requests hit the replica that doesn't know it and return **404**. Intermittent
and painful to diagnose.

```bash
ps aux | grep cloudflared
sudo kill <PID-of-the-non-systemd-one>
ps aux | grep cloudflared   # only the root/systemd process should remain
```

Keep the **systemd** one — it's `enabled`, so it survives a reboot. The manually
launched one does not.

### 3b. Edit the config (file-managed tunnel)

Your existing file has a stale `parabola.eusoof.com` entry. Replace it with
`epl.eusoof.com`:

```bash
sudo tee /etc/cloudflared/config.yml << 'EOF'
tunnel: 93d6fb41-92d7-4aa3-833a-6d983cd57c3e

ingress:
  - hostname: f1.eusoof.com
    service: http://localhost:3000
  - hostname: epl.eusoof.com
    service: http://localhost:3001
  - service: http_status:404
EOF
```

Order matters: the catch-all `http_status:404` must stay last.

### 3c. Alternative: dashboard (only for a remotely-managed tunnel)

Cloudflare dashboard → **Zero Trust → Networks → Tunnels → nas-tunnel →
Configure → Public Hostnames → Add a public hostname**:

- Subdomain: `epl`
- Domain: `eusoof.com`
- Service: `HTTP` → `localhost:3001`

This also creates the DNS record, so you would skip 3d. **Not applicable to this
NAS** — nas-tunnel is locally configured, so this tab isn't available without an
irreversible migration. Recorded here only in case the tunnel is ever migrated.

### 3d. Create the DNS record (file-managed route only)

```bash
sudo cloudflared --origincert /volume1/docker/cloudflared/.cloudflared/cert.pem \
  tunnel route dns nas-tunnel epl.eusoof.com
```

Expect: `INF Added CNAME epl.eusoof.com which will route to this tunnel`.
If it says the record already exists, that's fine.

### 3e. Restart the tunnel

```bash
sudo systemctl restart cloudflared
# or, if you run it manually:
sudo pkill cloudflared
sudo nohup cloudflared --config /etc/cloudflared/config.yml tunnel run \
  > /volume1/docker/cloudflared/tunnel.log 2>&1 &
```

### 3f. Verify — and prove there's only one replica

```bash
curl -I https://epl.eusoof.com

# run this a few times: consistent codes = one replica
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code} " https://epl.eusoof.com; done
```

Alternating between a good code and `404` means a second cloudflared is still
running with different ingress — go back to 3a-bis. Check `tunnel.log` if
nothing responds at all.

---

## Part 4 — GoDaddy: nothing to do ✅

`eusoof.com` already uses Cloudflare nameservers
(`evangeline.ns.cloudflare.com` / `lochlan.ns.cloudflare.com`), set when you
deployed f1. All DNS for `epl.eusoof.com` is created by Cloudflare in Part 3.

**Do not** add any record in GoDaddy — GoDaddy's DNS panel is no longer
authoritative for this domain. Confirm with:

```bash
dig NS eusoof.com +short
```

---

## Part 5 — Cloudflare Access (email gate) ⚠️ read the TRMNL note

### 5a. Create the application

Cloudflare dashboard → **Zero Trust → Access → Applications → Add an
application → Self-hosted**:

- **Application name:** Paabola
- **Subdomain:** `epl` · **Domain:** `eusoof.com`
- **Session duration:** 1 month (fewer re-logins on phones)

**Policy 1 — Allowed Users**

- Action: **Allow**
- Include → **Emails** → add each player's email address (same list as f1 is
  fine; you can also use an Access Group to share one list across both apps).

### 5b. ⚠️ Bypass policy for the TRMNL endpoint — REQUIRED

**Your TRMNL devices cannot log in through Cloudflare Access.** They poll a URL
and have no browser to complete the email one-time-code flow. Without this step,
both devices will show an error screen instead of your scorecard.

Add a **second** Access application (not just a policy — a bypass needs its own
app so the path rule applies):

- Zero Trust → Access → Applications → **Add an application → Self-hosted**
- **Application name:** Paabola TRMNL
- **Subdomain:** `epl` · **Domain:** `eusoof.com` · **Path:** `api/trmnl`
- Policy:
  - Policy name: `TRMNL devices`
  - Action: **Bypass**
  - Include → **Everyone**

Cloudflare evaluates the more specific path first, so `/api/trmnl/*` is public
while the rest of the site stays gated.

This is safe: `/api/trmnl/results` requires a per-user random token
(`?token=tok_...`), returns read-only results data, and accepts no writes. Treat
each token like a password — anyone with the URL sees that player's scorecard.

### 5c. Verify

```bash
curl -I https://epl.eusoof.com                        # → Cloudflare Access login
curl -s "https://epl.eusoof.com/api/trmnl/results?token=BAD" | head -c 200
# → {"error":"Invalid token"}  (JSON, not an Access HTML page)
```

If the second command returns HTML, the bypass isn't applied yet.

---

## Part 6 — First login and season setup

1. Open **https://epl.eusoof.com** → pass the Cloudflare email gate.
2. Log into the app itself with the seeded admin: **`admin` / `password123`**.
   - Cloudflare Access controls _who reaches the site_; the app's own login
     controls _who you are inside it_. Two separate layers.
3. **Change the admin password immediately** (Admin → Users).
4. Admin → Users: create a real account per player, delete/rename the demo
   `alice` / `bob` accounts.
5. Admin → Schedule → **Import season from API** to pull real 2026/27 fixtures.
   - This is **blocked if the season already has picks** (pre-season guard). The
     seeded demo season has picks, so create a **fresh open season** first, then
     import into it.
6. Admin → Scoring: confirm exact-score / correct-result point values (10 / 4).
7. Set the current BetWeek to **active** so players can pick.

---

## Part 7 — TRMNL device setup (2 devices)

Do this once per person. You'll set up **your device** and **one other player's**.

### 7a. Generate the token (in Paabola, as admin)

Admin → **Users** → the player's row → **TRMNL** → **Generate**. Copy the
**Polling URL** shown — it looks like:

```
https://epl.eusoof.com/api/trmnl/results?token=tok_xxxxxxxxxxxx
```

Each player gets their own token. The payload is personalised — it marks that
player's row in the standings and shows their picks.

### 7b. Create the private plugin (in the TRMNL dashboard)

Log in at https://usetrmnl.com with **that device's own account**, then:

1. **Plugins → Private Plugin → Add New**
2. **Strategy:** Polling
3. **Polling URL:** paste that player's URL from 7a
4. **Refresh interval:** 30 minutes (results only change when you sync results
   or complete a BetWeek — polling faster gains nothing)
5. **Markup:** paste the full contents of `trmnl/results.liquid` from this repo
6. **Layout:** `Full`
7. **Save**, then **Force Refresh** to render

### 7c. Add it to the device playlist

TRMNL dashboard → **Playlists** → add the new private plugin → set how long it
displays per rotation. Then press the button on the device (or wait for its next
refresh cycle) to pull the new playlist.

### 7d. Second device

Repeat 7a–7c using the **other player's token**, logged into **their** TRMNL
account. Same Liquid markup, different polling URL. Don't reuse your token —
they'd see your picks highlighted as theirs.

### 7e. Verify before touching the device

```bash
curl -s "https://epl.eusoof.com/api/trmnl/results?token=tok_YOURTOKEN" | python3 -m json.tool
```

Expect JSON with `season`, `week`, `player`, `week_points`, `fixtures[]`,
`standings[]`. If you get `{"error":"Invalid token"}`, regenerate in Admin →
Users. If you get HTML, revisit Part 5b.

**Before any BetWeek is completed** the device shows the latest week's fixtures
with `–` for actual scores — that's expected, not a bug. "No results yet"
appears only if the open season has no BetWeeks at all.

> If you edit the markup in TRMNL's editor, paste it back into
> `trmnl/results.liquid` and commit, so the repo stays the source of truth.

---

## Part 8 — Rotate the exposed secrets 🔐

`siglulutamu-deploy-notes.txt` contains live credentials in plaintext:

| Secret                           | Action                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Cloudflare API token (`yUQXHU…`) | Revoke: My Profile → API Tokens → Delete. It was only needed for the one-time `tunnel login`. |
| Tunnel token (`eyJhIjoiMzM3…`)   | Full control of the tunnel. Rotate if that file was ever shared.                              |
| f1picks `JWT_SECRET`             | Rotate if shared (logs out f1 users once).                                                    |
| `cert.pem` contents              | Cloudflare origin cert — treat as a credential.                                               |

`.gitignore` now blocks `*.txt`, so these won't reach GitHub. Verify:

```bash
git check-ignore -v siglulutamu-deploy-notes.txt paabola.txt
git log --all --oneline -- '*deploy-notes*'   # should print nothing
```

---

## Updating the app later

```bash
ssh mseusoof@192.168.1.57
cd /volume1/docker/paabola
git pull
sudo docker-compose up -d --build
```

Migrations apply automatically on start; your data in `./data` is untouched.

Back up the database any time:

```bash
cp /volume1/docker/paabola/data/paabola.db ~/paabola-backup-$(date +%F).db
```

---

## Troubleshooting

| Symptom                                            | Cause / fix                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `port is already allocated` on `docker-compose up` | Host 3000 is f1picks. Confirm compose says `"3001:3000"` — that's the Part 1 fix; `git pull` on the NAS if you deployed before pushing it. |
| `epl.eusoof.com` returns **404 intermittently** | Two cloudflared processes are connected as replicas of the same tunnel with different ingress. `ps aux \| grep cloudflared`, kill the non-systemd one (Part 3a-bis). |
| Edits to `/etc/cloudflared/config.yml` have no effect | Confirm the tunnel is locally configured (Part 3a). If the dashboard shows a Public Hostnames tab instead, ingress is remote and the file is inert. Also confirm you restarted: `sudo systemctl restart cloudflared`. |
| `epl.eusoof.com` → Cloudflare **error 1033**       | Tunnel isn't running or has no ingress rule for this hostname. Check `ps aux \| grep cloudflared` and `tunnel.log`.                        |
| `epl.eusoof.com` → **502 Bad Gateway**             | Tunnel is up but the container isn't. `sudo docker ps`, then `sudo docker logs <container>`.                                               |
| Login loops back to `/login`, never signs in       | `NEXTAUTH_URL` in `.env` isn't `https://epl.eusoof.com`. Fix and `sudo docker-compose up -d`.                                              |
| TRMNL device shows an error / login screen         | Access bypass for `/api/trmnl` missing — Part 5b.                                                                                          |
| TRMNL shows another player's name highlighted      | Wrong token on that device — regenerate and repaste.                                                                                       |
| `next build` fails prerendering a page             | A new DB-querying server page needs `export const dynamic = "force-dynamic"`.                                                              |
| Admin → Import season refuses to run               | The season already has picks (pre-season-only guard). Create a fresh open season and import into that.                                     |

---

## Checklist

- [ ] Push the port-3001 fix to GitHub (Part 1)
- [ ] Clone to `/volume1/docker/paabola`, write `.env`, `docker-compose up -d --build` (Part 2)
- [ ] `curl -I http://localhost:3001` returns a redirect (Part 2)
- [ ] Kill the stray non-systemd cloudflared process (Part 3a-bis)
- [ ] Add `epl.eusoof.com → localhost:3001` to `/etc/cloudflared/config.yml` (Part 3b)
- [ ] Route DNS and restart the tunnel (Parts 3d, 3e)
- [ ] Confirm consistent responses — no 404 flapping (Part 3f)
- [ ] GoDaddy — confirm nameservers only, change nothing (Part 4)
- [ ] Access app "Paabola" with the allowed-email policy (Part 5a)
- [ ] Access app "Paabola TRMNL" with **Bypass / Everyone** on path `api/trmnl` (Part 5b)
- [ ] Log in, change the admin password, create real users (Part 6)
- [ ] Create a fresh open season and import real fixtures (Part 6)
- [ ] Generate a TRMNL token per player; set up both devices (Part 7)
- [ ] Revoke the exposed Cloudflare API token (Part 8)
