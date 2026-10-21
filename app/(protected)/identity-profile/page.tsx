"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import {
  Camera,
  ChevronLeft,
  Edit3,
  ShieldCheck,
  User as UserIcon,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import { DetectiveIcon } from "@/public/svgIcons";
import { MenuButton, MenuGroup } from "@/app/components/MenuList";
import LinkDiscoveryFlow from "./_components/LinkDiscoveryFlow";
import ScrapeLoader from "./_components/ScrapeLoader";
import AddLinkSheet from "@/app/components/linkDiscovery/AddLinkSheet";
import type { LinkAllowance } from "@/app/components/linkDiscovery/LinkDiscovery";
import { getSourceLinkLabel } from "@/app/components/reports/reportUi";
import { parseWatchedLink, watchedLinkKey } from "@/lib/watchedLinkUrl";
import { LINK_CHANGE_WINDOW_DAYS } from "@/lib/config";

type IdentityProfileData = {
  fullName: string;
  usernames: string[];
  aliases: string[];
  websites: string[];
  keywords: string[];
};

const TAG_FIELDS = ["usernames", "aliases", "websites", "keywords"] as const;
type TagField = (typeof TAG_FIELDS)[number];

const EMPTY_IDENTITY: IdentityProfileData = {
  fullName: "",
  usernames: [],
  aliases: [],
  websites: [],
  keywords: [],
};

function toIdentityProfileData(profile: Partial<IdentityProfileData> | null): IdentityProfileData {
  return {
    fullName: profile?.fullName || "",
    usernames: Array.isArray(profile?.usernames) ? profile.usernames : [],
    aliases: Array.isArray(profile?.aliases) ? profile.aliases : [],
    websites: Array.isArray(profile?.websites) ? profile.websites : [],
    keywords: Array.isArray(profile?.keywords) ? profile.keywords : [],
  };
}

// The typed-but-not-yet-added text is owned by the parent so Save can
// include it — otherwise typing a handle and hitting Save without "Add"
// would silently drop it.
function TagInput({
  values,
  draft,
  onDraftChange,
  onRemove,
  onAdd,
  placeholder,
  validate,
  canRemove,
  display,
}: {
  values: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onRemove: (index: number) => void;
  onAdd: (value: string) => void;
  placeholder: string;
  // Returns an error to show instead of adding, or the value to add
  // (e.g. a cleaned-up link).
  validate?: (value: string) => { error: string } | { value: string };
  // Chips without an × (e.g. saved links the plan doesn't allow removing).
  canRemove?: (value: string) => boolean;
  display?: (value: string) => string;
}) {
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const checked = validate ? validate(trimmed) : { value: trimmed };
    if ("error" in checked) {
      setError(checked.error);
      return;
    }
    setError(null);
    if (!values.includes(checked.value)) onAdd(checked.value);
    onDraftChange("");
  };

  return (
    <div>
      <div className="flex h-[42px] items-center rounded-xl bg-[#F5F5F5] pl-3.5 pr-3">
        <input
          value={draft}
          onChange={(e) => {
            setError(null);
            onDraftChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[#2B2B2B] outline-none placeholder:text-[#A7ADB2]"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="shrink-0 pl-2 text-[14px] text-[#14C3CF] disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] leading-4 text-[#F30131]">{error}</p>}
      {values.length > 0 && (
        <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 no-scrollbar">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#E6F7F8] pl-2.5 pr-2 text-[13px] text-[#2B2B2B]"
            >
              {display ? display(value) : value}
              {(!canRemove || canRemove(value)) && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${value}`}
                  className="text-[#2B2B2B]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Each identity field gets its own pill color in view mode — purely
// visual grouping (matches the reference design) so usernames/aliases/
// websites/keywords are easy to tell apart at a glance.
function PillGroup({ values, toneClassName }: { values: string[]; toneClassName: string }) {
  if (values.length === 0) {
    return <p className="mt-1 text-[14px] leading-5 text-[#B5BEC4]">Not set</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-2.5">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={`inline-flex h-6 items-center rounded-lg px-2 text-[12px] text-[#2B2B2B] ${toneClassName}`}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

// Divider is inset (px-3.5 wraps the border) rather than full card width,
// matching the reference.
function FieldSection({
  label,
  children,
  isFirst = false,
}: {
  label: string;
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div className="px-3">
      <div className={`pb-3 pt-3 ${isFirst ? "" : "border-t border-[#E6F0EF]"}`}>
        <p className="text-[14px] font-medium leading-5 text-[#2B2B2B]">{label}</p>
        {children}
      </div>
    </div>
  );
}

export default function IdentityProfilePage() {
  const router = useRouter();
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [identity, setIdentity] = useState<IdentityProfileData>(EMPTY_IDENTITY);
  const [draft, setDraft] = useState<IdentityProfileData>(EMPTY_IDENTITY);
  const [level, setLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showLinkDiscovery, setShowLinkDiscovery] = useState(false);
  const [tagDrafts, setTagDrafts] = useState<Partial<Record<TagField, string>>>({});
  const [linkAllowance, setLinkAllowance] = useState<LinkAllowance | null>(null);
  const [showScrapeLoader, setShowScrapeLoader] = useState(false);
  // "Add your own links?" after every suggested link was dismissed.
  const [showAddOwnLinks, setShowAddOwnLinks] = useState(false);

  // Re-reads the profile (Known Websites) after a link is added from here.
  const reloadIdentity = () =>
    fetch("/api/identity-profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success) return;
        setIdentity(toIdentityProfileData(data.profile));
        if (data.linkAllowance) setLinkAllowance(data.linkAllowance);
      })
      .catch(() => null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.stats) setLevel(Number(data.stats.level || 0));
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/identity-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.success) {
          setIdentity(toIdentityProfileData(data.profile));
          if (data.linkAllowance) setLinkAllowance(data.linkAllowance);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const username = user?.username || "user";
  // Placeholder only once the user has loaded and is known to have no image.
  const avatarUrl = user
    ? user.image || user.profileImage || "/images/placeholder_avatar.png"
    : undefined;
  const isVerified =
    user?.identityVerificationStatus === "APPROVED" || user?.isVerified || false;

  const startEdit = () => {
    setDraft(identity);
    setTagDrafts({});
    setMode("edit");
  };

  const isNewProfile =
    !identity.fullName &&
    identity.usernames.length === 0 &&
    identity.aliases.length === 0;

  const cancelEdit = () => {
    setMode("view");
  };

  const saveEdit = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const toSave = { ...draft };
      for (const field of TAG_FIELDS) {
        const pending = tagDrafts[field]?.trim();
        if (pending && !toSave[field].includes(pending)) {
          toSave[field] = [...toSave[field], pending];
        }
      }

      const res = await fetch("/api/identity-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Couldn't save your identity profile. Please try again.");
        return;
      }

      setIdentity(toIdentityProfileData(data.profile));
      if (data.linkAllowance) setLinkAllowance(data.linkAllowance);
      setMode("view");
      if (data.shouldFetchLinks) {
        // Server decides when discovery runs (first completion only, for
        // now) — see shouldAutoFetchLinks in lib/fetchLinks.ts. Typed-in
        // links get scraped together with the links kept there.
        setShowLinkDiscovery(true);
      } else if (data.scrapeStarted) {
        // New typed-in links started scraping straight away.
        setShowScrapeLoader(true);
      } else {
        toast.success("Identity profile updated");
      }
    } catch {
      toast.error("Couldn't save your identity profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === "edit") {
    const tagField = (
      label: React.ReactNode,
      key: TagField,
      placeholder: string,
    ) => (
      <div>
        <label className="mb-2 block text-[14px] leading-5 text-[#2B2B2B]">{label}</label>
        <TagInput
          values={draft[key]}
          draft={tagDrafts[key] || ""}
          onDraftChange={(value) => setTagDrafts((prev) => ({ ...prev, [key]: value }))}
          placeholder={placeholder}
          onAdd={(value) => setDraft((prev) => ({ ...prev, [key]: [...prev[key], value] }))}
          onRemove={(index) =>
            setDraft((prev) => ({
              ...prev,
              [key]: prev[key].filter((_, i) => i !== index),
            }))
          }
        />
      </div>
    );

    // Known Websites = watched links (lib/watchedLinks.ts): Instagram,
    // Facebook or X only, capped by plan, and saved ones can only be removed
    // as the plan allows. The server enforces all of it; this just explains
    // it up front.
    const limit = linkAllowance?.limit ?? 0;
    const changesLeft = linkAllowance?.changesLeft ?? 0;
    const savedLinks = identity.websites;
    const removedSaved = savedLinks.filter((url) => !draft.websites.includes(url)).length;
    const knownWebsitesField = (
      <div>
        <label className="mb-2 flex items-baseline justify-between text-[14px] leading-5 text-[#2B2B2B]">
          <span>
            Known Websites <span className="text-[11px] text-[#839297]">(Optional)</span>
          </span>
          {linkAllowance && (
            <span className="text-[11px] text-[#839297]">
              {draft.websites.length} / {limit} links
            </span>
          )}
        </label>
        <TagInput
          values={draft.websites}
          draft={tagDrafts.websites || ""}
          onDraftChange={(value) => setTagDrafts((prev) => ({ ...prev, websites: value }))}
          placeholder="Add Instagram, Facebook or X links"
          display={getSourceLinkLabel}
          validate={(value) => {
            const parsed = parseWatchedLink(value);
            if (!parsed.ok) return { error: parsed.error };
            if (draft.websites.some((url) => watchedLinkKey(url) === parsed.key)) {
              return { error: "That link is already added." };
            }
            if (linkAllowance && draft.websites.length >= limit) {
              return {
                error:
                  linkAllowance.changesPerWindow > 0
                    ? `You can have up to ${limit} links.`
                    : `You can have up to ${limit} links. Upgrade to Cloak Pro for up to 20.`,
              };
            }
            return { value: parsed.url };
          }}
          // Links added in this edit can always be taken back; saved ones
          // only while the plan has changes left.
          canRemove={(url) => !savedLinks.includes(url) || removedSaved < changesLeft}
          onAdd={(value) => setDraft((prev) => ({ ...prev, websites: [...prev.websites, value] }))}
          onRemove={(index) =>
            setDraft((prev) => ({
              ...prev,
              websites: prev.websites.filter((_, i) => i !== index),
            }))
          }
        />
        <p className="mt-1.5 text-[11px] leading-4 text-[#839297]">
          Only public profiles can be monitored. Private accounts can&apos;t be added.
        </p>
        {linkAllowance && savedLinks.length > 0 && (
          <p className="mt-1.5 text-[11px] leading-4 text-[#839297]">
            {linkAllowance.changesPerWindow === 0
              ? "Saved links can't be removed on the Freemium plan."
              : changesLeft > 0
                ? `You can remove ${changesLeft - removedSaved} more saved link${
                    changesLeft - removedSaved === 1 ? "" : "s"
                  } in this ${LINK_CHANGE_WINDOW_DAYS}-day period.`
                : linkAllowance.nextChangeAt
                  ? `You can change links again on ${new Date(linkAllowance.nextChangeAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`
                  : "You've used your link changes for now."}
          </p>
        )}
      </div>
    );

    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <header className="flex items-center justify-between py-4 bg-white z-10">
          <button type="button" onClick={cancelEdit} className="-ml-3 p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-[16px] font-medium text-[#2B2B2B]">
            {isNewProfile ? "Create Identity Profile" : "Edit Identity Profile"}
          </h1>
          <div className="-mr-3 w-10" />
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-[14px] leading-5 text-[#2B2B2B]">Full Name</label>
              <input
                type="text"
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                placeholder="Your full name"
                className="h-[42px] w-full rounded-xl bg-[#F5F5F5] px-3.5 text-[14px] text-[#2B2B2B] outline-none placeholder:text-[#A7ADB2] focus:ring-2 ring-[#14C3CF]/20"
              />
            </div>

            {tagField("Usernames / Handles", "usernames", "Add your usernames")}
            {tagField(
              <>
                Aliases / Other Names <span className="text-[11px] text-[#839297]">(Optional)</span>
              </>,
              "aliases",
              "Add your Aliases",
            )}
            {knownWebsitesField}
            {tagField("Keywords", "keywords", "Add Keywords")}
          </div>

          <div className="mt-10 flex items-center gap-3">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              className="h-12 flex-1 rounded-full bg-[#F5F5F5] text-[16px] text-[#839297] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={isSaving}
              className="h-12 flex-1 rounded-full bg-[#14C3CF] text-[16px] text-white disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between bg-white z-10">
        <button type="button" onClick={() => router.back()} className="-ml-3 p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">Identity Profile</h1>
        <div className="-mr-3 w-10" />
      </header>

      {/* No horizontal padding here — the protected layout's <main> already
          applies px-4, and doubling it was what made every card 32px narrower
          than the reference at 375px. */}
      <main className="flex-1 min-h-0 overflow-y-auto mt-2 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
          </div>
        ) : (
          <>
        <div className="flex items-center gap-3 rounded-[20px] border border-[#C8EEF1] bg-[#E7F9FB] px-3 py-3.5">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-200">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={username} fill className="object-cover" />
            ) : (
              <UserIcon className="h-full w-full p-2 text-gray-400" />
            )}
          </div>
          {/* min-w-0 + flex-1 so this column shrinks (and truncates) instead
              of pushing the button past the card edge — without it the row
              overflowed and the whole page scrolled sideways. */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[16px] font-medium leading-[22px] text-[#2B2B2B]">
                {username}
              </h2>
              {isVerified && (
                <VerifiedBadge className="h-[15px] w-[15px] shrink-0 text-[#00C3D0]" />
              )}
            </div>
            {isVerified && (
              <div className="flex items-center gap-1 text-[12px] leading-[19px] text-[#10B981]">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Verified</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[12px] leading-[19px] text-[#839297]">
              <DetectiveIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {level !== null && level > 0 ? `Level ${level} Scout` : "Scout"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[#00C3D0] pl-2 pr-2.5 text-[12px] font-medium text-white"
          >
            <Edit3 className="h-4 w-4" />
            Edit Identity info
          </button>
        </div>

        <p className="mb-2 mt-5 text-[14px] leading-5 text-[#2B2B2B]">
          Identity Information
        </p>

        <div className="rounded-[20px] border border-[#E6F0F1] bg-white">
          <FieldSection label="Full Name" isFirst>
            <p className="mt-1 text-[14px] leading-5 text-[#839297]">
              {identity.fullName || "Not set"}
            </p>
          </FieldSection>
          <FieldSection label="Usernames / Handles">
            <PillGroup values={identity.usernames} toneClassName="bg-[#FFF1E6]" />
          </FieldSection>
          <FieldSection label="Aliases / Other Names">
            <PillGroup values={identity.aliases} toneClassName="bg-[#E9F9F6]" />
          </FieldSection>
          <FieldSection label="Known Websites">
            <PillGroup
              values={identity.websites.map(getSourceLinkLabel)}
              toneClassName="bg-[#ECF2FE]"
            />
          </FieldSection>
          <FieldSection label="Keywords">
            <PillGroup values={identity.keywords} toneClassName="bg-[#FFECF8]" />
          </FieldSection>
        </div>

        <div className="mt-4">
          <MenuGroup>
            <MenuButton
              icon={<Camera size={18} strokeWidth={1.75} className="text-[#1CB986]" />}
              iconBg="bg-[#E8F9F3]"
              label="Reference Media"
              description="Manage your reference photos"
              onClick={() => router.push("/reference-media?mode=profile")}
            />
          </MenuGroup>
        </div>
          </>
        )}
      </main>

      {showScrapeLoader && (
        <ScrapeLoader
          onClose={() => setShowScrapeLoader(false)}
          onDone={() => {
            setShowScrapeLoader(false);
            router.push("/cloak-watch");
          }}
        />
      )}

      {showLinkDiscovery && (
        <LinkDiscoveryFlow
          subjectName={identity.fullName}
          onClose={() => setShowLinkDiscovery(false)}
          onDone={() => {
            setShowLinkDiscovery(false);
            router.push("/cloak-watch");
          }}
          onDismissedAll={() => {
            setShowLinkDiscovery(false);
            setShowAddOwnLinks(true);
          }}
        />
      )}

      <AddLinkSheet
        open={showAddOwnLinks}
        onClose={() => setShowAddOwnLinks(false)}
        title="Add your own links?"
        intro="No problem — if you have Instagram, Facebook or X profiles, add them and Cloak will watch them for you."
        dismissLabel="Maybe later"
        limitText={
          linkAllowance ? `${linkAllowance.count} / ${linkAllowance.limit} links on your plan` : undefined
        }
        onAdded={({ scrapeStarted }) => {
          setShowAddOwnLinks(false);
          void reloadIdentity();
          if (scrapeStarted) setShowScrapeLoader(true);
        }}
      />
    </div>
  );
}
