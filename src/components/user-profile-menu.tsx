"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, CalendarDays, Mail, UserCircle2 } from "lucide-react";

type ProfileData = {
  email: string;
  companyName: string;
  createdAt: string | null;
};

export function UserProfileMenu() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    const res = await fetch("/api/me", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) load();
        }}
        aria-label="Open profile info"
      >
        <UserCircle2 className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-3 w-80 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-0 z-50 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 border-b border-gray-200 dark:border-zinc-700">
            <p className="font-semibold text-indigo-700 dark:text-indigo-300">Account Details</p>
            <p className="text-xs text-indigo-600/80 dark:text-indigo-300/80">Your profile information</p>
          </div>
          {loading ? (
            <p className="text-muted-foreground px-4 py-4 text-sm">Loading profile...</p>
          ) : (
            <div className="px-4 py-3 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-0.5 text-gray-500 dark:text-zinc-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Email</p>
                  <p className="font-medium break-all text-gray-900 dark:text-zinc-100">{data?.email || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 mt-0.5 text-gray-500 dark:text-zinc-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Company</p>
                  <p className="font-medium text-gray-900 dark:text-zinc-100">{data?.companyName || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="w-4 h-4 mt-0.5 text-gray-500 dark:text-zinc-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Account Created</p>
                  <p className="font-medium text-gray-900 dark:text-zinc-100">
                    {data?.createdAt ? new Date(data.createdAt).toLocaleString() : "Not available"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
