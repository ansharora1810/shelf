import { FetchSource, Recipe } from './types'
import {
  OG_POLL_INTERVAL_MS,
  OG_POLL_MAX_TRIES,
  IG_NAME_MAX_LEN,
  DEBUG_PARSING,
} from '../../constants/pipeline'

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Safari/605.1.15'

// Each extractor is injected as a string and runs inside the loaded page. It
// must post exactly one message — an ExtractedContent object or null — and end
// with `true;` so the WebView injection itself returns a defined value.

const POST = (body: string) => `
(function () {
  try {
    var post = function (v) {
      window.ReactNativeWebView.postMessage(JSON.stringify(v));
    };
    ${body}
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify(null));
  }
})();
true;
`

const youtubeExtractor = POST(`
  var r = window.ytInitialPlayerResponse;
  if (!r || (r.playabilityStatus && r.playabilityStatus.status !== 'OK')) {
    post(null); return;
  }
  var d = r.videoDetails;
  if (!d) { post(null); return; }
  var thumbs = (d.thumbnail && d.thumbnail.thumbnails) || [];
  var best = thumbs.reduce(function (a, b) {
    return (b.width || 0) > ((a && a.width) || 0) ? b : a;
  }, null);
  var len = parseInt(d.lengthSeconds, 10);
  post({
    title: d.title || null,
    rawContent: d.shortDescription || null,
    thumbnailUrl: best ? best.url : null,
    consumeTime: isNaN(len) ? null : len,
    author: d.author || null,
  });
`)

// Verified logged-out (HTTP 200, no login wall): og:title/og:description are in
// Instagram's server-rendered HTML before JS runs. Poll the <head> briefly for
// them. Thumbnail is NOT og:image (its signed tokens expire in hours) — instead
// the /p/<shortcode>/media/?size=l redirect, built from the URL's shortcode,
// which 302s to a fresh signed image on every load, so the stored URL never goes
// stale. It loads via native <Image> (no CORS) — we only build the string here.
const instagramExtractor = `
(function () {
  var done = false;
  var post = function (v) {
    if (done) return;
    done = true;
    window.ReactNativeWebView.postMessage(JSON.stringify(v));
  };
  var meta = function (prop) {
    var el = document.head && document.head.querySelector('meta[property="' + prop + '"]');
    return el ? el.getAttribute('content') : null;
  };
  var shortcode = (location.pathname.match(/\\/(?:reel|reels|p|tv)\\/([^\\/?#]+)/) || [])[1] || null;
  var thumb = shortcode
    ? 'https://www.instagram.com/p/' + shortcode + '/media/?size=l'
    : null;
  var build = function (ogTitle, desc) {
    // og:description is "N likes, M comments - <handle> on <date>: \\"caption\\"" —
    // pull out the handle and the quoted caption.
    var handle = null;
    if (desc) {
      var hm = desc.match(/-\\s*([^\\s]+)\\s+on\\s/);
      if (hm) handle = hm[1];
    }
    var caption = desc;
    if (desc) {
      var q = desc.match(/"([\\s\\S]*)"/);
      if (q) caption = q[1];
    }
    var name = (handle && caption) ? ('@' + handle + ': ' + caption) : (caption || ogTitle || null);
    if (name && name.length > ${IG_NAME_MAX_LEN}) name = name.slice(0, ${IG_NAME_MAX_LEN}).replace(/\\s+$/, '') + '…';
    return {
      title: name,
      rawContent: caption || null,
      thumbnailUrl: thumb || meta('og:image') || null,
      consumeTime: null,
      author: handle,
    };
  };
  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;
    var title = meta('og:title');
    var desc = meta('og:description');
    if (title || desc) {
      clearInterval(timer);
      post(build(title, desc));
    } else if (tries > ${OG_POLL_MAX_TRIES}) {
      clearInterval(timer);
      post(thumb ? build(null, null) : null);
    }
  }, ${OG_POLL_INTERVAL_MS});
})();
true;
`

// In-app the WebView is a logged-out WKWebView. www.reddit.com serves a JS SPA
// whose og tags aren't reliably in the DOM for a logged-out client, so we
// navigate to old.reddit.com instead — it returns complete static server-
// rendered HTML (og tags + post body) to logged-out clients, no hydration.
// VERIFIED on-device: a logged-out WKWebView extracts og:title/description/image
// from old.reddit. (og:image is a signed preview.redd.it URL that can expire —
// v1-accepted; rehost in v2.)
const redditExtractor = `
(function () {
  var done = false;
  var post = function (v) {
    if (done) return;
    done = true;
    window.ReactNativeWebView.postMessage(JSON.stringify(v));
  };
  var meta = function (prop) {
    var el = document.querySelector('meta[property="' + prop + '"]');
    return el ? el.getAttribute('content') : null;
  };
  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;
    var title = meta('og:title');
    var desc = meta('og:description');
    var image = meta('og:image');
    if (title || desc || image) {
      clearInterval(timer);
      if (title) title = title.replace(/\\s*:\\s*r\\/[A-Za-z0-9_]+\\s*$/, '').trim();
      post({
        title: title || null,
        rawContent: desc || null,
        thumbnailUrl: image || null,
        consumeTime: null,
        author: null,
      });
    } else if (tries > ${OG_POLL_MAX_TRIES}) {
      clearInterval(timer);
      post(null);
    }
  }, ${OG_POLL_INTERVAL_MS});
})();
true;
`

const websiteExtractor = POST(`
  var meta = function (prop) {
    var el = document.querySelector('meta[property="' + prop + '"], meta[name="' + prop + '"]');
    return el ? el.getAttribute('content') : null;
  };
  var clone = document.body ? document.body.cloneNode(true) : null;
  var text = '';
  if (clone) {
    clone.querySelectorAll('script,style,nav,header,footer,aside,noscript').forEach(function (n) {
      n.remove();
    });
    text = (clone.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim();
  }
  var dbg = ${DEBUG_PARSING}
    ? {
        url: location.href,
        title: document.title,
        htmlLen: document.documentElement.outerHTML.length,
        html: document.documentElement.outerHTML.slice(0, 10000),
        bodyTextLen: text.length,
      }
    : undefined;
  post({
    title: meta('og:title') || document.title || null,
    rawContent: text || meta('og:description') || null,
    thumbnailUrl: meta('og:image') || null,
    consumeTime: null,
    author: meta('article:author') || null,
    _debug: dbg,
  });
`)

function youtubeUrl(url: string): string {
  const id = youtubeVideoId(url)
  return id ? `https://www.youtube.com/watch?v=${id}&app=desktop` : url
}

function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1) || null
    return u.searchParams.get('v')
  } catch {
    return null
  }
}

// old.reddit.com serves complete static HTML to logged-out clients (the new SPA
// does not), so route Reddit there for the WebView fetch.
function redditUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hostname = 'old.reddit.com'
    return u.toString()
  } catch {
    return url
  }
}

export function recipeFor(source: FetchSource, url: string): Recipe {
  switch (source) {
    case 'youtube':
      return {
        navigateUrl: youtubeUrl(url),
        extractorJs: youtubeExtractor,
        beforeContentLoaded: false,
        userAgent: DESKTOP_UA,
      }
    case 'instagram':
      return {
        navigateUrl: url,
        extractorJs: instagramExtractor,
        beforeContentLoaded: true,
        userAgent: DESKTOP_UA,
      }
    case 'reddit':
      return {
        navigateUrl: redditUrl(url),
        extractorJs: redditExtractor,
        beforeContentLoaded: false,
        userAgent: DESKTOP_UA,
      }
    default:
      return {
        navigateUrl: url,
        extractorJs: websiteExtractor,
        beforeContentLoaded: false,
      }
  }
}
