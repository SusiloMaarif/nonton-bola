// Nonton Bola API — single endpoint buat semua kebutuhan
// Diakses via /api/proxy?endpoint=matches&q=xxx

module.exports = async (req, res) => {
  const start = Date.now();
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, q } = req.query;

  try {
    if (endpoint === 'matches') {
      return await searchMatches(q || '', res);
    } else if (endpoint === 'tvri') {
      return res.json({
        status: 'ok',
        stream: {
          name: 'TVRI Live — Piala Dunia 2026',
          url: 'https://www.vidio.com/live/6441-tvri',
          type: 'direct', is_free: true, is_indonesia: true
        }
      });
    } else if (endpoint === 'channels') {
      return res.json({
        status: 'ok',
        channels: [
          { name: 'FIFA+', url: 'https://www.fifa.com/fifaplus/en/tv-schedule', type: 'direct' },
          { name: 'YouTube FIFA', url: 'https://www.youtube.com/@FIFAWorldCup', type: 'youtube' }
        ]
      });
    } else {
      return res.json({ status: 'ok', message: 'Nonton Bola API. Gunakan: /api/proxy?endpoint=matches&q=tim' });
    }
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  } finally {
    console.log(`[${endpoint}] ${Date.now() - start}ms`);
  }
};

function extractLinks(html) {
  const results = [];
  // Cari semua anchor tags pake metode manual biar ga ribet regex
  const parts = html.split('<a ');
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const hrefMatch = part.match(/href="([^"]*)"/);
    const textMatch = part.match(/>([^<]*)<\//);
    if (!hrefMatch || !textMatch) continue;
    
    const url = hrefMatch[1];
    const text = textMatch[1].trim();
    if (!text || text.length < 5) continue;
    if (url.match(/\.(css|js|png|jpg|svg|ico|json)$/i)) continue;
    
    const fullUrl = url.startsWith('http') ? url : 'https://wc26hub.com' + (url.startsWith('/') ? '' : '/') + url;
    
    results.push({ url: fullUrl, text });
  }
  return results;
}

async function searchMatches(query, res) {
  const results = [];

  // Scrape dari WC26Hub
  try {
    const resp = await fetch('https://wc26hub.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(12000)
    });
    const html = await resp.text();

    // Ekstrak link pertandingan dari HTML
    const links = extractLinks(html);
    for (const { url, text } of links) {
      const isRelevant = /(?:vs\.?|world.?cup|match|stream|group|watch|kickoff|soccer|football|bola)/i.test(text + url);
      if (!isRelevant) continue;
      
      const type = url.includes('foxtrend') || url.includes('sportytrend') ? 'iframe' : 'web';
      results.push({
        name: text, url, type,
        source: 'WC26Hub', category: 'world_cup', is_free: true
      });
    }

    // Ekstrak M3U8 links dari seluruh HTML
    const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
    let m;
    while ((m = m3u8Regex.exec(html)) !== null) {
      results.push({
        name: `Stream M3U8 #${results.length + 1}`,
        url: m[0], type: 'm3u8',
        source: 'WC26Hub', category: 'world_cup', is_free: true
      });
      if (results.length > 60) break;
    }
  } catch (e) {
    console.log('WC26Hub scrape error:', e.message);
  }

  // Filter berdasarkan query
  let filtered = results;
  if (query) {
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
    filtered = results.filter(r => {
      const haystack = (r.name + ' ' + r.source + ' ' + (r.category || '')).toLowerCase();
      return keywords.every(k => haystack.includes(k));
    });
  }

  // Dedup by URL
  const seen = new Set();
  filtered = filtered.filter(r => {
    const key = r.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by type priority
  const prio = { m3u8: 0, direct: 1, iframe: 2, web: 3, youtube: 4 };
  filtered.sort((a, b) => (prio[a.type] || 9) - (prio[b.type] || 9));

  return res.json({
    status: 'ok',
    count: filtered.length,
    matches: filtered.slice(0, 50),
    query
  });
}
