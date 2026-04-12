// M+ Museum Collection Explorer
let museumData = null;
let currentGraph = null;
let currentFilter = 'all';
let currentTypeFilter = 'all';
let selectedTags = new Set(); // Multi-select: specific tag IDs
let siggMode = false;

// Color scheme for tag types
const tagColors = {
  area: '#E6A817',       // Gold
  category: '#4ecdc4',   // Teal
  medium: '#ff6b6b',     // Coral
  nationality: '#45b7d1', // Blue
  decade: '#96ceb4',     // Green
  collection: '#c084fc'  // Purple
};

// Get current data source based on mode
function getCurrentData() {
  if (!museumData) return null;

  if (siggMode) {
    return {
      tags: museumData.siggTags,
      links: museumData.siggLinks,
      objectsByTag: museumData.siggObjectsByTag,
      searchIndex: museumData.siggSearchIndex || [],
      artists: museumData.artists || []
    };
  }

  return {
    tags: museumData.tags,
    links: museumData.links,
    objectsByTag: museumData.objectsByTag,
    searchIndex: museumData.searchIndex || [],
    artists: museumData.artists || []
  };
}

// Load museum data
async function loadData() {
  try {
    const response = await fetch('./data/museum-index.json');
    if (!response.ok) throw new Error('Failed to load data');
    museumData = await response.json();
    console.log('Museum data loaded:', museumData.stats);
    return museumData;
  } catch (error) {
    console.error('Error loading data:', error);
    document.getElementById('loading').innerHTML = `
      <div class="spinner"></div>
      <div>Error loading collection data</div>
    `;
    throw error;
  }
}

// Initialize graph
function initGraph(data) {
  const container = document.getElementById('graph');
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || (window.innerHeight - 80);

  // Get node size scale
  const countExtent = d3.extent(data.tags, d => d.count);
  const radiusScale = d3.scaleSqrt()
    .domain(countExtent)
    .range([8, 35]);

  // Create graph data with proper structure
  const graphData = {
    nodes: data.tags.map(tag => ({
      id: tag.id,
      count: tag.count,
      type: tag.type,
      color: tagColors[tag.type] || '#888'
    })),
    links: data.links.map(link => ({
      source: link.source,
      target: link.target,
      weight: link.weight
    }))
  };

  // Create graph using the TagGraph component
  currentGraph = window.TagGraph.createTagGraph(
    '#graph',
    graphData,
    { width, height }
  );

  // Customize the graph appearance
  customizeGraph(radiusScale);
}

// Customize graph with proper interactions (colors already set by graph.js via d.color)
function customizeGraph(radiusScale) {
  const svg = d3.select('#graph');
  const nodes = svg.selectAll('g.node');
  const links = svg.selectAll('path.link');

  // Update link styles
  links
    .attr('stroke', '#30363d')
    .attr('stroke-opacity', 0.3);

  // Add hover tooltip
  const tooltip = d3.select('#tooltip');

  nodes
    .on('mouseover.tooltip', function(event, d) {
      tooltip
        .style('left', `${event.pageX + 12}px`)
        .style('top', `${event.pageY - 10}px`)
        .classed('show', true);

      const typeColor = tagColors[d.type] || '#888';
      d3.select('#tooltipTitle').text(d.id);
      d3.select('#tooltipDetail').html(`
        <span style="display: inline-block; padding: 2px 6px; background: ${typeColor}; color: #0d1117; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; margin-right: 6px;">${d.type || 'unknown'}</span>
        ${(d.count || 0).toLocaleString()} artworks
      `);
    })
    .on('mousemove.tooltip', function(event) {
      tooltip
        .style('left', `${event.pageX + 12}px`)
        .style('top', `${event.pageY - 10}px`);
    })
    .on('mouseout.tooltip', function() {
      tooltip.classed('show', false);
    })
    .on('click.panel', function(event, d) {
      event.stopPropagation();
      showSidePanel(d.id);
    });
}

// Show side panel with objects
function showSidePanel(tagId) {
  const panel = document.getElementById('sidePanel');
  const currentData = getCurrentData();
  const objects = currentData.objectsByTag[tagId] || [];

  // Update panel header
  const tag = currentData.tags.find(t => t.id === tagId);
  const totalCount = tag ? tag.count : objects.length;
  const tagType = tag ? tag.type : 'unknown';
  const tagColor = tagColors[tagType] || '#888';

  // Update color indicator
  document.getElementById('panelColorIndicator').style.background = tagColor;

  // Update title and type
  document.getElementById('panelTitle').textContent = tagId;
  document.getElementById('panelTypeLabel').textContent = tagType;

  // Update summary bar
  const summaryText = objects.length >= 50
    ? `${tagId} · ${tagType} · Showing ${objects.length} of ${totalCount.toLocaleString()} artworks`
    : `${tagId} · ${tagType} · ${totalCount.toLocaleString()} artworks`;
  document.getElementById('panelSummary').textContent = summaryText;

  // Set details button URL
  document.getElementById('viewDetailsBtn').href =
    `./viewByCategory.html?category=${encodeURIComponent(tagId)}`;

  // Render object cards
  const grid = document.getElementById('objectGrid');
  grid.innerHTML = '';

  objects.forEach(obj => {
    const card = document.createElement('div');
    card.className = 'object-card';

    const title = document.createElement('div');
    title.className = 'object-title';
    title.textContent = obj.title || 'Untitled';

    const titleTC = document.createElement('div');
    titleTC.className = 'object-title-tc';
    titleTC.textContent = obj.titleTC || '';

    const meta = document.createElement('div');
    meta.className = 'object-meta';

    if (obj.date) {
      const dateRow = document.createElement('div');
      dateRow.className = 'object-meta-row';
      dateRow.innerHTML = `<span class="object-meta-label">Date:</span><span>${obj.date}</span>`;
      meta.appendChild(dateRow);
    }

    if (obj.artistName) {
      const artistRow = document.createElement('div');
      artistRow.className = 'object-meta-row';
      const artistDisplay = obj.artistNameTC
        ? `${obj.artistName} (${obj.artistNameTC})`
        : obj.artistName;
      const matchedArtist = museumData.artists.find(a => a.name === obj.artistName);
      if (matchedArtist) {
        artistRow.innerHTML = `<span class="object-meta-label">Artist:</span><a class="artist-link" data-artist-id="${matchedArtist.id}">${artistDisplay}</a>`;
        artistRow.querySelector('.artist-link').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (window._setPanelNavigating) window._setPanelNavigating();
          showArtistPanel(matchedArtist.id);
        });
      } else {
        artistRow.innerHTML = `<span class="object-meta-label">Artist:</span><span>${artistDisplay}</span>`;
      }
      meta.appendChild(artistRow);
    }

    if (obj.medium) {
      const mediumRow = document.createElement('div');
      mediumRow.className = 'object-meta-row';
      mediumRow.innerHTML = `<span class="object-meta-label">Medium:</span><span>${obj.medium}</span>`;
      meta.appendChild(mediumRow);
    }

    if (obj.areas && obj.areas.length > 0) {
      const areaRow = document.createElement('div');
      areaRow.className = 'object-meta-row';
      areaRow.innerHTML = `<span class="object-meta-label">Area:</span><span>${obj.areas.join(', ')}</span>`;
      meta.appendChild(areaRow);
    }

    card.appendChild(title);
    if (titleTC.textContent) card.appendChild(titleTC);
    card.appendChild(meta);

    grid.appendChild(card);
  });

  // Show panel
  panel.classList.add('open');
}

// Close side panel
function closeSidePanel() {
  document.getElementById('sidePanel').classList.remove('open');
}

// Find all objects by artist name
function findObjectsByArtist(artistName) {
  const currentData = getCurrentData();
  const results = [];
  const seen = new Set();

  for (const [tag, objects] of Object.entries(currentData.objectsByTag)) {
    for (const obj of objects) {
      if (obj.artistName === artistName && !seen.has(obj.id)) {
        seen.add(obj.id);
        results.push(obj);
      }
    }
  }

  return results;
}

// Show artist panel
function showArtistPanel(artistId) {
  const panel = document.getElementById('sidePanel');
  const artist = museumData.artists.find(a => a.id === artistId);

  if (!artist) {
    console.warn('Artist not found:', artistId);
    return;
  }

  const objects = findObjectsByArtist(artist.name);

  // Update color indicator (purple for artist)
  document.getElementById('panelColorIndicator').style.background = '#c084fc';

  // Update title
  const titleText = artist.nameTC ? `${artist.name} (${artist.nameTC})` : artist.name;
  document.getElementById('panelTitle').textContent = titleText;
  document.getElementById('panelTypeLabel').textContent = 'Artist';

  // Update summary
  const summaryText = `Artist · ${artist.nationality || 'Unknown'} · ${artist.objectCount.toLocaleString()} artworks`;
  document.getElementById('panelSummary').textContent = summaryText;

  // Set details button URL (prefer mplusUrl from Excel, fallback to slug)
  const detailsBtn = document.getElementById('viewDetailsBtn');
  if (artist.mplusUrl) {
    detailsBtn.href = artist.mplusUrl;
    detailsBtn.style.display = 'block';
  } else if (artist.slug) {
    detailsBtn.href = `https://www.mplus.org.hk/en/collection/makers/${artist.slug}/`;
    detailsBtn.style.display = 'block';
  } else {
    detailsBtn.style.display = 'none';
  }

  // Render object cards
  const grid = document.getElementById('objectGrid');
  grid.innerHTML = '';

  // Add bio if available
  if (artist.bio) {
    const bioCard = document.createElement('div');
    bioCard.className = 'artist-bio';
    bioCard.innerHTML = `<div class="artist-bio-text">${artist.bio}</div>`;
    grid.appendChild(bioCard);
  }

  objects.forEach(obj => {
    const card = document.createElement('div');
    card.className = 'object-card';
    card.addEventListener('click', () => showArtworkPanel(obj.id));

    const title = document.createElement('div');
    title.className = 'object-title';
    title.textContent = obj.title || 'Untitled';

    const titleTC = document.createElement('div');
    titleTC.className = 'object-title-tc';
    titleTC.textContent = obj.titleTC || '';

    const meta = document.createElement('div');
    meta.className = 'object-meta';

    if (obj.date) {
      const dateRow = document.createElement('div');
      dateRow.className = 'object-meta-row';
      dateRow.innerHTML = `<span class="object-meta-label">Date:</span><span>${obj.date}</span>`;
      meta.appendChild(dateRow);
    }

    if (obj.medium) {
      const mediumRow = document.createElement('div');
      mediumRow.className = 'object-meta-row';
      mediumRow.innerHTML = `<span class="object-meta-label">Medium:</span><span>${obj.medium}</span>`;
      meta.appendChild(mediumRow);
    }

    card.appendChild(title);
    if (titleTC.textContent) card.appendChild(titleTC);
    card.appendChild(meta);

    grid.appendChild(card);
  });

  // Show panel
  panel.classList.add('open');
}

// Show artwork panel
function showArtworkPanel(artworkId) {
  const panel = document.getElementById('sidePanel');
  const currentData = getCurrentData();

  // Find the artwork in objectsByTag
  let artwork = null;
  for (const [tag, objects] of Object.entries(currentData.objectsByTag)) {
    const found = objects.find(obj => obj.id === artworkId);
    if (found) {
      artwork = found;
      break;
    }
  }

  if (!artwork) {
    console.warn('Artwork not found:', artworkId);
    return;
  }

  // Update color indicator (coral for artwork)
  document.getElementById('panelColorIndicator').style.background = '#ff6b6b';

  // Update title
  const titleText = artwork.titleTC ? `${artwork.title} (${artwork.titleTC})` : artwork.title;
  document.getElementById('panelTitle').textContent = titleText;
  document.getElementById('panelTypeLabel').textContent = artwork.artistName || 'Unknown Artist';

  // Update summary
  const summaryParts = [];
  if (artwork.date) summaryParts.push(artwork.date);
  if (artwork.medium) summaryParts.push(artwork.medium);
  document.getElementById('panelSummary').textContent = summaryParts.join(' · ') || 'No details available';

  // Set details button URL - use M+ collection search since we don't have object slugs
  const detailsBtn = document.getElementById('viewDetailsBtn');
  const searchTitle = encodeURIComponent(artwork.title || '');
  detailsBtn.href = `https://www.mplus.org.hk/en/collection/?q=${searchTitle}`;
  detailsBtn.style.display = 'block';
  detailsBtn.style.display = 'block';

  // Render artwork details
  const grid = document.getElementById('objectGrid');
  grid.innerHTML = '';

  const detailsCard = document.createElement('div');
  detailsCard.className = 'artwork-details';

  const detailsList = [];

  if (artwork.artistName) {
    const artistDisplay = artwork.artistNameTC
      ? `${artwork.artistName} (${artwork.artistNameTC})`
      : artwork.artistName;
    const matchedArtist = museumData.artists.find(a => a.name === artwork.artistName);
    if (matchedArtist) {
      detailsList.push(`<div class="detail-row"><span class="detail-label">Artist:</span><a class="artist-link detail-value" data-artist-id="${matchedArtist.id}">${artistDisplay}</a></div>`);
    } else {
      detailsList.push(`<div class="detail-row"><span class="detail-label">Artist:</span><span class="detail-value">${artistDisplay}</span></div>`);
    }
  }

  if (artwork.nationality) {
    detailsList.push(`<div class="detail-row"><span class="detail-label">Nationality:</span><span class="detail-value">${artwork.nationality}</span></div>`);
  }

  if (artwork.date) {
    detailsList.push(`<div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">${artwork.date}</span></div>`);
  }

  if (artwork.medium) {
    const mediumDisplay = artwork.mediumTC
      ? `${artwork.medium} (${artwork.mediumTC})`
      : artwork.medium;
    detailsList.push(`<div class="detail-row"><span class="detail-label">Medium:</span><span class="detail-value">${mediumDisplay}</span></div>`);
  }

  if (artwork.areas && artwork.areas.length > 0) {
    detailsList.push(`<div class="detail-row"><span class="detail-label">Areas:</span><span class="detail-value">${artwork.areas.join(', ')}</span></div>`);
  }

  if (artwork.categories && artwork.categories.length > 0) {
    detailsList.push(`<div class="detail-row"><span class="detail-label">Categories:</span><span class="detail-value">${artwork.categories.join(', ')}</span></div>`);
  }

  detailsCard.innerHTML = detailsList.join('');
  // Bind artist link clicks
  detailsCard.querySelectorAll('.artist-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window._setPanelNavigating) window._setPanelNavigating();
      showArtistPanel(link.dataset.artistId);
    });
  });
  grid.appendChild(detailsCard);

  // Show panel
  panel.classList.add('open');
}

// Toggle Sigg Collection mode
function toggleSiggMode() {
  siggMode = !siggMode;

  // Update button state
  const siggToggle = document.getElementById('siggToggle');
  siggToggle.classList.toggle('active', siggMode);

  // Update graph container visual indicator
  const graphContainer = document.getElementById('graph-container');
  graphContainer.classList.toggle('sigg-mode', siggMode);

  // Rebuild graph with current filter
  filterByArea(currentFilter);

  // Update legend submenus
  setupLegendSubmenus();

  // Update type filter if one is active
  if (currentTypeFilter !== 'all') {
    filterByType(currentTypeFilter);
  }
}

// Filter graph by area
function filterByArea(area) {
  if (!museumData) return;

  currentFilter = area;

  // Update button states (but not the Sigg toggle)
  document.querySelectorAll('.filter-btn[data-area]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.area === area);
  });

  // Get current data source
  const currentData = getCurrentData();

  // Filter data
  let filteredTags = currentData.tags;

  if (area !== 'all') {
    // Get tags that are either the area itself or co-occur with objects in that area
    const areaObjects = currentData.objectsByTag[area] || [];
    const relevantTagIds = new Set([area]);

    // Add all tags that appear in objects of this area
    areaObjects.forEach(obj => {
      if (obj.areas) obj.areas.forEach(a => relevantTagIds.add(a));
      if (obj.categories) obj.categories.forEach(c => relevantTagIds.add(c));
    });

    // Filter tags and links
    filteredTags = currentData.tags.filter(tag => {
      // Keep the main area tag
      if (tag.id === area) return true;
      // Keep tags that appear in area objects
      const tagObjects = currentData.objectsByTag[tag.id] || [];
      return tagObjects.some(obj => obj.areas && obj.areas.includes(area));
    });
  }

  // Rebuild graph
  const filteredLinks = currentData.links.filter(link => {
    const sourceExists = filteredTags.find(t => t.id === link.source);
    const targetExists = filteredTags.find(t => t.id === link.target);
    return sourceExists && targetExists;
  });

  const countExtent = d3.extent(filteredTags, d => d.count);
  const radiusScale = d3.scaleSqrt()
    .domain(countExtent)
    .range([8, 35]);

  const graphData = {
    nodes: filteredTags.map(tag => ({
      id: tag.id,
      count: tag.count,
      type: tag.type,
      color: tagColors[tag.type] || '#888'
    })),
    links: filteredLinks
  };

  // Destroy old graph
  if (currentGraph) {
    currentGraph.destroy();
    currentGraph = null;
  }

  // Create new graph
  const container = document.getElementById('graph');
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || (window.innerHeight - 80);

  currentGraph = window.TagGraph.createTagGraph(
    '#graph',
    graphData,
    { width, height }
  );

  customizeGraph(radiusScale);
}

// Populate legend submenus with tags and handle expand/collapse
function setupLegendSubmenus() {
  if (!museumData) return;

  const currentData = getCurrentData();
  const types = ['area', 'category', 'medium', 'nationality', 'decade', 'collection'];

  types.forEach(type => {
    const subContainer = document.getElementById(`sub-${type}`);
    if (!subContainer) return;

    // Get tags of this type, sorted by count descending
    const tags = currentData.tags
      .filter(t => t.type === type)
      .sort((a, b) => b.count - a.count);

    // Populate sub-items
    subContainer.innerHTML = '';
    tags.forEach(tag => {
      const item = document.createElement('div');
      item.className = 'legend-sub-item';
      item.dataset.tagId = tag.id;
      item.innerHTML = `<span class="sub-checkbox">☐</span><span>${tag.id}</span><span class="sub-count">${tag.count.toLocaleString()}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTagSelection(tag.id, item);
      });
      subContainer.appendChild(item);
    });
  });

  // Handle legend group expand/collapse
  document.querySelectorAll('.legend-group').forEach(group => {
    const headerItem = group.querySelector('.legend-item');
    headerItem.addEventListener('click', (e) => {
      e.stopPropagation();
      // Toggle this group
      const wasOpen = group.classList.contains('open');

      // Close all groups
      document.querySelectorAll('.legend-group').forEach(g => g.classList.remove('open'));

      // Open this one if it was closed
      if (!wasOpen) {
        group.classList.add('open');
      }

      // Clear multi-select and apply type filter
      clearTagSelection();
      filterByType(wasOpen ? 'all' : headerItem.dataset.type);
    });
  });

  // "All Types" button
  const allItem = document.querySelector('.legend-item[data-type="all"]');
  if (allItem) {
    allItem.addEventListener('click', () => {
      document.querySelectorAll('.legend-group').forEach(g => g.classList.remove('open'));
      clearTagSelection();
      filterByType('all');
    });
  }
}

// Focus on a specific node: zoom to it, highlight it, open its panel
function focusNode(tagId) {
  const svg = d3.select('#graph');
  const nodes = svg.selectAll('g.node');

  // Find the target node data
  let targetNode = null;
  nodes.each(function(d) {
    if (d.id === tagId) {
      targetNode = d;
    }
  });

  if (!targetNode || targetNode.x == null) {
    // Node not found in current graph, just open panel
    showSidePanel(tagId);
    return;
  }

  // Get SVG dimensions from viewBox
  const svgNode = svg.node();
  const viewBox = svgNode.viewBox.baseVal;
  const vw = viewBox.width || svgNode.clientWidth || 800;
  const vh = viewBox.height || svgNode.clientHeight || 600;

  // Calculate transform to center on node with zoom
  const scale = 1.8;
  const tx = vw / 2 - targetNode.x * scale;
  const ty = vh / 2 - targetNode.y * scale;

  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

  // Smooth zoom transition
  svg.transition()
    .duration(600)
    .call(d3.zoom().scaleExtent([0.3, 4]).on('zoom', (event) => {
      svg.select('g.zoom-layer').attr('transform', event.transform);
    }).transform, transform);

  // Highlight the target node
  nodes.selectAll('circle')
    .transition().duration(400)
    .attr('opacity', d => d.id === tagId ? 1 : 0.15);
  nodes.selectAll('text')
    .transition().duration(400)
    .attr('opacity', d => d.id === tagId ? 1 : 0.15);

  // Reset highlight after 2 seconds
  setTimeout(() => {
    nodes.selectAll('circle').transition().duration(400).attr('opacity', 1);
    nodes.selectAll('text').transition().duration(400).attr('opacity', 1);
  }, 2000);

  // Open side panel
  showSidePanel(tagId);
}

// Toggle a specific tag in multi-select mode
function toggleTagSelection(tagId, itemEl) {
  if (selectedTags.has(tagId)) {
    selectedTags.delete(tagId);
    itemEl.classList.remove('selected');
    itemEl.querySelector('.sub-checkbox').textContent = '\u2610';
  } else {
    selectedTags.add(tagId);
    itemEl.classList.add('selected');
    itemEl.querySelector('.sub-checkbox').textContent = '\u2611';
  }

  if (selectedTags.size === 0) {
    filterByType(currentTypeFilter);
  } else {
    applyMultiFilter();
  }
}

// Clear all multi-select
function clearTagSelection() {
  selectedTags.clear();
  document.querySelectorAll('.legend-sub-item.selected').forEach(el => {
    el.classList.remove('selected');
    const cb = el.querySelector('.sub-checkbox');
    if (cb) cb.textContent = '\u2610';
  });
}

// Apply multi-select filter
function applyMultiFilter() {
  if (!museumData || selectedTags.size === 0) return;

  d3.select('#graph').selectAll('g.node')
    .transition().duration(300)
    .style('opacity', d => selectedTags.has(d.id) ? 1 : 0.08);

  d3.select('#graph').selectAll('path.link')
    .transition().duration(300)
    .style('opacity', l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      return (selectedTags.has(sId) && selectedTags.has(tId)) ? 0.6
           : (selectedTags.has(sId) || selectedTags.has(tId)) ? 0.2
           : 0.02;
    });

  if (selectedTags.size >= 2) {
    showMultiSelectPanel();
  }
}

// Show combined info for multi-selected tags
function showMultiSelectPanel() {
  const currentData = getCurrentData();
  const panel = document.getElementById('sidePanel');
  const title = document.getElementById('panelTitle');
  const typeLabel = document.getElementById('panelTypeLabel');
  const summary = document.getElementById('panelSummary');
  const grid = document.getElementById('objectGrid');
  const colorIndicator = document.getElementById('panelColorIndicator');

  const tagArrays = [...selectedTags].map(id => {
    const objs = currentData.objectsByTag[id] || [];
    return new Set(objs.map(o => o.id || o.objectNumber || JSON.stringify(o)));
  });

  let commonIds = tagArrays[0] || new Set();
  for (let i = 1; i < tagArrays.length; i++) {
    commonIds = new Set([...commonIds].filter(x => tagArrays[i].has(x)));
  }

  title.textContent = [...selectedTags].join(' + ');
  typeLabel.textContent = 'Multi-select';
  colorIndicator.style.background = '#fff';
  summary.textContent = `${selectedTags.size} tags selected \u00b7 ${commonIds.size} shared artworks`;

  grid.innerHTML = '';
  if (commonIds.size > 0) {
    const firstTag = [...selectedTags][0];
    const allObjs = currentData.objectsByTag[firstTag] || [];
    const sharedObjs = allObjs.filter(o => commonIds.has(o.id || o.objectNumber || JSON.stringify(o)));
    sharedObjs.slice(0, 20).forEach(obj => {
      const card = document.createElement('div');
      card.className = 'object-card';
      const titleText = typeof obj.title === 'object' ? (obj.title.en || obj.title['zh-hant'] || '') : (obj.title || 'Untitled');
      const artist = typeof obj.artist === 'object' ? (obj.artist.en || '') : (obj.artist || '');
      card.innerHTML = `<div class="object-title">${titleText}</div><div class="object-meta">${artist}</div><div class="object-meta">${obj.date || obj.displayDate || ''}</div>`;
      grid.appendChild(card);
    });
  } else {
    grid.innerHTML = '<div class="object-card"><div class="object-title">No shared artworks</div><div class="object-meta">These categories do not overlap</div></div>';
  }

  panel.classList.add('open');
}

// Filter graph by tag type (area/category/medium/nationality/decade)
function filterByType(type) {
  if (!museumData) return;

  currentTypeFilter = type;

  // Update legend active state
  document.querySelectorAll('.legend-item[data-type]').forEach(item => {
    item.classList.toggle('active', item.dataset.type === type);
  });

  if (type === 'all') {
    // Show all nodes
    d3.select('#graph').selectAll('g.node')
      .transition().duration(300)
      .style('opacity', 1);
    d3.select('#graph').selectAll('path.link')
      .transition().duration(300)
      .style('opacity', null); // Reset to default
    return;
  }

  // Highlight nodes of selected type, dim others
  const currentData = getCurrentData();
  const matchingIds = new Set(
    currentData.tags.filter(t => t.type === type).map(t => t.id)
  );

  d3.select('#graph').selectAll('g.node')
    .transition().duration(300)
    .style('opacity', d => matchingIds.has(d.id) ? 1 : 0.08);

  d3.select('#graph').selectAll('path.link')
    .transition().duration(300)
    .style('opacity', l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      return (matchingIds.has(sId) || matchingIds.has(tId)) ? 0.4 : 0.02;
    });
}

// Search functionality
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchDropdown = document.getElementById('searchDropdown');
  let searchTimeout;
  let selectedIndex = -1;
  let currentResults = [];

  function showSearchResults(query) {
    if (!query) {
      searchDropdown.classList.remove('show');
      searchDropdown.innerHTML = '';
      // Reset all nodes
      d3.select('#graph').selectAll('g.node')
        .style('opacity', 1);
      d3.select('#graph').selectAll('path.link')
        .style('opacity', 0.4);
      return;
    }

    const currentData = getCurrentData();

    // Search across tags
    const tagMatches = currentData.tags
      .filter(tag => tag.id.toLowerCase().includes(query))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map(tag => ({ ...tag, searchType: 'tag' }));

    // Search across artists
    const artistMatches = currentData.searchIndex
      .filter(item => item.type === 'artist' && (
        item.name.toLowerCase().includes(query) ||
        (item.nameTC && item.nameTC.toLowerCase().includes(query))
      ))
      .sort((a, b) => b.objectCount - a.objectCount)
      .slice(0, 4)
      .map(item => ({ ...item, searchType: 'artist' }));

    // Search across artworks
    const artworkMatches = currentData.searchIndex
      .filter(item => item.type === 'artwork' && (
        item.title.toLowerCase().includes(query) ||
        (item.titleTC && item.titleTC.toLowerCase().includes(query)) ||
        (item.artistName && item.artistName.toLowerCase().includes(query))
      ))
      .slice(0, 4)
      .map(item => ({ ...item, searchType: 'artwork' }));

    // Combine and limit to 12 results
    const allMatches = [...tagMatches, ...artistMatches, ...artworkMatches].slice(0, 12);
    currentResults = allMatches;
    selectedIndex = -1;

    if (allMatches.length === 0) {
      searchDropdown.innerHTML = '<div style="padding: 12px 16px; color: var(--text-muted); text-align: center;">No matches found</div>';
      searchDropdown.classList.add('show');
      return;
    }

    // Render dropdown items grouped by type
    let html = '';
    const groups = [
      { type: 'tag', label: 'Tags', items: tagMatches },
      { type: 'artist', label: 'Artists', items: artistMatches },
      { type: 'artwork', label: 'Artworks', items: artworkMatches }
    ];

    let globalIndex = 0;
    groups.forEach(group => {
      if (group.items.length === 0) return;

      group.items.forEach(item => {
        if (item.searchType === 'tag') {
          const typeColor = tagColors[item.type] || '#888';
          html += `
            <div class="search-item" data-index="${globalIndex}" data-type="tag" data-id="${item.id}">
              <div class="search-item-info">
                <div class="search-item-name">${item.id}</div>
                <div class="search-item-meta">
                  <span class="search-type-badge" style="background: ${typeColor}; color: #0d1117;">${item.type}</span>
                  <span class="search-item-count">${item.count.toLocaleString()} artworks</span>
                </div>
              </div>
            </div>
          `;
        } else if (item.searchType === 'artist') {
          html += `
            <div class="search-item" data-index="${globalIndex}" data-type="artist" data-id="${item.id}">
              <div class="search-item-icon">🎨</div>
              <div class="search-item-info">
                <div class="search-item-name">${item.name}${item.nameTC ? ` (${item.nameTC})` : ''}</div>
                <div class="search-item-meta">
                  <span class="search-item-detail">${item.nationality || 'Unknown'}</span>
                  <span class="search-item-count">${item.objectCount.toLocaleString()} artworks</span>
                </div>
              </div>
            </div>
          `;
        } else if (item.searchType === 'artwork') {
          html += `
            <div class="search-item" data-index="${globalIndex}" data-type="artwork" data-id="${item.id}">
              <div class="search-item-icon">🖼️</div>
              <div class="search-item-info">
                <div class="search-item-name">${item.title}</div>
                <div class="search-item-meta">
                  <span class="search-item-detail">${item.artistName || 'Unknown Artist'}</span>
                  ${item.date ? `<span class="search-item-detail">${item.date}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }
        globalIndex++;
      });
    });

    searchDropdown.innerHTML = html;
    searchDropdown.classList.add('show');

    // Highlight matching tag nodes
    const matchingTagIds = new Set(tagMatches.map(t => t.id));
    if (matchingTagIds.size > 0) {
      d3.select('#graph').selectAll('g.node')
        .style('opacity', d => matchingTagIds.has(d.id) ? 1 : 0.2);
      d3.select('#graph').selectAll('path.link')
        .style('opacity', 0.1);
    }
  }

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.toLowerCase().trim();
    searchTimeout = setTimeout(() => showSearchResults(query), 150);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (!searchDropdown.classList.contains('show')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      searchInput.value = '';
      searchDropdown.classList.remove('show');
      d3.select('#graph').selectAll('g.node').style('opacity', 1);
      d3.select('#graph').selectAll('path.link').style('opacity', 0.4);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults.length > 0) {
        const result = currentResults[selectedIndex >= 0 ? selectedIndex : 0];
        if (result) {
          if (result.searchType === 'tag') {
            showSidePanel(result.id);
          } else if (result.searchType === 'artist') {
            showArtistPanel(result.id);
          } else if (result.searchType === 'artwork') {
            showArtworkPanel(result.id);
          }
          searchInput.value = '';
          searchDropdown.classList.remove('show');
          d3.select('#graph').selectAll('g.node').style('opacity', 1);
          d3.select('#graph').selectAll('path.link').style('opacity', 0.4);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      updateSelectedItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelectedItem();
    }
  });

  function updateSelectedItem() {
    const items = searchDropdown.querySelectorAll('.search-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === selectedIndex);
    });
  }

  // Event delegation for dropdown clicks (mousedown + touchstart for mobile)
  function handleDropdownSelect(e) {
    e.preventDefault();
    const item = e.target.closest('.search-item');
    if (!item) return;

    const type = item.dataset.type;
    const id = item.dataset.id;

    if (type === 'tag') {
      showSidePanel(id);
    } else if (type === 'artist') {
      showArtistPanel(id);
    } else if (type === 'artwork') {
      showArtworkPanel(id);
    }

    searchInput.value = '';
    searchDropdown.classList.remove('show');
    d3.select('#graph').selectAll('g.node').style('opacity', 1);
    d3.select('#graph').selectAll('path.link').style('opacity', 0.4);
  }
  searchDropdown.addEventListener('mousedown', handleDropdownSelect);
  searchDropdown.addEventListener('touchend', handleDropdownSelect);

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.classList.remove('show');
    }
  });
}

// ---- Browse Modal ----
function setupBrowseModal() {
  const modal = document.getElementById('browseModal');
  const browseBtn = document.getElementById('browseBtn');
  const closeBtn = document.getElementById('closeBrowse');
  const browseSearch = document.getElementById('browseSearch');
  const browseList = document.getElementById('browseList');
  const browseAlphabet = document.getElementById('browseAlphabet');
  const browseTabs = document.getElementById('browseTabs');

  let currentTab = 'all';

  browseBtn.addEventListener('click', () => {
    modal.classList.add('show');
    renderBrowseList('');
    browseSearch.value = '';
    browseSearch.focus();
  });

  closeBtn.addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('show');
  });

  // Tab switching
  browseTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.browse-tab');
    if (!tab) return;
    browseTabs.querySelectorAll('.browse-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    renderBrowseList(browseSearch.value.toLowerCase().trim());
  });

  // Filter
  let filterTimeout;
  browseSearch.addEventListener('input', () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      renderBrowseList(browseSearch.value.toLowerCase().trim());
    }, 150);
  });

  function renderBrowseList(filter) {
    const data = getCurrentData();
    let artists = data.artists || [];

    // Filter by tab
    if (currentTab === 'sigg') {
      const siggIds = new Set((museumData.siggArtistIds || []).map(String));
      artists = artists.filter(a => siggIds.has(String(a.id)));
    }

    // Filter by search
    if (filter) {
      artists = artists.filter(a =>
        (a.name || '').toLowerCase().includes(filter) ||
        (a.nameTC || '').toLowerCase().includes(filter)
      );
    }

    // Sort A-Z
    artists.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Update tab counts
    const allCount = (getCurrentData().artists || []).length;
    const siggCount = (museumData.siggArtistIds || []).length;
    browseTabs.querySelector('[data-tab="all"]').textContent = `All (${allCount})`;
    browseTabs.querySelector('[data-tab="sigg"]').textContent = `Sigg (${siggCount})`;

    // Group by letter
    const groups = {};
    artists.forEach(a => {
      const letter = (a.name || '?')[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(a);
    });

    // Render alphabet bar
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    browseAlphabet.innerHTML = letters.map(l =>
      `<a class="${groups[l] ? '' : 'disabled'}" data-letter="${l}">${l}</a>`
    ).join('');

    browseAlphabet.querySelectorAll('a:not(.disabled)').forEach(a => {
      a.addEventListener('click', () => {
        const el = browseList.querySelector(`[data-group="${a.dataset.letter}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Render list
    let html = '';
    Object.keys(groups).sort().forEach(letter => {
      html += `<div class="browse-letter-group" data-group="${letter}">`;
      html += `<div class="browse-letter">${letter}</div>`;
      groups[letter].forEach(a => {
        html += `
          <div class="browse-artist" data-id="${a.id}">
            <div>
              <div class="browse-artist-name">${a.name}</div>
              ${a.nameTC ? `<div class="browse-artist-name-tc">${a.nameTC}</div>` : ''}
            </div>
            <div class="browse-artist-count">${a.objectCount} works</div>
          </div>`;
      });
      html += '</div>';
    });

    if (!html) {
      html = '<div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">No artists found</div>';
    }

    browseList.innerHTML = html;

    // Click handler
    browseList.addEventListener('click', (e) => {
      const el = e.target.closest('.browse-artist');
      if (!el) return;
      const id = el.dataset.id;
      showArtistPanel(id);
      modal.classList.remove('show');
    });
    browseList.addEventListener('touchend', (e) => {
      const el = e.target.closest('.browse-artist');
      if (!el) return;
      e.preventDefault();
      const id = el.dataset.id;
      showArtistPanel(id);
      modal.classList.remove('show');
    });
  }
}

// Zoom controls
function setupZoomControls() {
  const svg = d3.select('#graph');
  const zoom = d3.zoom().scaleExtent([0.3, 4]);

  document.getElementById('zoomIn').addEventListener('click', () => {
    svg.transition().call(zoom.scaleBy, 1.3);
  });

  document.getElementById('zoomOut').addEventListener('click', () => {
    svg.transition().call(zoom.scaleBy, 0.7);
  });

  document.getElementById('resetZoom').addEventListener('click', () => {
    if (currentGraph && currentGraph.resetZoom) {
      currentGraph.resetZoom();
    }
  });
}

// Initialize app
async function init() {
  try {
    // Load data
    await loadData();

    // Hide loading, show graph
    document.getElementById('loading').style.display = 'none';
    document.getElementById('graph-container').style.display = 'block';

    // Wait for browser reflow before measuring container dimensions
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Initialize graph
    initGraph(museumData);

    // Setup interactions
    setupSearch();
    setupZoomControls();
    setupBrowseModal();

    // Setup filter buttons (area)
    document.querySelectorAll('.filter-btn[data-area]').forEach(btn => {
      btn.addEventListener('click', () => {
        filterByArea(btn.dataset.area);
      });
    });

    // Setup Sigg Collection toggle
    document.getElementById('siggToggle').addEventListener('click', toggleSiggMode);

    // Setup legend type filters + expandable submenus
    setupLegendSubmenus();

    // Setup close panel button
    document.getElementById('closePanel').addEventListener('click', closeSidePanel);

    // Listen for node click events from graph.js
    window.addEventListener('tag:click', (e) => {
      if (e.detail && e.detail.tag) {
        showSidePanel(e.detail.tag);
      }
    });

    // Close panel when clicking outside
    let panelNavigating = false;
    window._setPanelNavigating = () => { panelNavigating = true; setTimeout(() => { panelNavigating = false; }, 100); };
    document.addEventListener('click', (e) => {
      if (panelNavigating) return;
      const panel = document.getElementById('sidePanel');
      if (panel.classList.contains('open') &&
          !panel.contains(e.target) &&
          !e.target.closest('.node')) {
        closeSidePanel();
      }
    });

  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
