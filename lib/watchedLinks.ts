import { randomBytes } from "node:crypto";
import type { Db, ObjectId } from "mongodb";
import { LINK_CHANGE_WINDOW_DAYS } from "@/lib/config";
import {
  FETCH_URL_COLLECTION,
  LINK_STATUS,
  getApprovedLinks,
  getLinkAllowance,
  type FetchUrlDoc,
  type FetchedLink,
  type LinkAllowance,
} from "@/lib/fetchLinks";
import {
  parseWatchedLink,
  watchedLinkKey,
  type ParsedWatchedLink,
} from "@/lib/watchedLinkUrl";

// The user's watched links, edited through Known Websites (add/remove) and
// Cloak Watch (remove). They live in fetchUrl.links next to the CV fetch's
// own links, because the CV scrape API only accepts links found there.

type Result = { ok: true; added: number; removed: number } | { ok: false; error: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

// Why `count` links can't be removed right now, or null if they can.
export function removalBlockedReason(allowance: LinkAllowance, count: number): string | null {
  if (count === 0) return null;
  if (allowance.changesPerWindow === 0) {
    return "Saved links can't be removed on the Freemium plan. Upgrade to Cloak Pro to change your links.";
  }
  if (count > allowance.changesLeft) {
    if (allowance.changesLeft === 0) {
      return allowance.nextChangeAt
        ? `You've used your ${allowance.changesPerWindow} link changes. You can change links again on ${formatDate(allowance.nextChangeAt)}.`
        : `You've used your ${allowance.changesPerWindow} link changes for now.`;
    }
    return `You can only change ${allowance.changesLeft} more link${
      allowance.changesLeft === 1 ? "" : "s"
    } in this ${LINK_CHANGE_WINDOW_DAYS}-day period.`;
  }
  return null;
}

function newLinkUuid(taken: Set<string>): string {
  let uuid: string;
  do {
    uuid = `link_${randomBytes(3).toString("hex")}`;
  } while (taken.has(uuid));
  return uuid;
}

async function applyChanges(
  db: Db,
  userId: ObjectId,
  removed: FetchedLink[],
  added: { url: string; platform: string; key: string }[],
): Promise<void> {
  const collection = db.collection<FetchUrlDoc>(FETCH_URL_COLLECTION);
  const now = new Date();

  if (removed.length > 0) {
    await collection.updateOne(
      { userId },
      { $set: { "links.$[gone].status": LINK_STATUS.REJECTED, updatedAt: now } },
      { arrayFilters: [{ "gone.uuid": { $in: removed.map((link) => link.uuid) } }] },
    );
    // Each removal uses one of the plan's changes for the window.
    await db
      .collection<{ linkChanges?: Date[] }>("users")
      .updateOne({ _id: userId }, { $push: { linkChanges: { $each: removed.map(() => now) } } });
  }

  if (added.length === 0) return;

  const doc = await collection.findOne({ userId }, { projection: { links: 1 } });
  const existing = doc?.links ?? [];
  const byKey = new Map(existing.map((link) => [watchedLinkKey(link.url), link]));
  const taken = new Set(existing.map((link) => link.uuid));

  // Already in fetchUrl (found by a fetch, or dismissed earlier) → approve
  // that entry, keeping its uuid and any scrape history.
  const reapprove = added.map((link) => byKey.get(link.key)).filter(Boolean) as FetchedLink[];
  if (reapprove.length > 0) {
    await collection.updateOne(
      { userId },
      { $set: { "links.$[again].status": LINK_STATUS.APPROVED, updatedAt: now } },
      { arrayFilters: [{ "again.uuid": { $in: reapprove.map((link) => link.uuid) } }] },
    );
  }

  const fresh: FetchedLink[] = added
    .filter((link) => !byKey.has(link.key))
    .map((link) => {
      const uuid = newLinkUuid(taken);
      taken.add(uuid);
      return {
        uuid,
        platform: link.platform,
        url: link.url,
        status: LINK_STATUS.APPROVED,
        scrapeStatus: "pending",
        source: "manual",
        addedAt: now,
      };
    });
  if (fresh.length > 0) {
    await collection.updateOne(
      { userId },
      {
        $push: { links: { $each: fresh } },
        $set: { updatedAt: now },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
  }
}

// Known Websites save: makes the user's watched links match `desired`
// (what the form submitted). Validates everything first, so a rejected
// save changes nothing.
export async function setWatchedLinks(
  db: Db,
  userId: ObjectId,
  desired: string[],
): Promise<Result> {
  const parsed: Extract<ParsedWatchedLink, { ok: true }>[] = [];
  for (const raw of desired) {
    const result = parseWatchedLink(raw);
    if (!result.ok) return { ok: false, error: result.error };
    parsed.push(result);
  }

  const [current, allowance] = await Promise.all([
    getApprovedLinks(db, userId),
    getLinkAllowance(db, userId),
  ]);
  const currentKeys = new Set(current.map((link) => watchedLinkKey(link.url)));
  const desiredKeys = new Set(parsed.map((link) => link.key));

  const added = parsed.filter(
    (link, index) =>
      !currentKeys.has(link.key) && parsed.findIndex((other) => other.key === link.key) === index,
  );
  const removed = current.filter((link) => !desiredKeys.has(watchedLinkKey(link.url)));

  const blocked = removalBlockedReason(allowance, removed.length);
  if (blocked) return { ok: false, error: blocked };

  if (current.length - removed.length + added.length > allowance.limit) {
    return {
      ok: false,
      error: `You can have up to ${allowance.limit} links on your plan.`,
    };
  }

  await applyChanges(db, userId, removed, added);
  return { ok: true, added: added.length, removed: removed.length };
}

// Cloak Watch delete: removes watched links by URL, under the same rules.
export async function removeWatchedLinks(
  db: Db,
  userId: ObjectId,
  urls: string[],
): Promise<Result> {
  const keys = new Set(urls.map(watchedLinkKey));
  const [current, allowance] = await Promise.all([
    getApprovedLinks(db, userId),
    getLinkAllowance(db, userId),
  ]);
  const removed = current.filter((link) => keys.has(watchedLinkKey(link.url)));
  if (removed.length === 0) return { ok: false, error: "No matching links to remove." };

  const blocked = removalBlockedReason(allowance, removed.length);
  if (blocked) return { ok: false, error: blocked };

  await applyChanges(db, userId, removed, []);
  return { ok: true, added: 0, removed: removed.length };
}
