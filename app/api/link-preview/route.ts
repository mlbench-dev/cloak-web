import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const DIRECT_IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const REACHABILITY_TIMEOUT_MS = 6000;

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

function readFirstImage(html: string) {
  const patterns = [
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
    /<source[^>]+srcset=["']([^"'\s,]+)[^"']*["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
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
        reachable = statusCode < 500 && statusCode !== 404;
      } catch {
        reachable = false;
      }

      if (response) {
        const contentType = response.headers.get("content-type") || "";
        if (response.ok && contentType.includes("text/html")) {
          const html = await response.text();
          const image =
            readMetaTag(html, "og:image") ||
            readMetaTag(html, "twitter:image") ||
            readFirstImage(html) ||
            null;

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
          preview.image = image
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

    return NextResponse.json({ success: true, preview, reachable, statusCode, finalUrl });
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
