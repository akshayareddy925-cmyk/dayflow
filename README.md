# DayFlow

A to-do list that shows your tasks on a 24-hour timeline instead of just a
plain list — styled like an airport departures board.

🔗 **Live demo:** _(add your link after deploying)_

## What it does

- Shows your day as a timeline, shaded for actual daylight (using a free
  weather API), with your tasks placed on it so you can see your day at a
  glance.
- Flags outdoor tasks if it's going to rain that day. Just a simple rule,
  not AI.
- Pomodoro timer (25 min work / 5 min break).
- Tracks whether you finish tasks on time + a daily streak.

No login, no backend. Runs fully in the browser.

## Built with

- Plain HTML, CSS, JS — no framework.
- **Open-Meteo** for weather and sunrise/sunset (free, no key needed).
- **Quotable** for a quote in the footer (free, no key). Added a backup
  list of quotes in case that API ever goes down.
- `localStorage` to save your tasks between visits.

## How to run it

Just open `index.html` in your browser. Or run:

```bash
python3 -m http.server 8000
```

and visit `http://localhost:8000`.

## How to deploy

1. Make a new GitHub repo.
2. Upload `index.html`, `style.css`, `app.js`, and this README.
3. Go to Settings → Pages → set Source to `main` branch, `/ (root)` → Save.
4. Wait a minute, then your site is live at
   `https://<your-username>.github.io/<repo-name>/`.
5. Open the live link yourself and test it before submitting.

```bash
git init
git add .
git commit -m "DayFlow: daily productivity departures board"
git branch -M main
git remote add origin https://github.com/<your-username>/dayflow.git
git push -u origin main
```

## Notes

- The "smart" flag is just a simple rule, not real AI — being upfront
  about that.
- Quote API reliability wasn't fully tested, hence the backup list.
- Data is saved per-browser only, not synced across devices.