"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";

export default function UsersPage() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logoutAll = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await apiClient.logoutAllUsers();
      setMessage(result.message);
      setOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not sign everyone out");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Users</h1>
        <p className="text-muted-foreground">
          Manage system administrators and their permissions
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Sign out every session</h2>
          <p className="text-sm text-muted-foreground">
            Signs every user out of Inventory, POS, and Super Admin. You stay
            signed in on this browser.
          </p>
        </div>
        {message && <p className="text-sm text-foreground">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {open ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md bg-destructive px-4 text-sm font-medium text-white disabled:opacity-50"
              onClick={logoutAll}
              disabled={pending}
            >
              {pending ? "Signing out..." : "Confirm log out all users"}
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
            onClick={() => {
              setMessage(null);
              setError(null);
              setOpen(true);
            }}
          >
            Log out all users
          </button>
        )}
      </div>
    </div>
  );
}
