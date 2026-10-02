"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import {
  ChevronLeft,
  Edit3,
  Plus,
  ShieldCheck,
  User as UserIcon,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import { DetectiveIcon } from "@/public/svgIcons";

type IdentityProfileData = {
  fullName: string;
  usernames: string[];
  aliases: string[];
  websites: string[];
  keywords: string[];
};

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

function TagBox({
  values,
  onRemove,
  onAdd,
  placeholder,
}: {
  values: string[];
  onRemove: (index: number) => void;
  onAdd: (value: string) => void;
  placeholder: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onAdd(trimmed);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#F5F5F5] p-3">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3 py-1.5 text-[14px] text-[#2D2D2D]"
        >
          {value}
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${value}`}
            className="text-[#8F98A0]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder={placeholder}
          className="min-w-[100px] flex-1 bg-transparent text-[14px] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="ml-auto inline-flex items-center gap-1 text-[14px] font-medium text-[#2D2D2D]"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
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
    <div className="px-3.5">
      <div className={`pb-3 pt-3 ${isFirst ? "" : "border-t border-[#E6F0F1]"}`}>
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
    setDraft({
      ...identity,
      // Always show at least one website field to type into, even for a
      // brand-new/empty profile — the backend already drops blank entries
      // on save, so an unfilled placeholder here is harmless.
      websites: identity.websites.length > 0 ? identity.websites : [""],
    });
    setMode("edit");
  };

  const cancelEdit = () => {
    setMode("view");
  };

  const saveEdit = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/identity-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Couldn't save your identity profile. Please try again.");
        return;
      }

      setIdentity(toIdentityProfileData(data.profile));
      setMode("view");
      toast.success("Identity profile updated");
    } catch {
      toast.error("Couldn't save your identity profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === "edit") {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <header className="flex items-center justify-between py-4 bg-white z-10">
          <button type="button" onClick={cancelEdit} className="-ml-3 p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-[16px] font-medium text-[#2B2B2B]">Edit Identity Profile</h1>
          <div className="-mr-3 w-10" />
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[14px] text-[#2D2D2D]">Full Name</label>
              <input
                type="text"
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                className="w-full h-14 bg-[#F5F5F5] rounded-2xl px-5 outline-none focus:ring-2 ring-[#14C3CF]/20 text-base"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[14px] text-[#2D2D2D]">Usernames / Handles</label>
              <TagBox
                values={draft.usernames}
                placeholder="@handle"
                onAdd={(value) =>
                  setDraft({ ...draft, usernames: [...draft.usernames, value] })
                }
                onRemove={(index) =>
                  setDraft({
                    ...draft,
                    usernames: draft.usernames.filter((_, i) => i !== index),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[14px] text-[#2D2D2D]">Aliases / Other Names</label>
              <TagBox
                values={draft.aliases}
                placeholder="Alias"
                onAdd={(value) => setDraft({ ...draft, aliases: [...draft.aliases, value] })}
                onRemove={(index) =>
                  setDraft({
                    ...draft,
                    aliases: draft.aliases.filter((_, i) => i !== index),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[14px] text-[#2D2D2D]">
                Known Websites <span className="text-[#8F98A0]">(Optional)</span>
              </label>
              {draft.websites.map((site, index) => (
                <input
                  key={index}
                  type="text"
                  value={site}
                  onChange={(e) => {
                    const next = [...draft.websites];
                    next[index] = e.target.value;
                    setDraft({ ...draft, websites: next });
                  }}
                  className="w-full h-14 bg-[#F5F5F5] rounded-2xl px-5 outline-none focus:ring-2 ring-[#14C3CF]/20 text-base"
                />
              ))}
              <button
                type="button"
                onClick={() => setDraft({ ...draft, websites: [...draft.websites, ""] })}
                className="inline-flex items-center gap-1 text-[14px] font-medium text-[#2D2D2D]"
              >
                <Plus className="h-4 w-4" />
                Add another <span className="text-[#8F98A0]">(Optional)</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[14px] text-[#2D2D2D]">
                Keywords <span className="text-[#8F98A0]">(Optional)</span>
              </label>
              <TagBox
                values={draft.keywords}
                placeholder="Keyword"
                onAdd={(value) => setDraft({ ...draft, keywords: [...draft.keywords, value] })}
                onRemove={(index) =>
                  setDraft({
                    ...draft,
                    keywords: draft.keywords.filter((_, i) => i !== index),
                  })
                }
              />
            </div>
          </div>

          <div className="mt-10 flex items-center gap-3">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              className="h-11 flex-1 rounded-full bg-[#EEEEEE] text-[16px] font-medium text-[#9AA3AA] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={isSaving}
              className="h-11 flex-1 rounded-full bg-[#14C3CF] text-[16px] font-medium text-white disabled:opacity-60"
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
        <div className="flex items-start gap-3 rounded-3xl border border-[#C8EEF1] bg-[#E7F9FB] p-3">
          <div className="relative h-[42px] w-[42px] shrink-0 overflow-hidden rounded-full bg-gray-200">
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
              <VerifiedBadge className="h-[15px] w-[15px] shrink-0 text-[#00C3D0]" />
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
            className="inline-flex h-7 shrink-0 items-center gap-2 self-center rounded-full bg-[#00C3D0] pl-2 pr-2.5 text-[12px] font-medium text-white"
          >
            <Edit3 className="h-4 w-4" />
            Edit Profile
          </button>
        </div>

        <p className="mt-6 mb-3 text-[14px] font-medium leading-5 text-[#2B2B2B]">
          Identity Information
        </p>

        <div className="rounded-3xl border border-[#E6F0F1] bg-[#FCFEFD]">
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
            <PillGroup values={identity.websites} toneClassName="bg-[#ECF2FE]" />
          </FieldSection>
          <FieldSection label="Keywords">
            <PillGroup values={identity.keywords} toneClassName="bg-[#FFECF8]" />
          </FieldSection>
        </div>

        <div className="mt-10">
          <button
            type="button"
            onClick={() => router.push("/reference-media?mode=profile")}
            className="h-11 w-full rounded-full border-2 border-[#14C3CF] bg-white text-[16px] font-medium text-[#14C3CF]"
          >
            Reference Media
          </button>
        </div>
          </>
        )}
      </main>
    </div>
  );
}
