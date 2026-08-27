const youtubedl = require('youtube-dl-exec');

async function test() {
  try {
    const videoId = 'e-ORhEE9VVg'; // VEVO video
    console.log('Resolving with yt-dlp...');
    const output = await youtubedl(videoId, {
      dumpJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    // Choose the best audio format
    const audioFormats = output.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
    // Sort by audio bitrate descending
    audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
    
    if (audioFormats.length === 0) {
      console.log('No audio formats found');
      return;
    }
    
    const bestAudio = audioFormats[0];
    console.log(`Found audio format: ${bestAudio.format_id} (${bestAudio.acodec}, ${bestAudio.abr}kbps)`);
    console.log(`URL length: ${bestAudio.url.length}`);
    
    console.log('Testing Range request 0-65535...');
    const res1 = await fetch(bestAudio.url, { headers: { Range: 'bytes=0-65535' } });
    console.log(`Status: ${res1.status}, Content-Length: ${res1.headers.get('content-length')}`);
    
    console.log('Testing Range request 1048576-2097151 (cap check)...');
    const res2 = await fetch(bestAudio.url, { headers: { Range: 'bytes=1048576-2097151' } });
    console.log(`Status: ${res2.status}, Content-Length: ${res2.headers.get('content-length')}`);
    
  } catch (err) {
    console.error(err);
  }
}

test();
