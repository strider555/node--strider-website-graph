const fs = require('fs');
const path = require('path');

// CSV parsing helper
function parseCSV(text) {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Parse JSON array field safely
function parseJSONArray(str) {
  if (!str || str === '""' || str === '') return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Extract decade from year
function getDecade(year) {
  const y = parseInt(year);
  if (isNaN(y) || y < 1900 || y > 2029) return null;
  const decade = Math.floor(y / 10) * 10;
  return `${decade}s`;
}

console.log('Reading M+ Museum data...');

// Read CSV files
const objectsPath = '/home/ubuntu/mplus-data/objects.csv';
const constituentsPath = '/home/ubuntu/mplus-data/constituents.csv';

const objectsText = fs.readFileSync(objectsPath, 'utf8');
const constituentsText = fs.readFileSync(constituentsPath, 'utf8');

console.log('Parsing CSV data...');
const objectsData = parseCSV(objectsText);
const constituentsData = parseCSV(constituentsText);

// Build constituent lookup
const constituentMap = new Map();
constituentsData.forEach(c => {
  constituentMap.set(c.id, {
    id: c.id,
    name: c.name || '',
    nameTC: c.nameTC || '',
    nationality: c.nationality || '',
    bio: c.displayBio || '',
    type: c.type || ''
  });
});

console.log(`Loaded ${objectsData.length} objects, ${constituentsData.length} constituents`);

// Sigg Collection Related Artist names (137 artists from M+ Sigg Prize)
const siggArtistNames = [
  "Ai Weiwei", "An Hong", "Bai Yiluo", "Cao Fei", "Cao Kai", "Chang-Jin Lee", "Chen Chieh-Jen", "Chen Linggang",
  "Chen Qiulin", "Chen Shaoxiong", "Chen Wenbo", "Chen Xiaoyun", "Chen Zhen", "Chi Peng", "Chu Yun", "Cui Xiuwen",
  "Ding Yi", "Fang Lijun", "Feng Mengbo", "Geng Jianyi", "Gu Dexin", "Gu Wenda", "Guo Fengyi", "Hai Bo", "He An",
  "He Yunchang", "Hong Hao", "Hong Lei", "Huang Kui", "Huang Yan", "Huang Yong Ping", "Ji Dachun", "Jian Jun Xi",
  "Jiang Pengyi", "Jiang Zhi", "Kan Xuan", "Li Dafang", "Li Hui", "Li Liao", "Li Qing", "Li Shurui", "Li Songsong",
  "Li Wei", "Li Zhanyang", "Liang Shaoji", "Liang Shuo", "Liang Yuanwei", "Lin Tianmiao", "Lin Yilin", "Liu Ding",
  "Liu Wei", "Liu Xiaodong", "Lu Hao", "Lu Lei", "Luo Yongjin", "Ma Han", "Ma Liuming", "Ma Qiusha", "Mao Tongqiang",
  "Mao Yan", "Mu Chen", "MadeIn Company", "Ni Haifeng", "Peng Yu", "Pu Jie", "Qin Ga", "Qiu Anxiong", "Qiu Shihua",
  "Qiu Xiaofei", "Qiu Zhijie", "Shao Yinong", "Shen Fan", "Shen Shaomin", "Shi Guorui", "Shi Xinning", "Song Dong",
  "Song Tao", "Sui Jianguo", "Sun Yuan", "Tang Maohong", "Wang Du", "Wang Gongxin", "Wang Guangyi", "Wang Jianwei",
  "Wang Jin", "Wang Keping", "Wang Luyan", "Wang Peng", "Wang Qingsong", "Wang Sishun", "Wang Tuo", "Wang Xingwei",
  "Wang Yin", "Weng Fen", "Wong Hoy Cheong", "Wu Shanzhuan", "Xiang Liqing", "Xiao Yu", "Xu Bing", "Xu Zhen",
  "Yan Lei", "Yan Peiming", "Yang Fudong", "Yang Jiechang", "Yang Shaobin", "Yang Yongliang", "Yang Zhenzhong",
  "Yangjiang Group", "Yao Jui-Chung", "Yi Zhou", "Yin Xiuzhen", "Yu Ji", "Yuan Shun", "Zeng Fanzhi", "Zeng Hao",
  "Zhang Dali", "Zhang Enli", "Zhang Huan", "Zhang Peili", "Zhang Xiaogang", "Zheng Guogu", "Zhou Chunya",
  "Zhou Tiehai", "Zhu Fadong", "Zhu Jia", "Zhu Jinshi", "Zhuang Hui", "Heidi Lau", "Wong Ping", "Samson Young"
];

// Find Sigg artist IDs by matching names
const siggArtistIds = new Set();
constituentsData.forEach(c => {
  const name = c.name || '';
  if (siggArtistNames.includes(name)) {
    siggArtistIds.add(c.id);
  }
});

console.log(`Found ${siggArtistIds.size} Sigg artists in collection`);

// Process objects and collect tag statistics
const tagCounts = new Map();
const tagTypes = new Map(); // tag -> type (area/category/medium/nationality/decade)
const linkPairs = new Map(); // "tag1|tag2" -> weight
const objectsByTag = new Map(); // tag -> [object objects (compact)]
const artistCounts = new Map();

// Sigg-specific data structures
const siggTagCounts = new Map();
const siggLinkPairs = new Map();
const siggObjectsByTag = new Map();
const siggObjects = []; // Track all Sigg objects

objectsData.forEach((obj, idx) => {
  const id = obj.id;
  const title = obj.title || 'Untitled';
  const titleTC = obj.titleTC || '';
  const areas = parseJSONArray(obj.area);
  const categories = parseJSONArray(obj.category);
  const medium = obj.medium || '';
  const mediumTC = obj.mediumTC || '';
  const displayDate = obj.displayDate || '';
  const beginDate = obj.beginDate || '';

  // Parse constituents (artists) - constituents field contains array of IDs
  const constituentIds = parseJSONArray(obj.constituents);
  let artistId = '';
  let artistName = '';
  let artistNameTC = '';
  let nationality = '';

  if (constituentIds.length > 0) {
    const mainArtistId = String(constituentIds[0]);
    const artist = constituentMap.get(mainArtistId);
    if (artist) {
      artistId = mainArtistId;
      artistName = artist.name;
      artistNameTC = artist.nameTC;
      nationality = artist.nationality;

      artistCounts.set(artistId, (artistCounts.get(artistId) || 0) + 1);
    }
  }

  // Check if this is a Sigg Collection object
  const isSiggObject = artistId && siggArtistIds.has(artistId);

  // Compact object representation
  const objCompact = {
    id,
    title,
    titleTC,
    areas: areas.slice(0, 3), // limit arrays
    categories: categories.slice(0, 3),
    medium: medium.substring(0, 60), // limit string length
    mediumTC: mediumTC.substring(0, 60),
    date: displayDate,
    artistName,
    artistNameTC,
    nationality
  };

  // Collect all tags for this object
  const objTags = [];

  // Add area tags
  areas.forEach(area => {
    if (area) {
      objTags.push(area);
      tagCounts.set(area, (tagCounts.get(area) || 0) + 1);
      tagTypes.set(area, 'area');
      if (!objectsByTag.has(area)) objectsByTag.set(area, []);
      // Only store first 50 objects per tag to reduce file size
      if (objectsByTag.get(area).length < 50) {
        objectsByTag.get(area).push(objCompact);
      }

      // Track Sigg data
      if (isSiggObject) {
        siggTagCounts.set(area, (siggTagCounts.get(area) || 0) + 1);
        if (!siggObjectsByTag.has(area)) siggObjectsByTag.set(area, []);
        if (siggObjectsByTag.get(area).length < 50) {
          siggObjectsByTag.get(area).push(objCompact);
        }
      }
    }
  });

  // Add category tags
  categories.forEach(cat => {
    if (cat) {
      objTags.push(cat);
      tagCounts.set(cat, (tagCounts.get(cat) || 0) + 1);
      tagTypes.set(cat, 'category');
      if (!objectsByTag.has(cat)) objectsByTag.set(cat, []);
      if (objectsByTag.get(cat).length < 50) {
        objectsByTag.get(cat).push(objCompact);
      }

      // Track Sigg data
      if (isSiggObject) {
        siggTagCounts.set(cat, (siggTagCounts.get(cat) || 0) + 1);
        if (!siggObjectsByTag.has(cat)) siggObjectsByTag.set(cat, []);
        if (siggObjectsByTag.get(cat).length < 50) {
          siggObjectsByTag.get(cat).push(objCompact);
        }
      }
    }
  });

  // Add medium tag (simplified)
  if (medium) {
    const mediumTag = medium.split(',')[0].trim();
    if (mediumTag && mediumTag.length < 50) { // Filter out overly long mediums
      objTags.push(mediumTag);
      tagCounts.set(mediumTag, (tagCounts.get(mediumTag) || 0) + 1);
      tagTypes.set(mediumTag, 'medium');
      if (!objectsByTag.has(mediumTag)) objectsByTag.set(mediumTag, []);
      if (objectsByTag.get(mediumTag).length < 50) {
        objectsByTag.get(mediumTag).push(objCompact);
      }

      // Track Sigg data
      if (isSiggObject) {
        siggTagCounts.set(mediumTag, (siggTagCounts.get(mediumTag) || 0) + 1);
        if (!siggObjectsByTag.has(mediumTag)) siggObjectsByTag.set(mediumTag, []);
        if (siggObjectsByTag.get(mediumTag).length < 50) {
          siggObjectsByTag.get(mediumTag).push(objCompact);
        }
      }
    }
  }

  // Add nationality tag
  if (nationality && nationality.length < 50) {
    objTags.push(nationality);
    tagCounts.set(nationality, (tagCounts.get(nationality) || 0) + 1);
    tagTypes.set(nationality, 'nationality');
    if (!objectsByTag.has(nationality)) objectsByTag.set(nationality, []);
    if (objectsByTag.get(nationality).length < 50) {
      objectsByTag.get(nationality).push(objCompact);
    }

    // Track Sigg data
    if (isSiggObject) {
      siggTagCounts.set(nationality, (siggTagCounts.get(nationality) || 0) + 1);
      if (!siggObjectsByTag.has(nationality)) siggObjectsByTag.set(nationality, []);
      if (siggObjectsByTag.get(nationality).length < 50) {
        siggObjectsByTag.get(nationality).push(objCompact);
      }
    }
  }

  // Add decade tag
  if (beginDate) {
    const decade = getDecade(beginDate);
    if (decade) {
      objTags.push(decade);
      tagCounts.set(decade, (tagCounts.get(decade) || 0) + 1);
      tagTypes.set(decade, 'decade');
      if (!objectsByTag.has(decade)) objectsByTag.set(decade, []);
      if (objectsByTag.get(decade).length < 50) {
        objectsByTag.get(decade).push(objCompact);
      }

      // Track Sigg data
      if (isSiggObject) {
        siggTagCounts.set(decade, (siggTagCounts.get(decade) || 0) + 1);
        if (!siggObjectsByTag.has(decade)) siggObjectsByTag.set(decade, []);
        if (siggObjectsByTag.get(decade).length < 50) {
          siggObjectsByTag.get(decade).push(objCompact);
        }
      }
    }
  }

  // Generate co-occurrence links
  for (let i = 0; i < objTags.length; i++) {
    for (let j = i + 1; j < objTags.length; j++) {
      const tag1 = objTags[i];
      const tag2 = objTags[j];
      const pair = tag1 < tag2 ? `${tag1}|${tag2}` : `${tag2}|${tag1}`;
      linkPairs.set(pair, (linkPairs.get(pair) || 0) + 1);

      // Track Sigg links
      if (isSiggObject) {
        siggLinkPairs.set(pair, (siggLinkPairs.get(pair) || 0) + 1);
      }
    }
  }

  // Track Sigg object
  if (isSiggObject) {
    siggObjects.push(objCompact);
  }
});

console.log(`Total tags before filtering: ${tagCounts.size}`);
console.log(`Total links before filtering: ${linkPairs.size}`);

// Filter and select top tags by type
const minTagCount = 5;
const filteredTags = new Map();

// Keep all area tags (there are only 3)
for (const [tag, count] of tagCounts.entries()) {
  if (tagTypes.get(tag) === 'area') {
    filteredTags.set(tag, { count, type: 'area' });
  }
}

// Select top categories, mediums, nationalities
const categories = [...tagCounts.entries()]
  .filter(([tag]) => tagTypes.get(tag) === 'category')
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .filter(([, count]) => count >= minTagCount);

const mediums = [...tagCounts.entries()]
  .filter(([tag]) => tagTypes.get(tag) === 'medium')
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .filter(([, count]) => count >= minTagCount);

const nationalities = [...tagCounts.entries()]
  .filter(([tag]) => tagTypes.get(tag) === 'nationality')
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .filter(([, count]) => count >= minTagCount);

const decades = [...tagCounts.entries()]
  .filter(([tag]) => tagTypes.get(tag) === 'decade')
  .sort((a, b) => b[1] - a[1])
  .filter(([, count]) => count >= minTagCount);

categories.forEach(([tag, count]) => filteredTags.set(tag, { count, type: 'category' }));
mediums.forEach(([tag, count]) => filteredTags.set(tag, { count, type: 'medium' }));
nationalities.forEach(([tag, count]) => filteredTags.set(tag, { count, type: 'nationality' }));
decades.forEach(([tag, count]) => filteredTags.set(tag, { count, type: 'decade' }));

console.log(`Filtered tags: ${filteredTags.size} (areas: ${[...filteredTags.values()].filter(t => t.type === 'area').length}, categories: ${categories.length}, mediums: ${mediums.length}, nationalities: ${nationalities.length}, decades: ${decades.length})`);

// Build tag nodes array
const tagNodes = [];
filteredTags.forEach((data, tag) => {
  tagNodes.push({
    id: tag,
    count: data.count,
    type: data.type
  });
});

// Process Sigg Collection data (lower thresholds due to smaller dataset)
console.log(`\nProcessing Sigg Collection data (${siggObjects.length} objects)...`);
const minSiggTagCount = 2; // Lower threshold for Sigg data
const filteredSiggTags = new Map();

// Keep all area tags for Sigg
for (const [tag, count] of siggTagCounts.entries()) {
  if (tagTypes.get(tag) === 'area') {
    filteredSiggTags.set(tag, { count, type: 'area' });
  }
}

// Select top Sigg categories, mediums, nationalities, decades
const siggCategories = [...siggTagCounts.entries()]
  .filter(([tag]) => tagTypes.get(tag) === 'category')
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .filter(([, count]) => count >= minSiggTagCount);

const siggMediums = [...siggTagCounts.entries()]
  .filter(([tag]) => tagTypes.get(tag) === 'medium')
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .filter(([, count]) => count >= minSiggTagCount);

const siggNationalities = [...siggTagCounts.entries()]
  .filter(([tag]) => tagTypes.get(tag) === 'nationality')
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .filter(([, count]) => count >= minSiggTagCount);

const siggDecades = [...siggTagCounts.entries()]
  .filter(([tag]) => tagTypes.get(tag) === 'decade')
  .sort((a, b) => b[1] - a[1])
  .filter(([, count]) => count >= minSiggTagCount);

siggCategories.forEach(([tag, count]) => filteredSiggTags.set(tag, { count, type: 'category' }));
siggMediums.forEach(([tag, count]) => filteredSiggTags.set(tag, { count, type: 'medium' }));
siggNationalities.forEach(([tag, count]) => filteredSiggTags.set(tag, { count, type: 'nationality' }));
siggDecades.forEach(([tag, count]) => filteredSiggTags.set(tag, { count, type: 'decade' }));

console.log(`Filtered Sigg tags: ${filteredSiggTags.size} (areas: ${[...filteredSiggTags.values()].filter(t => t.type === 'area').length}, categories: ${siggCategories.length}, mediums: ${siggMediums.length}, nationalities: ${siggNationalities.length}, decades: ${siggDecades.length})`);

// Build Sigg tag nodes array
const siggTagNodes = [];
filteredSiggTags.forEach((data, tag) => {
  siggTagNodes.push({
    id: tag,
    count: data.count,
    type: data.type
  });
});

// Filter Sigg links - only keep links between filtered Sigg tags with weight >= 2
const minSiggLinkWeight = 2;
const siggLinks = [];
siggLinkPairs.forEach((weight, pair) => {
  if (weight < minSiggLinkWeight) return;
  const [tag1, tag2] = pair.split('|');
  if (filteredSiggTags.has(tag1) && filteredSiggTags.has(tag2)) {
    siggLinks.push({ source: tag1, target: tag2, weight });
  }
});

console.log(`Filtered Sigg links: ${siggLinks.length}`);

// Build Sigg objectsByTag for filtered tags only
const siggObjectsByTagFiltered = {};
filteredSiggTags.forEach((data, tag) => {
  siggObjectsByTagFiltered[tag] = siggObjectsByTag.get(tag) || [];
});

// Filter links - only keep links between filtered tags with weight >= 3
const minLinkWeight = 3;
const links = [];
linkPairs.forEach((weight, pair) => {
  if (weight < minLinkWeight) return;
  const [tag1, tag2] = pair.split('|');
  if (filteredTags.has(tag1) && filteredTags.has(tag2)) {
    links.push({ source: tag1, target: tag2, weight });
  }
});

console.log(`Filtered links: ${links.length}`);

// Build artist data - top 200 artists
const artists = [];
constituentMap.forEach((artist, id) => {
  const count = artistCounts.get(id) || 0;
  if (count > 0) {
    artists.push({
      id: artist.id,
      name: artist.name,
      nameTC: artist.nameTC,
      nationality: artist.nationality,
      bio: artist.bio.substring(0, 200), // Limit bio length
      objectCount: count
    });
  }
});

// Sort artists by object count and take top 200
artists.sort((a, b) => b.objectCount - a.objectCount);
const topArtists = artists.slice(0, 200);

console.log(`Artists with works: ${artists.length}, including top ${topArtists.length} in output`);

// Build objectsByTag for filtered tags only
const objectsByTagFiltered = {};
filteredTags.forEach((data, tag) => {
  objectsByTagFiltered[tag] = objectsByTag.get(tag) || [];
});

// Build final output (compact format)
const output = {
  tags: tagNodes,
  links: links,
  objectsByTag: objectsByTagFiltered,
  artists: topArtists,
  stats: {
    totalObjects: objectsData.length,
    totalArtists: artists.length,
    totalTags: tagNodes.length,
    totalLinks: links.length
  },
  // Sigg Collection data
  siggTags: siggTagNodes,
  siggLinks: siggLinks,
  siggObjectsByTag: siggObjectsByTagFiltered,
  siggArtistIds: Array.from(siggArtistIds),
  siggStats: {
    totalObjects: siggObjects.length,
    totalArtists: siggArtistIds.size,
    totalTags: siggTagNodes.length,
    totalLinks: siggLinks.length
  }
};

// Write to file
const outputPath = path.join(__dirname, '../data/museum-index.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
console.log(`\nOutput written to: ${outputPath}`);
console.log(`File size: ${sizeMB} MB`);
console.log(`\nSummary:`);
console.log(`  - Total objects in collection: ${objectsData.length}`);
console.log(`  - Tags: ${tagNodes.length}`);
console.log(`  - Links: ${links.length}`);
console.log(`  - Artists (top): ${topArtists.length}`);
console.log(`  - Objects stored per tag (max 50 each)`);
console.log(`\nSigg Collection:`);
console.log(`  - Sigg objects: ${siggObjects.length}`);
console.log(`  - Sigg artists: ${siggArtistIds.size}`);
console.log(`  - Sigg tags: ${siggTagNodes.length}`);
console.log(`  - Sigg links: ${siggLinks.length}`);
