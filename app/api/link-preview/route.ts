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

function readMetaTag(html: string, key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }
  }

  return null;
}

function readTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() || null;
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

    const commonHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    };

    if (DIRECT_IMAGE_EXTENSIONS.test(normalizedUrl.pathname)) {
      try {
        const headResponse = await fetch(normalizedUrl, {
          method: "HEAD",
          headers: commonHeaders,
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
      let response: Response | null = null;
      try {
        response = await fetch(normalizedUrl, {
          headers: commonHeaders,
          signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
          redirect: "follow",
        });
        statusCode = response.status;
        finalUrl = response.url || normalizedUrl.toString();
        // 400/401/403 mean the request was actively rejected (bot
        // detection, login wall) — that's a meaningfully different case
        // from "loaded fine but had nothing to show", and the UI has a
        // specific "may require login" message for exactly this bucket.
        // Folding them into "reachable" made e.g. Facebook's 400 show the
        // misleading "no preview image available" message instead.
        reachable =
          statusCode < 500 &&
          statusCode !== 404 &&
          statusCode !== 400 &&
          statusCode !== 401 &&
          statusCode !== 403;
      } catch {
        reachable = false;
      }

      if (response) {
        const contentType = response.headers.get("content-type") || "";
        if (response.ok && contentType.includes("text/html")) {
          const html = await response.text();
          // No "first <img> on the page" fallback here — tested against
          // real profile URLs, it only ever fired when og:image/
          // twitter:image were both absent, and the one time it did
          // (Instagram) it returned a base64 `data:` URI for the page's
          // own loading-placeholder graphic, not a real photo. Better to
          // show "no preview image" than a misleading inline placeholder.
          const image =
            readMetaTag(html, "og:image") || readMetaTag(html, "twitter:image") || null;

          preview.title =
            readMetaTag(html, "og:title") ||
            readMetaTag(html, "twitter:title") ||
            readTitle(html) ||
            preview.domain;
          preview.description =
            readMetaTag(html, "og:description") ||
            readMetaTag(html, "twitter:description") ||
            readMetaTag(html, "description") ||
            null;
          // Defensive: a data: URI is never a real photo/thumbnail —
          // scraped HTML is untrusted input and shouldn't be trusted to
          // only ever hand back a normal image URL.
          preview.image =
            image && !image.startsWith("data:")
              ? new URL(image, response.url || normalizedUrl).toString()
              : null;
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
