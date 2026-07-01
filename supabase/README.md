# BoostForge — accounts & licensing (Supabase)

This wires up online accounts and subscription-driven Pro, while keeping the
existing offline Ed25519 license keys as the unit of entitlement. Nothing here
weakens the offline model: keys are still signed with the **same private key**
that pairs with the public key embedded in `src-tauri/src/commands/license.rs`,
and the desktop app still verifies every key fully offline.

## How it fits together

```
Website (GitHub Pages, static)            Desktop app (Tauri)
  register / sign in  ─┐                   Settings → Online account
  account.html         │   Supabase Auth      sign in ─┐
                       ▼   (email+password)             ▼
                 ┌─────────────────────────────────────────┐
                 │  Supabase                                │
                 │   • auth.users         (accounts)        │
                 │   • licenses table     (issued keys,RLS) │
                 │   • issue-license      (edge function)   │
                 └─────────────────────────────────────────┘
                       ▲ admin token + private key
   Admin panel (in app: Settings → Admin) ──┘
     email + days → mints a signed Pro key, stores it, returns it
```

- **Free vs Pro parity:** the app now gates Game Mode, Memory optimizer,
  Network latency and Scheduled cleanup behind Pro — matching the website's
  pricing table. Free keeps the live monitor, cleaner, processes/startup and
  the diagnostics toolkit. The 7-day trial unlocks everything.
- **A "subscription"** is simply a non-revoked, unexpired row in `licenses`
  whose `email` matches the account's email.
- **Minting keys** needs the secret signing key, so it only ever happens inside
  the `issue-license` edge function, guarded by an admin token. The private key
  never ships in the app or the website.

## One-time setup

### 1. Create the project
1. Create a Supabase project. From **Project Settings → API** copy:
   - Project URL (`https://xxxx.supabase.co`)
   - `anon` public key
   - `service_role` secret key (used only as a function secret)

### 2. Create the table
Open **SQL Editor**, paste the contents of [`schema.sql`](schema.sql), run it.

### 3. Auth provider
**Authentication → Providers → Email**: enable it. For a smoother first run you
can turn **"Confirm email"** off (users can sign in immediately); leave it on if
you want verified emails (then users must click the confirmation link first).

### 4. Deploy the issuer function
Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Secrets (run from the repo root so the cat path resolves):
#  - ADMIN_TOKEN: pick a long random string; you'll paste it into the app's
#    Admin panel once. Keep it secret.
#  - LICENSE_PRIVATE_KEY: the EXISTING signing key, so old and new keys both
#    validate against the embedded public key.
supabase secrets set ADMIN_TOKEN="$(openssl rand -hex 32)"
supabase secrets set LICENSE_PRIVATE_KEY="$(cat tools/license-private.pem)"

# Deploy. --no-verify-jwt because the function does its own admin-token check.
supabase functions deploy issue-license --no-verify-jwt
```

> On Windows PowerShell, `openssl rand -hex 32` works if Git's openssl is on
> PATH; otherwise pick any long random string. For the key, you can also set it
> via the dashboard (**Edge Functions → issue-license → Secrets**) by pasting
> the full PEM including the `-----BEGIN/END PRIVATE KEY-----` lines.

### 5. Point the desktop app at Supabase
Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Rebuild: `npm run tauri:build`. (Without these, the app still runs fully
offline — the account card and admin panel just stay hidden and manual
key-paste still works.)

### 6. Point the website at Supabase
Edit [`website/config.js`](../website/config.js) and fill in the same URL and
anon key. Re-publish the site to `gh-pages` (see the project notes). The
"Account" link and the "Get Pro" button now lead to `account.html`.

## Day-to-day: giving someone Pro

You pick the duration per customer — 7 / 30 / 90 / 365 days or any number.

**Option A — in-app Admin panel (recommended):**
1. App → **Settings → Admin · Issue license keys**.
2. Paste your `ADMIN_TOKEN` once (remembered locally).
3. Enter the customer's email, choose the number of days, **Generate key**.
4. The key is copied/sent to you *and* saved to that email's account.

**Option B — CLI (offline, no Supabase):** the original tool still works:
```bash
node tools/sign-license.mjs --email user@example.com --tier pro --days 30
```
(CLI keys are valid but aren't stored in any account, so the user must paste
them manually.)

### How the customer activates it
The email you issue to **must match** the email they register with.
- They register at `account.html` (or in the app: Settings → Online account).
- After you issue their key, they either:
  - sign in **in the app** and click **Activate subscription** — it pulls the
    key from their account and activates it automatically; or
  - sign in on `account.html`, copy the key shown there, and paste it into
    Settings → Subscription; or
  - just paste a key you sent them directly.

## Revoking
Set `revoked = true` on the row in the `licenses` table (Table editor). The app
re-checks on next launch / sync; expired or revoked keys fall back to Free.

## Support inbox (owner-only, email + password)

Visitors who are signed in can send a support message from `account.html`. Only
**your** admin account (by email) can read them, enforced by RLS — nobody else
can list the messages even with the public key.

1. **Create the table:** run [`support.sql`](support.sql) in the SQL editor. It
   restricts read/update to the email `miujdonsagok@gmail.com` (change it there
   and in `website/config.js` → `ADMIN_EMAIL` if you use a different address).
2. **Create the admin account** (one-time, via the dashboard so it's confirmed
   instantly — no email/rate-limit involved): **Authentication → Users → Add
   user → Create new user**. Fill in the email and password, and check
   **"Auto Confirm User"** before saving.
3. Open **`support-admin.html`** on the site and sign in with that email +
   password. Any other account is denied and signed out immediately.

## Anti-abuse: one trial per device, a device cap per account

Run [`anti_abuse.sql`](anti_abuse.sql) once in the SQL editor (same as
`schema.sql`/`support.sql`). It adds two tables the client checks on every
sign-in:

- `trial_devices` — the first account to use the free trial on a given
  Windows installation "claims" it; a new email registered later on the same
  PC does not get a fresh trial.
- `account_devices` — caps one account at 3 distinct devices (see
  `MAX_DEVICES_PER_ACCOUNT` in `src/lib/deviceGuard.ts`). A device beyond the
  cap is shown Free regardless of the account's actual subscription — this is
  what "accounts can't be shared" means in practice.

Both are best-effort and fail open on a network error (an honest user is never
locked out because of a hiccup), and both only apply to accounts signed in
through the app/website — a raw license key pasted directly still validates
fully offline as before, by design.

## Registration is required

As of the app version that ships with this backend, `AuthGate` blocks the app
entirely until the visitor signs in or registers — there is no "use it without
an account" path anymore. Sessions persist through the Tauri Store plugin
(see `src/lib/supabase.ts`), so this only appears once per install unless the
user explicitly signs out.

## Free trial

The free trial is now **1 day, counted from the account's registration date**
(handled in the client from the Supabase account's `created_at`). There is no
longer a per-install local trial. Non-registered users are Free; registering
grants the 1-day Pro window.

## Future: automatic payments
To make Pro self-serve, add a Stripe Payment Link and a webhook that calls
`issue-license` on `checkout.session.completed`. Set the real link as `BUY_URL`
in `website/i18n.js` and it takes over the "Get Pro" button automatically.
