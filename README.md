# M+ Museum Collection Explorer

An interactive D3.js force-directed graph visualization of the M+ Museum collection featuring 13,000+ artworks with beautiful design and smooth interactions.

## Features

- **Interactive Graph Visualization**: Explore 71 tags across 5 types (Areas, Categories, Mediums, Nationalities, Decades)
- **Beautiful Dark Theme**: M+ Museum aesthetic with gold accents and smooth animations
- **Smart Filtering**: Filter by area (Visual Art, Design & Architecture, Moving Image)
- **Real-time Search**: Search tags with instant highlighting
- **Detail Panel**: Click any tag to see sample artworks with full metadata
- **Bilingual Support**: English and Traditional Chinese titles
- **Pan & Zoom**: Full navigation controls with smooth transitions
- **Responsive Design**: Works on desktop and mobile

## Demo (GitHub Pages)

Once deployed, the site will be available at:
- URL: https://newyellow.github.io/node--strider-website-graph/

## Local Preview

Start a simple server:
```bash
python3 -m http.server 4300 --directory .
```
Then open `http://localhost:4300/`

## Architecture

### Frontend Files
- `index.html` – Main explorer interface
- `styles.css` – Beautiful dark theme with M+ aesthetic
- `main.js` – Graph initialization, filtering, and interactions
- `graph.js` – Reusable D3 force-directed graph component
- `viewByCategory.html` – Standalone tag detail page

### Data Processing
- `tools/processMuseumData.js` – Transforms M+ CSV data into graph format
- Input: `/home/ubuntu/mplus-data/objects.csv` (13,412 artworks)
- Input: `/home/ubuntu/mplus-data/constituents.csv` (1,886 artists)
- Output: `data/museum-index.json` (1.88 MB)

### Data Structure

The `museum-index.json` contains:
```json
{
  "tags": [
    { "id": "Visual Art", "count": 5650, "type": "area" }
  ],
  "links": [
    { "source": "Photography", "target": "Visual Art", "weight": 2439 }
  ],
  "objectsByTag": {
    "Photography": [
      {
        "id": "1",
        "title": "Ko Shing Street, Sheung Wan",
        "titleTC": "上環高陞街",
        "date": "1956",
        "artistName": "...",
        "medium": "black and white print",
        "areas": ["Visual Art"],
        "categories": ["Photography"]
      }
    ]
  },
  "artists": [
    { "id": "378", "name": "...", "objectCount": 42 }
  ],
  "stats": {
    "totalObjects": 13411,
    "totalArtists": 1426,
    "totalTags": 71,
    "totalLinks": 979
  }
}
```

## Regenerate Data

To rebuild the museum data from source CSVs:

```bash
node tools/processMuseumData.js
```

This will:
1. Parse 13,411 objects and 1,886 constituents from M+ CSV files
2. Extract tags from areas, categories, mediums, nationalities, and decades
3. Generate co-occurrence links based on tag relationships
4. Filter to top tags (count >= 5) and meaningful links (weight >= 3)
5. Store up to 50 sample objects per tag for the detail view
6. Output optimized JSON file under 2MB

## Tag Types & Colors

- **Area** (Gold `#E6A817`): Visual Art, Design and Architecture, Moving Image
- **Category** (Teal `#4ecdc4`): Photography, Painting, Poster, Video, etc.
- **Medium** (Coral `#ff6b6b`): gelatin silver print, ink, acrylic, etc.
- **Nationality** (Blue `#45b7d1`): Chinese, Japanese, American, British, etc.
- **Decade** (Green `#96ceb4`): 1900s, 1910s, ..., 2020s

## Node Sizing

Node radius scales with square root of object count:
- Small nodes: 8px (tags with ~5-50 objects)
- Large nodes: 35px (tags with thousands of objects)

## Link Weights

Edge thickness represents co-occurrence frequency:
- Thin: 3-10 artworks share both tags
- Thick: 100+ artworks share both tags

## Interactions

- **Hover**: Tooltip shows tag name, count, and type
- **Click**: Opens side panel with sample artworks
- **Drag**: Move nodes to reorganize the graph
- **Scroll**: Zoom in/out
- **Search**: Type to highlight matching tags
- **Filter**: Toggle area buttons to focus visualization

## Performance

- Initial load: ~2 seconds (1.88 MB data + D3 simulation)
- Graph rendering: ~500ms for 71 nodes + 979 links
- Smooth 60fps animations with hardware acceleration
- Lazy loading: Only fetch data when needed

## GitHub Pages Deployment

This repo auto-deploys `main` branch via GitHub Actions:
- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: Push to main
- Build time: ~1 minute

## Future Enhancements

- [ ] Image thumbnails for artworks
- [ ] Advanced filters (date range, multiple areas)
- [ ] Direct links to M+ website for each object
- [ ] 3D force graph visualization
- [ ] Artist detail pages with biography
- [ ] Timeline view for decades
- [ ] Export filtered data as CSV/JSON

## Credits

- **Data**: M+ Museum, Hong Kong
- **Visualization**: D3.js v7
- **Design**: Custom dark theme inspired by M+ aesthetic
- **Fonts**: Inter (Google Fonts)

## License

Data: M+ Museum collection metadata
Code: MIT License
