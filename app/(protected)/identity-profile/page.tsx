"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Plus, ShieldCheck, User as UserIcon, X } from "lucide-react";
import toast from "react-hot-toast";
import VerifiedBadge from "@/app/components/VerifiedBadge";

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

function InfoRow({
  label,
  value,
  onClick,
  isLast = false,
}: {
  label: string;
  value: string;
  onClick: () => void;
  isLast?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left ${
        isLast ? "" : "border-b border-[#ECECEC]"
      }`}
    >
      <div className="min-w-0">
        <p className="text-[13px] text-[#8F98A0]">{label}</p>
        <p className="mt-0.5 truncate text-[15px] text-[#2D2D2D]">{value || "Not set"}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#B5BEC4]" />
    </button>
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
  const avatarUrl = user?.image || user?.profileImage;
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
        <header className="flex items-center justify-between px-4 py-4 bg-white z-10">
          <button type="button" onClick={cancelEdit} className="p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-lg font-semibold text-[#2D2D2D]">Edit Identity Profile</h1>
          <div className="w-10" />
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[14px] text-[#2D2D2D]">Full Name</label>
              <input
                type="text"
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                className="w-full h-14 bg-[#F5F5F5] rounded-2xl px-5 outline-none focus:ring-2 ring-[#14C3CF]/20 text-[15px]"
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
                  className="w-full h-14 bg-[#F5F5F5] rounded-2xl px-5 outline-none focus:ring-2 ring-[#14C3CF]/20 text-[15px]"
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
              className="h-14 flex-1 rounded-full bg-[#EEEEEE] text-[15px] font-medium text-[#9AA3AA] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={isSaving}
              className="h-14 flex-1 rounded-full bg-[#14C3CF] text-[15px] font-medium text-white disabled:opacity-60"
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
      <header className="flex items-center justify-between  bg-white z-10">
        <button type="button" onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">Identity Profile</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto mt-5 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
          </div>
        ) : (
          <>
        <div className="flex items-center gap-3">
          <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full bg-gray-200">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={username} fill className="object-cover" />
            ) : (
              <UserIcon className="h-full w-full p-3 text-gray-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-[17px] font-medium text-[#2D2D2D]">{username}</h2>
              <VerifiedBadge className="h-5 w-5 text-[#14C3CF]" />
            </div>
            {isVerified && (
              <div className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-[#19C48A]">
                <ShieldCheck className="h-4 w-4" />
                Verified
              </div>
            )}
            <p className="mt-0.5 text-[13px] text-[#8F98A0]">
              {level !== null && level > 0 ? `Level ${level} Scout` : "Unranked"}
            </p>
          </div>
        </div>

        <p className="mt-7 mb-3 text-[15px] font-medium text-[#2D2D2D]">Identity Information</p>

        <div className="rounded-[20px] bg-[#F8F8F8]">
          <InfoRow label="Full Name" value={identity.fullName} onClick={startEdit} />
          <InfoRow
            label="Usernames / Handles"
            value={identity.usernames.join(", ")}
            onClick={startEdit}
          />
          <InfoRow
            label="Aliases / Other Names"
            value={identity.aliases.join(", ")}
            onClick={startEdit}
          />
          <InfoRow
            label="Known Websites (optional)"
            value={identity.websites.join(", ")}
            onClick={startEdit}
          />
          <InfoRow
            label="Keywords (optional)"
            value={identity.keywords.join(", ")}
            onClick={startEdit}
            isLast
          />
        </div>

        <div className="mt-10 space-y-3">
          <button
            type="button"
            onClick={startEdit}
            className="h-14 w-full rounded-full bg-[#14C3CF] text-[15px] font-medium text-white"
          >
            Edit Profile
          </button>
          <button
            type="button"
            onClick={() => router.push("/reference-media?mode=profile")}
            className="h-14 w-full rounded-full border-2 border-[#14C3CF] bg-white text-[15px] font-medium text-[#14C3CF]"
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
