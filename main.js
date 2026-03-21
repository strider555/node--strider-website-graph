// M+ Museum Collection Explorer
let museumData = null;
let currentGraph = null;
let currentFilter = 'all';

// Color scheme for tag types
const tagColors = {
  area: '#E6A817',       // Gold
  category: '#4ecdc4',   // Teal
  medium: '#ff6b6b',     // Coral
  nationality: '#45b7d1', // Blue
  decade: '#96ceb4'      // Green
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
  const width = container.clientWidth;
  const height = container.clientHeight;

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

// Customize graph with proper colors and interactions
function customizeGraph(radiusScale) {
  const svg = d3.select('#graph');
  const nodes = svg.selectAll('g.node');
  const links = svg.selectAll('line.link');

  // Update node colors based on type
  nodes.selectAll('circle')
    .attr('r', d => radiusScale(d.count))
    .attr('fill', d => d.color)
    .attr('stroke', '#0d1117')
    .attr('stroke-width', 2);

  // Update link styles
  links
    .attr('stroke', '#30363d')
    .attr('stroke-opacity', 0.4)
    .attr('stroke-width', d => Math.sqrt(d.weight || 1));

  // Add hover tooltip
  const tooltip = d3.select('#tooltip');

  nodes
    .on('mouseover', function(event, d) {
      tooltip
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 10}px`)
        .classed('show', true);

      d3.select('#tooltipTitle').text(d.id);
      d3.select('#tooltipDetail').text(`${d.count.toLocaleString()} artworks · ${d.type}`);
    })
    .on('mouseout', function() {
      tooltip.classed('show', false);
    })
    .on('click', function(event, d) {
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

  document.getElementById('panelTitle').textContent = tagId;
  document.getElementById('panelSubtitle').textContent =
    objects.length >= 50
      ? `Showing ${objects.length} of ${totalCount.toLocaleString()} artworks`
      : `${objects.length} artworks`;

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
  }

  // Clear SVG
  d3.select('#graph').selectAll('*').remove();

  // Create new graph
  const container = document.getElementById('graph');
  const width = container.clientWidth;
  const height = container.clientHeight;

  currentGraph = window.TagGraph.createTagGraph(
    '#graph',
    graphData,
    { width, height }
  );

  customizeGraph(radiusScale);
}

// Search functionality
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.toLowerCase().trim();

      if (!query) {
        // Reset all nodes
        d3.select('#graph').selectAll('g.node')
          .style('opacity', 1);
        d3.select('#graph').selectAll('line.link')
          .style('opacity', 0.4);
        return;
      }

      // Highlight matching nodes
      d3.select('#graph').selectAll('g.node')
        .style('opacity', d => {
          return d.id.toLowerCase().includes(query) ? 1 : 0.2;
        });

      // Dim links
      d3.select('#graph').selectAll('line.link')
        .style('opacity', 0.1);
    }, 300);
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

    // Initialize graph
    initGraph(museumData);

    // Setup interactions
    setupSearch();
    setupZoomControls();

    // Setup filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterByArea(btn.dataset.area);
      });
    });

    // Setup close panel button
    document.getElementById('closePanel').addEventListener('click', closeSidePanel);

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
