# JokerOut QR Rush

Solo kiosk game for concert visitors. Players scan a moving QR code and receive positive "be present" messages after each catch.

Live site:

- https://logout-boris.github.io/jokerout/

## Event Setup (3 minutes)

1. Open the live URL on kiosk laptop/tablet.
2. Go to `Solo kiosk`.
3. Set `QR Base URL` to:
   - `https://logout-boris.github.io/jokerout/`
4. Press `Start game 30s`.
5. Visitors scan the moving QR code from their phones.

## Gameplay

- 30 second rounds
- Moving "monster frame" QR target
- Visual effects on each round
- Positive reinforcement messages after successful scan
- No backend required (static hosting only)

## Local Development

```bash
npm install
npm run dev
```

For phone testing on same Wi-Fi:

```bash
npm run dev -- --host
```

Then open `http://<your-local-ip>:5173/#/solo-kiosk`.

## Build and Deploy

Production build:

```bash
npm run build
```

Deploy to GitHub Pages:

```bash
npm run deploy
```

## Troubleshooting

- Phone cannot open QR link:
  - Check `QR Base URL` value in kiosk screen.
  - Ensure it matches the exact public URL.
- Local Wi-Fi test fails:
  - Use `--host`.
  - Ensure phone and laptop are on same network.
  - Allow Node.js in firewall on private network.
- Page assets broken on Pages:
  - Confirm Vite base path is `/jokerout/` in `vite.config.js`.

## Mission Fit (logout.org)

- Encourages presence over recording
- Short, playful interactions
- Positive digital wellbeing messaging
