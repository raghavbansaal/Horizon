"use client";

import { useState, useTransition } from "react";
import { sendSupportMessage } from "./actions";

export function SupportManager() {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await sendSupportMessage(message);
      if (!result.success) {
        setError(result.error || "Failed to send message.");
        setSuccess(null);
        return;
      }
      setMessage("");
      setError(null);
      setSuccess("Message sent to IT support successfully.");
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border bg-indigo-50/40 dark:bg-indigo-950/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Contact IT Support</h3>
        <p className="text-sm text-gray-600 dark:text-zinc-300 mt-1">
          Send your issue. Support will receive your message with your account email and can reply directly.
        </p>
      </div>
      <div className="p-6 space-y-4">
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
        )}
        {success && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">
            {success}
          </div>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue in detail..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-32"
        />
        <button
          onClick={submit}
          disabled={isPending || !message.trim()}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm disabled:opacity-60"
        >
          {isPending ? "Sending..." : "Send to IT Support"}
        </button>
      </div>
    </div>
  );
}
