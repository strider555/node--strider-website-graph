(function(){
  function createTagGraph(container, data, options = {}) {
    if (!window.d3) throw new Error('D3 is required. Include d3 v7 before graph.js');
    const d3 = window.d3;

    // If no data was passed, use a demo dataset
    const dataset = data || {
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

    const containerSel = typeof container === 'string' ? d3.select(container) : d3.select(container);
    const width = options.width || containerSel.node().clientWidth || window.innerWidth || 800;
    const height = options.height || containerSel.node().clientHeight || (window.innerHeight - 80) || 600;

    const highlightIds = new Set((options.highlightIds || []).filter(Boolean));
    const highlightStroke = options.highlightStroke || '#facc15'; // amber-400
    const highlightWidth = options.highlightWidth != null ? options.highlightWidth : 3;

    // Create SVG if container is not an SVG
    let svg;
    if (containerSel.node().tagName.toLowerCase() === 'svg') {
      svg = containerSel;
      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');
    } else {
      svg = containerSel.append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${width} ${height}`);
    }

    const zoomLayer = svg.append('g').attr('class', 'zoom-layer');

    const zoom = d3.zoom().scaleExtent([0.3, 4]).on('zoom', (event) => {
      zoomLayer.attr('transform', event.transform);
    });
    svg.call(zoom).on('dblclick.zoom', null);

    const linkGroup = zoomLayer.append('g').attr('class', 'links');
    const nodeGroup = zoomLayer.append('g').attr('class', 'nodes');

    const countExtent = d3.extent(dataset.nodes, (d) => d.count || 1);
    const radius = d3.scaleSqrt().domain(countExtent).range([5, 30]);
    const linkWeightExtent = d3.extent(dataset.links, (d) => d.weight || 1);
    const linkWidth = d3.scaleLinear().domain(linkWeightExtent).range([0.5, 4]);
    const linkOpacityScale = d3.scaleLinear().domain(linkWeightExtent).range([0.15, 0.6]);

    const simulation = d3
      .forceSimulation(dataset.nodes)
      .force('link', d3.forceLink(dataset.links).id((d) => d.id)
        .distance(120)
        .strength(0.15))
      .force('charge', d3.forceManyBody().strength(-800).distanceMax(800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide((d) => radius(d.count || 1) + 15))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04));

    const links = linkGroup
      .selectAll('line')
      .data(dataset.links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', '#64748b')
      .attr('stroke-opacity', (d) => linkOpacityScale(d.weight || 1))
      .attr('stroke-width', (d) => linkWidth(d.weight || 1));

    const nodes = nodeGroup
      .selectAll('g.node')
      .data(dataset.nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.__down = { t: Date.now(), x: event.x, y: event.y };
            d.__moved = false;
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            if (d.__down && !d.__moved) {
              const dx = event.x - d.__down.x;
              const dy = event.y - d.__down.y;
              if (Math.hypot(dx, dy) > 5) d.__moved = true;
            }
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (event, d) => {
        const dt = d.__down ? (Date.now() - d.__down.t) : 9999;
        const isQuick = dt < 300 && !d.__moved;
        const detail = { tag: d.id };
        window.dispatchEvent(new CustomEvent('tag:search', { detail }));
        if (isQuick) {
          const url = `./viewByCategory.html?category=${encodeURIComponent(d.id)}`;
          window.open(url, '_blank', 'noopener');
        }
      })
      .on('mouseover', function (event, d) {
        nodes.selectAll('circle').attr('opacity', (o) => (isConnected(d, o) ? 1 : 0.15));
        nodes.selectAll('text').attr('opacity', (o) => (isConnected(d, o) ? 1 : 0.15));
        links
          .attr('stroke-opacity', (l) => (l.source.id === d.id || l.target.id === d.id ? 0.85 : 0.03))
          .attr('stroke', (l) => (l.source.id === d.id || l.target.id === d.id ? '#E6A817' : '#64748b'));
      })
      .on('mouseout', function () {
        nodes.selectAll('circle').attr('opacity', 1);
        nodes.selectAll('text').attr('opacity', 1);
        links
          .attr('stroke-opacity', (d) => linkOpacityScale(d.weight || 1))
          .attr('stroke', '#64748b');
      });

    nodes.append('circle')
      .attr('r', (d, i) => radius(d.count || 1))
      .attr('fill', (d) => d.color || d3.interpolateCool(i / (dataset.nodes.length + 1)))
      .attr('stroke', '#0b1120')
      .attr('stroke-width', 2)
      .each(function(d){
        if (highlightIds.has(d.id)) {
          d3.select(this)
            .style('stroke', highlightStroke)
            .style('stroke-width', `${highlightWidth}px`);
        }
      });

    nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => radius(d.count || 1) + 14)
      .attr('fill', '#e5e7eb')
      .style('font-size', '11px')
      .style('font-weight', '500')
      .style('pointer-events', 'none')
      .text((d) => d.id.length > 18 ? d.id.substring(0, 18) + '…' : d.id);

    nodes.append('text')
      .attr('class', 'badge')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => radius(d.count || 1) + 26)
      .attr('fill', '#8b949e')
      .style('font-size', '10px')
      .style('pointer-events', 'none')
      .text((d) => (d.count || 0).toLocaleString());

    const adjacency = new Map();
    for (const l of dataset.links) {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      adjacency.set(`${s}|${t}`, true);
      adjacency.set(`${t}|${s}`, true);
    }
    function isConnected(a, b) {
      if (a.id === b.id) return true;
      return adjacency.get(`${a.id}|${b.id}`) || false;
    }

    simulation.on('tick', () => {
      links
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

      nodes.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    function resize() {
      // If using viewBox, centering force update is enough
      const bbox = svg.node().viewBox.baseVal;
      const cx = (bbox && bbox.width ? bbox.width : width) / 2;
      const cy = (bbox && bbox.height ? bbox.height : height) / 2;
      simulation.force('center', d3.forceCenter(cx, cy));
      simulation.alpha(0.2).restart();
    }
    window.addEventListener('resize', resize);

    return {
      destroy() {
        window.removeEventListener('resize', resize);
        simulation.stop();
        svg.remove();
      },
      resetZoom() {
        svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
      },
      getData() { return dataset; }
    };
  }

  function filterDataByTags(fullData, seedTags, depth = 1) {
    const seeds = new Set((seedTags || []).filter(Boolean));
    if (seeds.size === 0) return { nodes: [], links: [] };

    // Build adjacency
    const neighbors = new Map(); // tag -> Set(tag)
    for (const link of fullData.links || []) {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      if (!neighbors.has(s)) neighbors.set(s, new Set());
      if (!neighbors.has(t)) neighbors.set(t, new Set());
      neighbors.get(s).add(t);
      neighbors.get(t).add(s);
    }

    // BFS up to depth
    const visited = new Set();
    const queue = [];
    for (const s of seeds) {
      queue.push({ id: s, d: 0 });
      visited.add(s);
    }
    while (queue.length) {
      const { id, d } = queue.shift();
      if (d === depth) continue;
      const nbrs = neighbors.get(id);
      if (!nbrs) continue;
      for (const n of nbrs) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push({ id: n, d: d + 1 });
        }
      }
    }

    // Map nodes
    const nodeById = new Map((fullData.nodes || []).map(n => [n.id, n]));
    const nodes = [...visited].map(id => nodeById.get(id) || { id, count: 1 });

    // Keep links where both ends are included
    const links = (fullData.links || []).filter(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return visited.has(s) && visited.has(t);
    });

    return { nodes, links };
  }

  window.TagGraph = { createTagGraph, filterDataByTags };
})();