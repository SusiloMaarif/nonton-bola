// Nonton Bola API v3 — IPTV M3U8 native player
// /api/proxy?endpoint=channels → curated channel list
// /api/proxy?endpoint=sports&q=keyword → search iptv-org sports
// /api/proxy?endpoint=proxy-m3u8&url=... → CORS proxy for M3U8 playlist
// /api/proxy?endpoint=proxy-segment&url=... → CORS proxy for TS segments

const SPORTS_PLAYLIST = 'https://iptv-org.github.io/iptv/categories/sports.m3u';
const ALL_SPORTS = 'https://iptv-org.github.io/iptv/categories/sports.m3u';
const FREE_TV = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
const INDONESIA = 'https://iptv-org.github.io/iptv/countries/id.m3u';

const TIMEOUT = 10000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, q, url } = req.query;

  try {
    switch (endpoint) {
      case 'channels': return await getChannels(res);
      case 'sports': return await searchSports(q || '', res);
      case 'proxy-m3u8': return await proxyPlaylist(url, res);
      case 'proxy-segment': return await proxySegment(url, res);
      default: return res.json({ status: 'ok', message: 'Nonton Bola API v3', endpoints: ['channels', 'sports', 'proxy-m3u8', 'proxy-segment'] });
    }
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
};

async function fetchWithTimeout(url, timeout = TIMEOUT) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow'
  });
  return resp;
}

// ============ CHANNEL LIST ============

async function getChannels(res) {
  // Kurasi channel sport yang paling likely nongol pas World Cup
  const channels = [
    {
      name: '📺 TVRI Nasional — 1080p',
      url: 'https://ott-balancer.tvri.go.id/live/eds/Nasional/hls/Nasional.m3u8',
      type: 'm3u8',
      is_free: true,
      is_indonesia: true,
      desc: 'Siaran resmi Piala Dunia 2026 — 1080p FULL HD!'
    },
    {
      name: '🎾 Trace Sport Stars',
      url: 'https://lightning-tracesport-samsungau.amagi.tv/playlist.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Trace Sport — channel olahraga international'
    },
    {
      name: '🇶🇦 Alkass One — 1080p (Arab)',
      url: 'https://liveeu-gcp.alkassdigital.net/alkass1-p/main.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Channel olahraga Arab 1080p — sering siaran Piala Dunia'
    },
    {
      name: '🇶🇦 Alkass Four — 1080p (Arab)',
      url: 'https://liveeu-gcp.alkassdigital.net/alkass4-p/main.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Channel olahraga Arab 1080p'
    },
    {
      name: '🌍 Africa 24 Sport — 1080p',
      url: 'https://africa24.vedge.infomaniak.com/livecast/ik:africa24sport/manifest.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Channel olahraga Afrika 24 — 1080p'
    },
    {
      name: '🇹🇷 A Spor (Turki)',
      url: 'https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/aspor/aspor.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Channel olahraga Turki'
    },
    {
      name: '⚽ 30A Golf Kingdom',
      url: 'https://30a-tv.com/feeds/vidaa/golf.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Channel golf 24/7'
    },
    {
      name: '🇮🇹 ACI Sport TV (Italia)',
      url: 'https://webstream.multistream.it/memfs/e2cb3629-c1a2-495b-b43a-9eb386f04ed8.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Channel olahraga Italia — motorsport'
    },
    {
      name: '🇮🇶 Al Iraqia Sport',
      url: 'https://imn-live.esite-lab.com/hls/iraqia-sports-1.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Channel olahraga Irak'
    },
    {
      name: '🇬🇪 Adjarasport 1 (Georgia)',
      url: 'https://live20.bozztv.com/dvrfl05/gin-adjara/index.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Channel olahraga Georgia'
    },
    {
      name: '🥊 Persiana Fight',
      url: 'https://fighthls.persiana.live/hls/stream.m3u8',
      type: 'm3u8',
      is_free: true,
      desc: 'Channel pertarungan internasional'
    },
    {
      name: '▶️ YouTube FIFA Highlights',
      url: 'https://www.youtube.com/@FIFAWorldCup',
      type: 'youtube',
      is_free: true,
      desc: 'Highlight & live streaming FIFA'
    },
    {
      name: '▶️ YouTube CazéTV (Brazil)',
      url: 'https://www.youtube.com/@cazetv',
      type: 'youtube',
      is_free: true,
      desc: 'Streaming GRATIS semua 104 pertandingan — Bahasa Portugis'
    }
  ];

  return res.json({ status: 'ok', count: channels.length, channels });
}

// ============ SPORTS PLAYLIST SEARCH ============

async function searchSports(query, res) {
  const channels = [];

  // Fetch dari iptv-org sports playlist
  try {
    const resp = await fetchWithTimeout(SPORTS_PLAYLIST);
    const text = await resp.text();
    const parsed = parseM3U(text, 'iptv-org');

    for (const ch of parsed) {
      const haystack = (ch.name + ' ' + (ch.group || '')).toLowerCase();
      if (!query || query.split(/\s+/).every(k => haystack.includes(k.toLowerCase()))) {
        channels.push(ch);
      }
    }
  } catch (e) {
    console.log('iptv-org error:', e.message);
  }

  // Juga fetch dari Free-TV kalo sepi
  if (channels.length < 5) {
    try {
      const resp2 = await fetchWithTimeout(FREE_TV);
      const text2 = await resp2.text();
      const parsed2 = parseM3U(text2, 'free-tv');
      for (const ch of parsed2) {
        const haystack = (ch.name + ' ' + (ch.group || '')).toLowerCase();
        if (ch.group?.toLowerCase().includes('sport') &&
            (!query || query.split(/\s+/).every(k => haystack.includes(k.toLowerCase())))) {
          if (!channels.find(c => c.url === ch.url)) {
            channels.push(ch);
          }
        }
      }
    } catch (e) { console.log('free-tv error:', e.message); }
  }

  return res.json({
    status: 'ok',
    count: channels.length,
    channels: channels.slice(0, 100),
    query
  });
}

function parseM3U(text, source) {
  const lines = text.split('\n');
  const channels = [];
  let currentInfo = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#EXTINF:')) {
      const nameMatch = trimmed.match(/,(.+)$/);
      const groupMatch = trimmed.match(/group-title="([^"]*)"/);
      const logoMatch = trimmed.match(/tvg-logo="([^"]*)"/);
      const tvgIdMatch = trimmed.match(/tvg-id="([^"]*)"/);

      if (nameMatch) {
        currentInfo = {
          name: nameMatch[1].trim(),
          group: groupMatch ? groupMatch[1] : 'Sports',
          logo: logoMatch ? logoMatch[1] : '',
          tvgId: tvgIdMatch ? tvgIdMatch[1] : '',
          source
        };
      }
    } else if (trimmed.startsWith('http') && currentInfo) {
      channels.push({
        name: currentInfo.name,
        url: trimmed,
        type: 'm3u8',
        group: currentInfo.group,
        logo: currentInfo.logo,
        is_free: true,
        source: currentInfo.source
      });
      currentInfo = null;
    }
  }
  return channels;
}

// ============ CORS PROXY ============

async function proxyPlaylist(targetUrl, res) {
  if (!targetUrl) return res.status(400).json({ error: 'Missing url' });

  const decodedUrl = decodeURIComponent(targetUrl);
  const resp = await fetchWithTimeout(decodedUrl);
  let text = await resp.text();

  // Rewrite relative URLs in M3U8 to absolute + proxy
  const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);

  text = text.replace(/^(https?:\/\/[^\s]+\.m3u8[^\s]*)/gim, (match) => {
    return match; // Keep absolute URLs as-is for direct play
  });

  text = text.replace(/^(?!https?:\/\/)([^\s#].*\.(m3u8|ts)[^\s]*)/gim, (match) => {
    const absUrl = match.startsWith('/') 
      ? new URL(match, decodedUrl).href 
      : baseUrl + match;
    return absUrl; // Rewrite relative to absolute
  });

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=30');
  return res.send(text);
}

async function proxySegment(targetUrl, res) {
  if (!targetUrl) return res.status(400).json({ error: 'Missing url' });

  try {
    const decodedUrl = decodeURIComponent(targetUrl);
    const resp = await fetchWithTimeout(decodedUrl, 15000);
    const buffer = Buffer.from(await resp.arrayBuffer());

    const ct = resp.headers.get('content-type') || 'video/mp2t';
    res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.send(buffer);
  } catch (e) {
    return res.status(502).json({ error: 'Proxy failed: ' + e.message });
  }
}
