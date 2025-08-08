# node--strider-website-graph

A static D3.js force-directed graph to visualize tag relationships with pan/zoom/drag and tag-based search.

## Demo (GitHub Pages)
Once GitHub Pages finishes deploying from `main`, the site will be available at:

- URL: https://newyellow.github.io/node--strider-website-graph/graph.html

If you get a 404 at first, wait a minute and refresh.

## Local preview

- Start a simple server:
  ```bash
  python3 -m http.server 4300 --directory .
  ```
- Open `http://localhost:4300/`

## Files
- `index.html` – main page
- `styles.css` – styles
- `main.js` – graph logic
- `references.txt` – API links and alternatives

## GitHub Pages
This repo is configured to auto-deploy `main` to GitHub Pages via GitHub Actions (`.github/workflows/deploy-pages.yml`).

## View a specific article
Open `viewArticle.html` with an `articleId` query parameter:

- `https://newyellow.github.io/node--strider-website-graph/viewArticle.html?articleId=article-001`
- Sample IDs: `article-001` … `article-030`

## Data processing tool
- `tools/dataProcess.js`: read `articles/` and generate `data/articles-index.json` with:
  - `articles`: id, title, author, publishedAt, tags
  - `tagCounts`: map of tag -> count
  - `tags`: array for graph nodes `{ id, count }`
  - `links`: tag co-occurrence edges `{ source, target, weight }`
- Run locally:
  ```bash
  node tools/dataProcess.js
  ```