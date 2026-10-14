# Zero Incident — How we protect sign-in and passwords

*Client note · release 1.8.2 · 8 October 2026*

## 1. Passwords are never stored as words

Every password in the system is stored as a **one-way cryptographic hash** (the [scrypt](https://en.wikipedia.org/wiki/Scrypt) algorithm, with the OWASP-recommended work factors N=32768, r=8, p=3). A hash can be *checked* but not *read back*: given the stored value, the original password cannot be recovered.

The real stored value for the demo account `anisha.g` (password `DemoOnly!2026`), taken from the live demo database:

```
scrypt$32768$8$3$93a5c75e41a12da131be31c6cda2972f$18349c0ce979bb286a18760ff53cb77c3716bdee679ec70503b5d69bedf40b4fb783a16f2c80f1a6ddf917a523636b092052c5ea15d1c7e20401973a0c435e5d
```

How to read that line (it describes itself):

| Part | Meaning |
|---|---|
| `scrypt` | the hashing algorithm used |
| `32768 / 8 / 3` | the work factors (how deliberately slow and memory-hungry the hash is — OWASP-recommended) |
| `93a5c75e…2972f` | a **random 16-byte salt**, different for every account — two identical passwords hash to different values |
| `18349c0c…5e5d` | the 64-byte hash of *password + salt* |

Note the original password appears **nowhere** in the value. The schema marks the field `select: false`, so even a normal database query does not return it; only the sign-in checker (and the administrator's "Employee overview" screen, added in this release) can read it.

Other password protections:

- **Password policy** enforced on every create/reset: 8–128 characters, at least one uppercase letter and one number.
- **Constant-time comparison** when checking a password — the check takes the same time whatever is typed, so attackers cannot learn information from response speed.
- **Unknown-username protection**: a sign-in attempt with an unknown username still runs a full hash computation (against a dummy value), so timing does not reveal which usernames exist.
- **Temporary passwords** are generated strong, shown exactly once, and immediately replaced by a hash — the server never keeps them.

## 2. Sessions

- Server-side sessions stored in the database with an **8-hour expiry**; the browser cookie is `HttpOnly` (JavaScript on the page cannot read it) and `SameSite=Lax`.
- The session identifier is **regenerated at sign-in**, so a pre-login session cookie cannot be reused after authentication.
- The server keeps a **session version** per user: resetting a password, deactivating an account or changing security settings **immediately signs the user out everywhere**.

## 3. Request forgery and abuse

- **CSRF tokens**: every state-changing API call (sign-in, password change, employee edits, certificate issuance…) must carry a per-session token; requests without it are rejected. This stops forged requests from other websites.
- **Rate limiting** on the API (600 requests / 15 minutes) blocks brute-force sign-in attempts and general abuse.
- **Payload limits** (32 KB) and strict server-side validation of every input.

## 4. Browser-side protections (security headers)

Set on every response by `helmet`:

- **Content-Security-Policy** — `default-src 'self'`: the page may only load its own scripts, styles, images and fonts (with the documented exceptions for the 3D game engine). External script injection is blocked.
- **X-Frame-Options: DENY** in production — the site cannot be embedded in a frame (clickjacking protection).
- No object plugins, no cross-origin resource confusion, and API responses are marked `Cache-Control: no-store` so signed-in data is not written to caches.

## 5. Account operations are logged

Administrator actions (registering, editing, resetting, deactivating or deleting an account, issuing certificates) are written to a **server-side audit log** with the acting user and the time.

## 6. See it live in the demo

**In the application**

1. Sign in as the administrator (`safety.admin`).
2. Open **Manage employees** and click any employee.
3. The **Employee overview** shows a *Password storage — hash only* block with the exact value stored for that account, plus the algorithm, work factors and salt.

**Straight from the database**

With the app stopped (Ctrl+C in its terminal), run:

```
node scripts/show-password-hashes.mjs
```

It prints the exact stored value for every account in the `users` collection (then start the app again with `npm start`). In a production deployment pointing at a real MongoDB, the same query — `db.users.find({}, {passwordHash: 1})` in `mongosh` — shows the same stored format.

Compare the output with the known demo password: the word itself is nowhere to be seen.

---

*Environment note: this is a development prototype. For a production deployment the same protections apply, plus HTTPS everywhere (the session cookie switches to `Secure` automatically), a strong `SESSION_SECRET`, and a private MongoDB instance with restricted network access — see the production configuration block in the README.*
