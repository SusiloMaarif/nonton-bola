// Self-contained API — gak perlu VPS backend!
// Scraper langsung dari sumber publik pake Node.js fetch

module.exports = async (req, res) => {
  const startTime = Date.now();

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const searchQuery = req.query.q || '';

  try {
    // Route berdasarkan path
    if (path && path.includes('/matches')) {
      return await handleSearch(searchQuery, res);
    } else if (path && path.includes('/tvri')) {
      return res.json({
        status: 'ok',
        stream: {
          name: 'TVRI Live — Piala Dunia 2026',
          url: 'https://www.vidio.com/live/6441-tvri',
          type: 'direct',
          is_free: true,
          is_indonesia: true,
          description: 'Streaming resmi Piala Dunia 2026 dari TVRI — GRATIS dan LEGAL!'
        }
      });
    } else if (path && path.includes('/sources')) {
      return res.json({
        status: 'ok',
        sources: [
          { id: 'tvri', name: 'TVRI (Vidio)', type: 'direct', is_free: true, is_indonesia: true },
          { id: 'fifaplus', name: 'FIFA+', type: 'web', is_free: true },
          { id: 'wc26hub', name: 'WC26Hub', type: 'scraper', is_free: true },
          { id: 'youtube_fifa', name: 'YouTube FIFA', type: 'youtube', is_free: true }
        ]
      });
    } else {
      return res.json({ status: 'ok', message: 'Nonton Bola API — use /api/matches?q=tim' });
    }
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    console.log(`Request took ${Date.now() - startTime}ms`);
  }
};

async function handleSearch(query, res) {
  const results = [];

  // 1. Scrape dari WC26Hub
  try {
    const wcData = await scrapeWC26Hub();
    results.push(...wcData);
  } catch (e) {
    console.log('WC26Hub scrape failed:', e.message);
  }

  // Filter berdasarkan query
  let filtered = results;
  if (query) {
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
    filtered = results.filter(item => {
      const haystack = (item.name + ' ' + (item.source || '') + ' ' + (item.category || '')).toLowerCase();
      return keywords.every(k => haystack.includes(k));
    });
  }

  // Remove duplikat by URL
  const seen = new Set();
  const unique = filtered.filter(item => {
    const key = item.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Prioritaskan m3u8 > direct > iframe > web
  const priority = { m3u8: 0, direct: 1, iframe: 2, web: 3, youtube: 4 };
  unique.sort((a, b) => (priority[a.type] || 9) - (priority[b.type] || 9));

  return res.json({
    status: 'ok',
    count: unique.length,
    matches: unique,
    query: query,
    source: 'scraper'
  });
}

async function scrapeWC26Hub() {
  const results = [];

  // Ambil halaman utama WC26Hub
  const resp = await fetch('https://wc26hub.com/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000)
  });

  if (!resp.ok) return results;
  const html = await resp.text();

  // Cari semua link pertandingan
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].trim();

    // Filter: cuma link yang relevan (world cup, match, team names)
    if (url && text && text.length > 5) {
      const fullUrl = url.startsWith('http') ? url : `https://wc26hub.com${url.startsWith('/') ? '' : '/'}${url}`;
      const isMatch = /(?:vs\.?|world.?cup|group|match|stream|watch|kickoff)/i.test(text + url);

      if (isMatch && !url.match(/\.(css|js|png|jpg|svg|ico|json)$/i)) {
        results.push({
          name: text,
          url: fullUrl,
          type: url.includes('foxtrend') || url.includes('sportytrend') ? 'iframe' : 'web',
          source: 'WC26Hub',
          category: 'world_cup',
          is_free: true
        });
      }
    }
  }

  // Cari juga dari script data
  const m3u8Regex = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi;
  while ((match = m3u8Regex.exec(html)) !== null) {
    results.push({
      name: `Stream M3U8 #${results.length + 1}`,
      url: match[1],
      type: 'm3u8',
      source: 'WC26Hub',
      category: 'world_cup',
      is_free: true
    });
  }

  return results;
}
