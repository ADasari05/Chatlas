"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

interface DeletionRequest {
  uuid: string;
  user_data_id?: string;
  username: string;
  email: string;
}

interface AdminDashboardProps {
  onSignOut?: () => void;
  onViewMap?: () => void;
}

export default function AdminDashboard({ onSignOut, onViewMap }: AdminDashboardProps): React.JSX.Element {
  const [supabase] = useState(() => createClient());
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>("");

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in as an administrator.");
      }
      setAdminEmail(session.user?.email || "Admin");

      const res = await fetch("/api/admin/deletion-requests", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Failed to load deletion requests.`);
      }

      setRequests(data.requests || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleDelete = async (targetUuid: string, targetUsername: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete user "${targetUsername}" (${targetUuid})?\n\nThis will purge their credentials and waypoints, but keep their chat messages.`
    );
    if (!confirmed) return;

    setDeletingId(targetUuid);
    setActionMessage(null);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Admin session expired. Please sign in again.");
      }

      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: targetUuid }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Deletion failed with status ${res.status}`);
      }

      setActionMessage(`Successfully deleted account for "${targetUsername}". Waypoints removed, messages preserved.`);
      // Remove deleted item from local state
      setRequests((prev) => prev.filter((r) => r.uuid !== targetUuid));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdminSignOut = async () => {
    await supabase.auth.signOut();
    if (onSignOut) {
      onSignOut();
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-logo">Chatlas</span>
          <span className="admin-badge">Admin Console</span>
        </div>
        <div className="admin-user-controls">
          <span className="admin-email">{adminEmail}</span>
          {onViewMap && (
            <button className="admin-btn-secondary" onClick={onViewMap}>
              View Map
            </button>
          )}
          <button className="admin-btn-signout" onClick={handleAdminSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="admin-container">
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h1 className="admin-title">Account Deletion Requests</h1>
              <p className="admin-subtitle">
                Accounts requested for deletion (<code>disabled_status = true</code>). Approving a request
                permanently deletes the account and their waypoints while preserving all chat messages.
              </p>
            </div>
            <button
              className="admin-btn-refresh"
              onClick={fetchRequests}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {actionMessage && (
            <div className="admin-alert admin-alert-success">
              {actionMessage}
            </div>
          )}

          {error && (
            <div className="admin-alert admin-alert-danger">
              {error}
            </div>
          )}

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>UUID</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="admin-table-empty">
                      Loading deletion requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-table-empty">
                      No pending deletion requests at this time.
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.uuid}>
                      <td className="admin-cell-bold">{req.username}</td>
                      <td>{req.email}</td>
                      <td>
                        <code className="admin-uuid">{req.uuid}</code>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="admin-btn-delete"
                          onClick={() => handleDelete(req.uuid, req.username)}
                          disabled={deletingId === req.uuid}
                        >
                          {deletingId === req.uuid ? "Deleting..." : "Delete Account"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
