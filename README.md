# CineScope

A movie and TV discovery site built with React, Vite and the [TMDB API](https://developer.themoviedb.org/). CineScope is an independent school project and is not affiliated with TMDB.

**Status:** the code was written without being able to run `npm install`, so it has **not been built or tested yet**. Run the commands below and fix anything that shows up.

## Run it

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# edit .env and paste your token
npm run dev               # opens http://localhost:5173
npm run build             # production build
npm test                  # unit tests for watchlist and helpers
```

Requires Node 18 or newer.

## TMDB token

1. Create a free account at https://www.themoviedb.org/signup
2. Go to Settings → API and request a key, then copy the **API Read Access Token** (the long one).
3. Put it in `.env`: `VITE_TMDB_READ_ACCESS_TOKEN=your_token`
4. Restart `npm run dev`.

Without a token the site still loads and shows these setup steps. The token is bundled into browser code, so this approach is only for a local school prototype. Never commit `.env`.

## Features

- Home with a trending hero and rows: Trending, Popular, Top Rated, Popular TV, Upcoming, Recommended For You (based on the genres you save most)
- Movies and TV pages with genre filters, sorting (popularity, rating, newest) and Load more
- Trending page with All / Movies / TV tabs
- Search (Enter to submit, clear button, movies + TV, people ignored)
- Detail pages: backdrop, cast, director/creator, trailer, real TMDB reviews with Read more, recommendations
- Watchlist saved in localStorage, with a two-step "Clear watchlist"

## Structure

```
src/
  main.jsx, App.jsx        routes
  components.jsx           navbar, footer, cards, states
  pages.jsx                all pages
  utils/tmdb.js            API client (auth, errors, images)
  utils/media.js           data helpers
  utils/watchlist.js       localStorage watchlist
  hooks/                   useFetch, usePaged, useWatchlist, ...
tests/                     vitest tests
```

## Credits

This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
The footer shows this notice with a text link to TMDB. If your teacher requires the official TMDB logo, download it from https://www.themoviedb.org/about/logos-attribution and add it to the footer.

Direct links such as `/movie/123` work in `npm run dev` and `npm run preview`. If you deploy the build, configure your host to serve `index.html` for all routes.

## Publish on GitHub Pages (no install needed, works without admin rights)

GitHub builds the site for you, so nothing has to be installed on your computer.

1. Create a new **public** repository on github.com (for example `cinescope`).
2. Click **Add file → Upload files** and drag in the *contents* of this project folder
   (including the hidden `.github` folder, `src`, `public`, `package.json`, `index.html`, ...). Commit to `main`.
   If the web uploader skips `.github`, create the file `.github/workflows/deploy.yml` by hand with **Add file → Create new file** and paste its contents.
3. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. Open the **Actions** tab and wait for "Deploy to GitHub Pages" to turn green (about 1–2 minutes).
5. Your site is at `https://<your-username>.github.io/<repo-name>/`.
6. On first visit the site shows a box: paste your TMDB **API Read Access Token** and click Save.
   It is stored only in your browser, so it is never in the repository.

Links look like `.../#/movie/123` (hash routing) so refreshing and sharing links work on GitHub Pages.

## Windows without admin rights

- To only publish on GitHub Pages: use the steps above, no Node.js needed.
- To run locally: download the **Windows Binary (.zip)** from https://nodejs.org/en/download, unzip it into your user folder
  (for example `C:\Users\you\node`), then in PowerShell:
  ```powershell
  $env:Path = "C:\Users\you\node;" + $env:Path
  npm install
  npm run dev
  ```
  You can paste your token in the page, so no `.env` file is needed.
