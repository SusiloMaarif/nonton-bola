// Nonton Bola API v2 — multi-source scraper
// /api/proxy?endpoint=matches&q=tim
// /api/proxy?endpoint=channels

const FETCH_TIMEOUT = 12000;

module.exports = async (req, res) => {
  const start = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, q } = req.query;

  try {
    if (endpoint === 'matches') return await searchMatches(q || '', res);
    if (endpoint === 'channels') return await getChannels(res);
    return res.json({ status: 'ok', message: 'Nonton Bola API' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  } finally {
    console.log(`[${endpoint}] ${Date.now() - start}ms`);
  }
};

async function fetchText(url, timeout = FETCH_TIMEOUT) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow'
  });
  return resp.text();
}

function extractLinks(html, baseUrl) {
  const results = [];
  const parts = html.split('<a ');
  for (let i = 1; i < parts.length; i++) {
    const hrefMatch = parts[i].match(/href="([^"]*)"/);
    const textMatch = parts[i].match(/>([^<]*)<\//);
    if (!hrefMatch || !textMatch) continue;
    const url = hrefMatch[1];
    const text = textMatch[1].trim();
    if (!text || text.length < 3) continue;
    if (url.match(/\.(css|js|png|jpg|svg|ico|json)$/i)) continue;
    const fullUrl = url.startsWith('http') ? url : baseUrl + (url.startsWith('/') ? '' : '/') + url;
    results.push({ url: fullUrl, text });
  }
  return results;
}

async function scrapeWc26Hub() {
  const results = [];
  const html = await fetchText('https://wc26hub.com/');
  const links = extractLinks(html, 'https://wc26hub.com');

  for (const { url, text } of links) {
    const isRelevant = /(?:vs\.?|world.?cup|match|stream|group|watch|kickoff|soccer|football|bola|live)/i.test(text + url);
    if (!isRelevant) continue;
    const type = /foxtrend|sportytrend|ifootybite/.test(url) ? 'iframe' : 'web';
    results.push({ name: text, url, type, source: 'WC26Hub', category: 'world_cup', is_free: true });
  }

  // M3U8 dari halaman
  const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
  let m;
  while ((m = m3u8Regex.exec(html)) !== null) {
    results.push({ name: `Stream M3U8 #${results.length + 1}`, url: m[0], type: 'm3u8', source: 'WC26Hub', category: 'world_cup', is_free: true });
    if (results.length > 60) break;
  }
  return results;
}

async function scrapeFoxTrend() {
  const results = [];
  try {
    // FoxTrend pake foxtrend.org (redirect dari .vip)
    const html = await fetchText('https://foxtrend.org/', 10000);
    const links = extractLinks(html, 'https://foxtrend.org');
    for (const { url, text } of links) {
      if (!/(?:vs\.?|match|live|stream|watch|soccer|football|premier|laliga|champions|world.?cup)/i.test(text + url)) continue;
      if (url.match(/\.(css|js|png|jpg|svg|ico|woff|ttf)$/i)) continue;
      results.push({ name: text, url, type: 'iframe', source: 'FoxTrend', category: 'soccer', is_free: true });
      if (results.length > 30) break;
    }
  } catch (e) { console.log('FoxTrend error:', e.message); }
  return results;
}

async function scrapeSportyTrend() {
  const results = [];
  try {
    // SportyTrend redirect ke ifootybite.xyz
    const html = await fetchText('https://ifootybite.xyz/Soccer', 10000);
    const links = extractLinks(html, 'https://ifootybite.xyz');
    for (const { url, text } of links) {
      if (!/(?:vs\.?|match|live|stream|watch|soccer|football|premier|laliga|champions|world.?cup)/i.test(text + url)) continue;
      if (url.match(/\.(css|js|png|jpg|svg|ico|woff|ttf)$/i)) continue;
      results.push({ name: text, url, type: 'iframe', source: 'ifootybite', category: 'soccer', is_free: true });
      if (results.length > 30) break;
    }
  } catch (e) { console.log('SportyTrend error:', e.message); }
  return results;
}

async function getChannels(res) {
  return res.json({
    status: 'ok',
    channels: [
      { name: '📺 TVRI — Piala Dunia 2026 (GRATIS)', url: 'https://www.vidio.com/live/6441-tvri', type: 'direct', is_free: true, is_indonesia: true, desc: 'Siaran resmi 104 pertandingan!' },
      { name: '🌍 FIFA+ — Official Stream', url: 'https://www.fifa.com/fifaplus/en/tv-schedule', type: 'direct', is_free: true, desc: 'Streaming resmi FIFA' },
      { name: '▶️ YouTube FIFA World Cup', url: 'https://www.youtube.com/@FIFAWorldCup', type: 'youtube', is_free: true, desc: 'Highlight & siaran langsung' },
      { name: '⚡ FoxTrend Soccer', url: 'https://foxtrend.org/Soccer', type: 'iframe', is_free: true, desc: 'Live soccer streams' },
      { name: '⚡ iFootybite Soccer', url: 'https://ifootybite.xyz/Soccer', type: 'iframe', is_free: true, desc: 'Live soccer streams alternatif' },
      { name: '📋 WC26Hub Schedule', url: 'https://wc26hub.com/worldcup26/', type: 'web', is_free: true, desc: 'Jadwal + link streaming' },
      { name: '🏆 WC26Hub Live', url: 'https://wc26hub.com/', type: 'web', is_free: true, desc: 'Halaman utama streaming' },
      { name: '🎥 YouTube Highlights', url: 'https://www.youtube.com/results?search_query=world+cup+2026+full+match', type: 'youtube', is_free: true, desc: 'Cari highlight di YouTube' },
    ]
  });
}

async function searchMatches(query, res) {
  const results = [];

  // Scrape dari 3 sumber
  const scrapers = [scrapeWc26Hub(), scrapeFoxTrend(), scrapeSportyTrend()];
  const scraped = await Promise.allSettled(scrapers);

  for (const s of scraped) {
    if (s.status === 'fulfilled') results.push(...s.value);
  }

  // Filter
  let filtered = results;
  if (query) {
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
    filtered = results.filter(r => {
      const haystack = (r.name + ' ' + r.source + ' ' + (r.category || '')).toLowerCase();
      return keywords.every(k => haystack.includes(k));
    });
  }

  // Dedup
  const seen = new Set();
  filtered = filtered.filter(r => { const k = r.url; if (seen.has(k)) return false; seen.add(k); return true; });

  // Sort
  const prio = { m3u8: 0, iframe: 1, direct: 2, youtube: 3, web: 4 };
  filtered.sort((a, b) => (prio[a.type] || 9) - (prio[b.type] || 9));

  return res.json({ status: 'ok', count: filtered.length, matches: filtered.slice(0, 50), query });
}
