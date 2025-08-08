#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const OUT_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(OUT_DIR, 'articles-index.json');

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function buildIndex() {
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.json')).sort();
  const articles = [];
  const tagCounts = new Map();
  const coMap = new Map(); // key: tagA|tagB sorted

  for (const f of files) {
    const full = path.join(ARTICLES_DIR, f);
    const a = readJsonFile(full);
    const item = {
      id: a.id,
      title: a.title,
      author: a.author,
      publishedAt: a.publishedAt,
      tags: a.tags || []
    };
    articles.push(item);

    // Tag counts
    for (const t of item.tags) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }

    // Co-occurrence
    for (let i = 0; i < item.tags.length; i++) {
      for (let j = i + 1; j < item.tags.length; j++) {
        const aTag = item.tags[i];
        const bTag = item.tags[j];
        const [x, y] = [aTag, bTag].sort();
        const key = `${x}|${y}`;
        coMap.set(key, (coMap.get(key) || 0) + 1);
      }
    }
  }

  const tagCountsObj = Object.fromEntries([...tagCounts.entries()].sort((a,b)=>b[1]-a[1]));
  const tags = Object.keys(tagCountsObj).map(t => ({ id: t, count: tagCountsObj[t] }));
  const links = [...coMap.entries()].map(([k, w]) => {
    const [s, t] = k.split('|');
    return { source: s, target: t, weight: w };
  }).sort((a,b)=>b.weight-a.weight);

  return { articles, tags, links, tagCounts: tagCountsObj };
}

function main() {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error('Articles directory not found:', ARTICLES_DIR);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);
  const data = buildIndex();
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Wrote', OUT_FILE, 'with', data.articles.length, 'articles,', Object.keys(data.tagCounts).length, 'tags');
}

if (require.main === module) {
  main();
}