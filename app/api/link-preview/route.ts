import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const DIRECT_IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const REACHABILITY_TIMEOUT_MS = 6000;

// Link metadata (title/image/description) rarely changes minute to minute,
// and the same URLs get requested repeatedly (recent searches, report
// details, etc.), so cache results in memory instead of re-fetching the
// external page every time.
const PREVIEW_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const PREVIEW_CACHE_MAX_ENTRIES = 300;
const previewCache = new Map<
  string,
  { expiresAt: number; body: Record<string, unknown> }
>();

function getCachedPreview(key: string) {
  const cached = previewCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    previewCache.delete(key);
    return null;
  }
  return cached.body;
}

function setCachedPreview(key: string, body: Record<string, unknown>) {
  if (previewCache.size >= PREVIEW_CACHE_MAX_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) previewCache.delete(oldestKey);
  }
  previewCache.set(key, { expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS, body });
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readAttribute(tag: string, name: string) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

// Collects every <meta property|name="…" content="…"> on the page, tag by
// tag, so attribute order, quoting style and extra attributes (data-rh,
// itemprop, …) don't matter. First occurrence of a key wins.
function readMetaTags(html: string) {
  const tags = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = (
      readAttribute(tag, "property") || readAttribute(tag, "name")
    )?.toLowerCase();
    const content = readAttribute(tag, "content");
    if (key && content && !tags.has(key)) {
      tags.set(key, decodeHtmlEntities(content).trim());
    }
  }
  return tags;
}

const IMAGE_META_KEYS = [
  "og:image:secure_url",
  "og:image",
  "og:image:url",
  "twitter:image",
  "twitter:image:src",
];

function readPreviewImage(tags: Map<string, string>, baseUrl: string) {
  for (const key of IMAGE_META_KEYS) {
    const image = resolveImageUrl(tags.get(key) ?? null, baseUrl);
    if (image) return image;
  }
  return null;
}

const NO_FALLBACK_IMAGE_HOSTS =
  /(^|\.)(instagram\.com|facebook\.com|fb\.com|tiktok\.com|x\.com|twitter\.com|youtube\.com|youtu\.be)$/i;

function resolveImageUrl(value: string | null, baseUrl: string) {
  // Defensive: a data: URI is never a real photo/thumbnail — scraped HTML
  // is untrusted input and shouldn't be trusted to only ever hand back a
  // normal image URL.
  if (!value || value.startsWith("data:")) return null;
  try {
    const resolved = new URL(decodeHtmlEntities(value).trim(), baseUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:"
      ? resolved.toString()
      : null;
  } catch {
    return null;
  }
}

// For pages with no og:image/twitter:image at all (login screens, internal
// dashboards, small sites): the first real <img> on the page, then the
// site's own icon. Only ever used when no attempt found a proper share
// image, and data: URIs are skipped, so a platform's inline loading
// placeholder can't end up as the "preview".
function readFallbackImage(html: string, baseUrl: string) {
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const image = resolveImageUrl(readAttribute(tag, "src"), baseUrl);
    if (image) return image;
  }

  const iconLinks = (html.match(/<link\b[^>]*>/gi) || []).filter((tag) =>
    /icon/i.test(readAttribute(tag, "rel") || ""),
  );
  // apple-touch-icon is the largest one sites usually ship
  iconLinks.sort(
    (a, b) =>
      Number(/apple-touch-icon/i.test(b)) - Number(/apple-touch-icon/i.test(a)),
  );
  for (const tag of iconLinks) {
    const image = resolveImageUrl(readAttribute(tag, "href"), baseUrl);
    if (image) return image;
  }
  return null;
}

// Instagram, TikTok, Facebook and X answer a normal browser User-Agent with
// a JS shell or a login wall (no Open Graph tags at all), but return full
// preview metadata to known link-preview crawlers — so ask as one first and
// only fall back to a browser User-Agent when that yields no image.
const CRAWLER_USER_AGENT = "Twitterbot/1.0";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function getRequestHeaders(userAgent: string) {
  return {
    "User-Agent": userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
}

// 400/401/403 mean the request was actively rejected (bot detection, login
// wall) — that's a meaningfully different case from "loaded fine but had
// nothing to show", and the UI has a specific "may require login" message
// for exactly this bucket.
function isReachableStatus(statusCode: number) {
  return (
    statusCode < 500 &&
    statusCode !== 404 &&
    statusCode !== 400 &&
    statusCode !== 401 &&
    statusCode !== 403
  );
}

type FetchedPage = {
  statusCode: number;
  finalUrl: string;
  tags: Map<string, string> | null;
  title: string | null;
  image: string | null;
  fallbackImage: string | null;
};

async function fetchPage(url: URL, userAgent: string): Promise<FetchedPage | null> {
  try {
    const response = await fetch(url, {
      headers: getRequestHeaders(userAgent),
      signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
      redirect: "follow",
    });
    const finalUrl = response.url || url.toString();
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("text/html")) {
      return {
        statusCode: response.status,
        finalUrl,
        tags: null,
        title: null,
        image: null,
        fallbackImage: null,
      };
    }

    const html = await response.text();
    const tags = readMetaTags(html);
    return {
      statusCode: response.status,
      finalUrl,
      tags,
      title: readTitle(html),
      image: readPreviewImage(tags, finalUrl),
      fallbackImage: readFallbackImage(html, finalUrl),
    };
  } catch {
    return null;
  }
}

function readTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1]).trim() || null : null;
}

async function fetchNoEmbedPreview(url: string) {
  try {
    const response = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
      {
        signal: AbortSignal.timeout(6000),
        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.error) {
      return null;
    }

    return {
      title: typeof data.title === "string" ? data.title : null,
      description:
        typeof data.author_name === "string" ? data.author_name : null,
      image:
        typeof data.thumbnail_url === "string" ? data.thumbnail_url : null,
      domain:
        typeof data.provider_name === "string" ? data.provider_name : null,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({
        success: true,
        preview: null,
        reachable: false,
        statusCode: null,
        finalUrl: null,
      });
    }

    const normalizedUrl = new URL(url);
    const cacheKey = normalizedUrl.toString();
    const cached = getCachedPreview(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const preview = {
      url: normalizedUrl.toString(),
      domain: normalizedUrl.hostname.replace(/^www\./, ""),
      title: normalizedUrl.hostname.replace(/^www\./, ""),
      description: null as string | null,
      image: DIRECT_IMAGE_EXTENSIONS.test(normalizedUrl.pathname)
        ? normalizedUrl.toString()
        : null,
    };

    let reachable = false;
    let statusCode: number | null = null;
    let finalUrl: string | null = null;

    if (DIRECT_IMAGE_EXTENSIONS.test(normalizedUrl.pathname)) {
      try {
        const headResponse = await fetch(normalizedUrl, {
          method: "HEAD",
          headers: getRequestHeaders(BROWSER_USER_AGENT),
          signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
          redirect: "follow",
        });
        statusCode = headResponse.status;
        finalUrl = headResponse.url || normalizedUrl.toString();
        reachable = statusCode < 500 && statusCode !== 404;
      } catch {
        reachable = false;
      }
    } else {
      const crawlerPage = await fetchPage(normalizedUrl, CRAWLER_USER_AGENT);
      const browserPage = crawlerPage?.image
        ? null
        : await fetchPage(normalizedUrl, BROWSER_USER_AGENT);

      // Prefer whichever attempt found an image, then whichever loaded.
      const pages = [crawlerPage, browserPage].filter(
        (page): page is FetchedPage => page !== null,
      );
      const page =
        pages.find((candidate) => candidate.image) ||
        pages.find((candidate) => candidate.tags) ||
        pages.find((candidate) => isReachableStatus(candidate.statusCode)) ||
        pages[0] ||
        null;

      if (page) {
        statusCode = page.statusCode;
        finalUrl = page.finalUrl;
        // Reachable if either attempt got through — some sites reject the
        // crawler User-Agent but serve the browser one (and vice versa).
        reachable = pages.some((candidate) =>
          isReachableStatus(candidate.statusCode),
        );

        if (page.tags) {
          preview.title =
            page.tags.get("og:title") ||
            page.tags.get("twitter:title") ||
            page.title ||
            preview.domain;
          preview.description =
            page.tags.get("og:description") ||
            page.tags.get("twitter:description") ||
            page.tags.get("description") ||
            null;
          // On the big social platforms a page without a share image is a
          // private/empty profile or a login wall, and its first <img>/icon
          // is just the platform's own logo — showing that as the "preview"
          // would be misleading, so the fallback is for other sites only.
          preview.image =
            page.image ||
            (NO_FALLBACK_IMAGE_HOSTS.test(preview.domain)
              ? null
              : pages.find((candidate) => candidate.fallbackImage)
                  ?.fallbackImage) ||
            null;
        }
      }
    }

    if (!preview.image || !preview.description) {
      const oembed = await fetchNoEmbedPreview(normalizedUrl.toString());
      if (oembed) {
        preview.title = oembed.title || preview.title;
        preview.description = oembed.description || preview.description;
        preview.image = oembed.image || preview.image;
        preview.domain = oembed.domain || preview.domain;
      }
    }

    const responseBody = { success: true, preview, reachable, statusCode, finalUrl };
    // Only cache reachable/successful lookups — a transient failure
    // shouldn't get stuck in the cache for 15 minutes.
    if (reachable) {
      setCachedPreview(cacheKey, responseBody);
    }
    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("Error fetching link preview:", error);
    return NextResponse.json({
      success: true,
      preview: null,
      reachable: false,
      statusCode: null,
      finalUrl: null,
    });
  }
}
