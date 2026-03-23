// M+ Museum Collection Explorer
let museumData = null;
let currentGraph = null;
let currentFilter = 'all';
let currentTypeFilter = 'all';

// Color scheme for tag types
const tagColors = {
  area: '#E6A817',       // Gold
  category: '#4ecdc4',   // Teal
  medium: '#ff6b6b',     // Coral
  nationality: '#45b7d1', // Blue
  decade: '#96ceb4',     // Green
  collection: '#c084fc'  // Purple
};

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
  const objects = museumData.objectsByTag[tagId] || [];

  // Update panel header
  const tag = museumData.tags.find(t => t.id === tagId);
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
      artistRow.innerHTML = `<span class="object-meta-label">Artist:</span><span>${artistDisplay}</span>`;
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

// Filter graph by area
function filterByArea(area) {
  if (!museumData) return;

  currentFilter = area;

  // Update button states
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.area === area);
  });

  // Filter data
  let filteredTags = museumData.tags;

  if (area !== 'all') {
    // Get tags that are either the area itself or co-occur with objects in that area
    const areaObjects = museumData.objectsByTag[area] || [];
    const relevantTagIds = new Set([area]);

    // Add all tags that appear in objects of this area
    areaObjects.forEach(obj => {
      if (obj.areas) obj.areas.forEach(a => relevantTagIds.add(a));
      if (obj.categories) obj.categories.forEach(c => relevantTagIds.add(c));
    });

    // Filter tags and links
    filteredTags = museumData.tags.filter(tag => {
      // Keep the main area tag
      if (tag.id === area) return true;
      // Keep tags that appear in area objects
      const tagObjects = museumData.objectsByTag[tag.id] || [];
      return tagObjects.some(obj => obj.areas && obj.areas.includes(area));
    });
  }

  // Rebuild graph
  const filteredLinks = museumData.links.filter(link => {
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

  const types = ['area', 'category', 'medium', 'nationality', 'decade', 'collection'];

  types.forEach(type => {
    const subContainer = document.getElementById(`sub-${type}`);
    if (!subContainer) return;

    // Get tags of this type, sorted by count descending
    const tags = museumData.tags
      .filter(t => t.type === type)
      .sort((a, b) => b.count - a.count);

    // Populate sub-items
    subContainer.innerHTML = '';
    tags.forEach(tag => {
      const item = document.createElement('div');
      item.className = 'legend-sub-item';
      item.dataset.tagId = tag.id;
      item.innerHTML = `<span>${tag.id}</span><span class="sub-count">${tag.count.toLocaleString()}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        focusNode(tag.id);
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

      // Also apply type filter
      filterByType(wasOpen ? 'all' : headerItem.dataset.type);
    });
  });

  // "All Types" button
  const allItem = document.querySelector('.legend-item[data-type="all"]');
  if (allItem) {
    allItem.addEventListener('click', () => {
      document.querySelectorAll('.legend-group').forEach(g => g.classList.remove('open'));
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
  const matchingIds = new Set(
    museumData.tags.filter(t => t.type === type).map(t => t.id)
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

    // Find matching tags
    const matches = museumData.tags
      .filter(tag => tag.id.toLowerCase().includes(query))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    currentResults = matches;
    selectedIndex = -1;

    if (matches.length === 0) {
      searchDropdown.innerHTML = '<div style="padding: 12px 16px; color: var(--text-muted); text-align: center;">No matches found</div>';
      searchDropdown.classList.add('show');
      return;
    }

    // Render dropdown items
    searchDropdown.innerHTML = matches.map((tag, index) => {
      const typeColor = tagColors[tag.type] || '#888';
      return `
        <div class="search-item" data-index="${index}" data-tag="${tag.id}">
          <div class="search-item-info">
            <div class="search-item-name">${tag.id}</div>
            <div class="search-item-meta">
              <span class="search-type-badge" style="background: ${typeColor}; color: #0d1117;">${tag.type}</span>
              <span class="search-item-count">${tag.count.toLocaleString()} artworks</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    searchDropdown.classList.add('show');

    // Add click handlers
    searchDropdown.querySelectorAll('.search-item').forEach(item => {
      item.addEventListener('click', () => {
        const tagId = item.dataset.tag;
        showSidePanel(tagId);
        searchInput.value = '';
        searchDropdown.classList.remove('show');
        // Reset graph opacity
        d3.select('#graph').selectAll('g.node').style('opacity', 1);
        d3.select('#graph').selectAll('path.link').style('opacity', 0.4);
      });
    });

    // Highlight matching nodes
    const matchingIds = new Set(matches.map(t => t.id));
    d3.select('#graph').selectAll('g.node')
      .style('opacity', d => matchingIds.has(d.id) ? 1 : 0.2);
    d3.select('#graph').selectAll('path.link')
      .style('opacity', 0.1);
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
        const tag = currentResults[selectedIndex >= 0 ? selectedIndex : 0];
        if (tag) {
          showSidePanel(tag.id);
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

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.classList.remove('show');
    }
  });
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

    // Setup filter buttons (area)
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterByArea(btn.dataset.area);
      });
    });

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
    document.addEventListener('click', (e) => {
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
