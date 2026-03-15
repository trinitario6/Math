# DivisionPro — Kumon Division Tracker PWA

A standalone, offline-capable Progressive Web App for Kumon-style division practice. Built for touch screens with live scoring, stopwatch timing, and trend analytics.

## Features

- **4 Difficulty Levels**: Starter → Master (divisors 1–12)
- **20 questions per section**, sections A–H per level
- **Stopwatch timer** — tracks total time per section
- **Touch numpad** — large buttons, tap to enter answers
- **Instant feedback** — correct/wrong with colour animation
- **Live score bar** — score, accuracy %, and progress fill
- **Results review** — see every question with your answer
- **Trend chart** — accuracy, time, and score over sessions
- **Session history** — date, time, level, accuracy
- **Best records** — fastest time and best accuracy per level
- **100% offline** — works without internet after first load
- **Installable PWA** — add to home screen on iOS/Android

## Deploy to GitHub Pages

1. Fork or clone this repo
2. Push all files to your `main` branch (or `gh-pages`)
3. Go to **Settings → Pages** → Source: `main` / `root`
4. Your app will be live at `https://yourusername.github.io/repo-name/`

> ⚠️ The Service Worker requires HTTPS — GitHub Pages provides this automatically.

## Project Structure

```
/
├── index.html          # Main app shell
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (offline cache)
├── css/
│   └── style.css       # All styles
├── js/
│   └── app.js          # App logic, scoring, storage, charts
└── icons/
    ├── icon-192.png    # PWA icon
    └── icon-512.png    # PWA icon
```

## Data Storage

All session data is stored in `localStorage` — no server, no account needed. Data persists across sessions on the same device/browser. Use the **Clear** button in Progress to reset.

## Adding to Home Screen

- **iOS Safari**: Share → Add to Home Screen
- **Android Chrome**: Menu (⋮) → Add to Home Screen
- **Desktop Chrome**: Install icon in address bar

## Customising Levels

Edit `LEVELS` in `js/app.js`:

```js
const LEVELS = {
  1: { name: 'Starter', divisors: [1,2,3], maxDividend: 30 },
  // add more levels here
};
```

## License

MIT — free for personal and educational use.
