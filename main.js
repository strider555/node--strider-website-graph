// Demo data. Replace with your real tags/articles data loader.
const demoData = {
  nodes: [
    { id: 'JavaScript', count: 42 },
    { id: 'Node.js', count: 28 },
    { id: 'Frontend', count: 36 },
    { id: 'Backend', count: 22 },
    { id: 'CSS', count: 18 },
    { id: 'React', count: 30 },
    { id: 'D3', count: 12 },
    { id: 'Database', count: 15 },
    { id: 'DevOps', count: 10 },
    { id: 'TypeScript', count: 26 },
  ],
  links: [
    { source: 'JavaScript', target: 'Frontend', weight: 5 },
    { source: 'JavaScript', target: 'Node.js', weight: 3 },
    { source: 'Node.js', target: 'Backend', weight: 4 },
    { source: 'Frontend', target: 'CSS', weight: 4 },
    { source: 'React', target: 'Frontend', weight: 5 },
    { source: 'D3', target: 'JavaScript', weight: 3 },
    { source: 'TypeScript', target: 'JavaScript', weight: 4 },
    { source: 'Database', target: 'Backend', weight: 2 },
    { source: 'DevOps', target: 'Backend', weight: 1 },
    { source: 'TypeScript', target: 'Frontend', weight: 2 },
  ],
};

const svg = d3.select('#graph');
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

// Zoom/pan behavior on an inner group
const zoomLayer = svg.append('g').attr('class', 'zoom-layer');

const zoom = d3
  .zoom()
  .scaleExtent([0.3, 4])
  .on('zoom', (event) => {
    zoomLayer.attr('transform', event.transform);
  });

svg.call(zoom).on('dblclick.zoom', null); // disable dblclick to center

// Define groups for links and nodes
const linkGroup = zoomLayer.append('g').attr('class', 'links');
const nodeGroup = zoomLayer.append('g').attr('class', 'nodes');

// Scales
const countExtent = d3.extent(demoData.nodes, (d) => d.count);
const radius = d3
  .scaleSqrt()
  .domain(countExtent)
  .range([6, 28]);

const linkWidth = d3
  .scaleLinear()
  .domain(d3.extent(demoData.links, (d) => d.weight))
  .range([1, 4]);

// Simulation
const simulation = d3
  .forceSimulation(demoData.nodes)
  .force(
    'link',
    d3
      .forceLink(demoData.links)
      .id((d) => d.id)
      .distance((d) => 50 + 8 * (3 - Math.min(3, d.weight || 1)))
      .strength((d) => 0.1 + 0.1 * (d.weight || 1))
  )
  .force('charge', d3.forceManyBody().strength(-200))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide((d) => radius(d.count) + 4));

// Draw links
const links = linkGroup
  .selectAll('line')
  .data(demoData.links)
  .join('line')
  .attr('class', 'link')
  .attr('stroke-width', (d) => linkWidth(d.weight || 1));

// Draw nodes: group contains circle + text + badge count
const nodes = nodeGroup
  .selectAll('g.node')
  .data(demoData.nodes)
  .join('g')
  .attr('class', 'node')
  .call(
    d3
      .drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
  );

nodes
  .append('circle')
  .attr('r', (d) => radius(d.count))
  .attr('fill', (d, i) => d3.interpolateCool(i / (demoData.nodes.length + 1)));

nodes
  .append('text')
  .attr('text-anchor', 'middle')
  .attr('dy', '0.35em')
  .text((d) => d.id);

// Count badge background and text
nodes
  .append('text')
  .attr('class', 'badge')
  .attr('dy', (d) => radius(d.count) + 12)
  .text((d) => d.count);

// Interactions: highlight connected on hover
const adjacency = new Map();
for (const l of demoData.links) {
  const keyA = `${l.source}|${l.target}`;
  const keyB = `${l.target}|${l.source}`;
  adjacency.set(keyA, true);
  adjacency.set(keyB, true);
}

function isConnected(a, b) {
  if (a.id === b.id) return true;
  return adjacency.get(`${a.id}|${b.id}`) || false;
}

nodes
  .on('mouseover', function (event, d) {
    nodes.selectAll('circle').attr('opacity', (o) => (isConnected(d, o) ? 1 : 0.25));
    nodes.selectAll('text').attr('opacity', (o) => (isConnected(d, o) ? 1 : 0.25));
    links
      .classed('highlight', (l) => l.source.id === d.id || l.target.id === d.id)
      .attr('stroke-opacity', (l) => (l.source.id === d.id || l.target.id === d.id ? 0.9 : 0.1));
  })
  .on('mouseout', function () {
    nodes.selectAll('circle').attr('opacity', 1);
    nodes.selectAll('text').attr('opacity', 1);
    links.classed('highlight', false).attr('stroke-opacity', 0.5);
  })
  .on('click', (event, d) => {
    event.stopPropagation();
    // Replace this with your search integration. For now, we just log.
    // You could emit a CustomEvent for your app to listen to.
    const detail = { tag: d.id };
    console.log('Search by tag:', detail);
    window.dispatchEvent(new CustomEvent('tag:search', { detail }));
  });

simulation.on('tick', () => {
  links
    .attr('x1', (d) => d.source.x)
    .attr('y1', (d) => d.source.y)
    .attr('x2', (d) => d.target.x)
    .attr('y2', (d) => d.target.y);

  nodes.attr('transform', (d) => `translate(${d.x},${d.y})`);
});

// Resize handling
function resize() {
  const w = svg.node().clientWidth;
  const h = svg.node().clientHeight;
  simulation.force('center', d3.forceCenter(w / 2, h / 2));
  simulation.alpha(0.2).restart();
}
window.addEventListener('resize', resize);