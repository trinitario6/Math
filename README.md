# Kids Math — Division Practice PWA

A gamified, iOS-aesthetic division practice tracker. Built as a fully offline Progressive Web App.

## 🎮 Gamification Features

- **XP System** — earn XP per correct answer, bonus for combos and perfect runs
- **XP Levels** — 10+ levels with progress bar (100 → 4000+ XP thresholds)
- **Combo Streaks** — consecutive correct answers multiply XP rewards
- **Hearts** — 3 lives per session, lost on wrong answers
- **10 Achievements** — First Right, On Fire, Perfect Run, Speed Demon, Scholar, and more
- **Daily Streak** — 🔥 fire badge for consecutive days practiced
- **Level-Up Modal** — celebration popup when you gain an XP level

## 📊 Practice Features

- 4 difficulty levels (Starter → Master)
- 20 questions per section (A–H per level)
- Live stopwatch timer
- Large touch numpad
- Instant correct/wrong animations (spring pop, shake)
- Accuracy %, score, and XP earned live per section
- Per-question answer review on results screen
- Confetti on 80%+ accuracy

## 📈 Progress Tracking

- **Trend chart** — accuracy, time, or score over all sessions (canvas-drawn, no deps)
- **Session history** — every session with date, time, accuracy
- **Best records** — fastest time and best accuracy per level

## 🚀 Deploy to GitHub Pages

1. Push all files to your repo root on `main` branch
2. **Settings → Pages → Source: main / root**
3. Visit `https://yourusername.github.io/your-repo/`
4. **Add to Home Screen** on iPhone: Share → Add to Home Screen

## 📁 File Structure

```
/
├── index.html       App shell & all screens
├── manifest.json    PWA manifest
├── sw.js            Service Worker (offline cache)
├── css/style.css    iOS gamified design system
├── js/app.js        App logic + gamification engine
└── icons/           PWA icons (192 & 512px)
```

## 🔧 Customise

Edit `LEVELS` in `js/app.js` to change divisor ranges, or `ACHIEVEMENTS` to add new badges.

MIT License — free for personal and educational use.
