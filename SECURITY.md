# Security and hosting checklist

This repo is a **static SPA**. It does not include a backend, authentication, or a database, so the main public-web risks are client-side XSS, unsafe outbound links, third-party script supply-chain exposure, and weak hosting headers.

## Client-side hardening already added

- strict `Content-Security-Policy` meta tags in `index.html` and `js/spa.html`
- outbound links restricted to `https:` URLs before opening in a new tab
- `noopener noreferrer` protection on external links
- overlay content escaped before insertion into the DOM
- route metadata frozen at runtime to reduce accidental or malicious mutation
- remote runtime GIF dependency removed so the app no longer loads scripts from a CDN at runtime

## Required for public hosting

Do **not** use `python3 -m http.server` in production. It is only for local preview.

Use a real static host or web server and enforce:

1. **HTTPS only**
2. **HSTS**
3. **CSP as an HTTP response header** (preferred over meta tag)
4. **No directory listing / autoindex**
5. **Referrer-Policy: strict-origin-when-cross-origin**
6. **X-Content-Type-Options: nosniff**
7. **X-Frame-Options: DENY** (or rely on `frame-ancestors 'none'` in CSP)
8. **Permissions-Policy** to disable features you do not use

## Example Nginx headers

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

## Practical note

These changes **significantly harden** the static app, but no one can honestly guarantee a site is "fully safe" without also controlling the final hosting platform, HTTPS setup, and any future third-party scripts or embeds.
