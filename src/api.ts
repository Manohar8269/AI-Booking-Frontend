const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
const TOKEN_KEY = "calendar_lab_token";

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
}

export interface Meeting {
  id: number;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  location?: string | null;
  attendees?: string[] | string | null;
  status: "scheduled" | "cancelled";
  updated_at?: string;
}

export interface Approval {
  id: number;
  action_type?: string;
  action?: string;
  target_id?: number | null;
  meeting_id?: number | null;
  meeting_title?: string | null;
  meeting_status?: string | null;
  meeting_start_time?: string | null;
  payload?: Record<string, unknown>;
  status: string;
  expires_at: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  details?: string | null;
  created_at: string;
}

export interface ChatReply {
  reply: string;
  mode?: string;
  status?: string;
  approval?: Approval | null;
  meetings?: Meeting[];
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Could not reach the API. Make sure the backend is running at " + API_BASE);
  }
  if (response.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/signup") {
    setToken(null);
    window.dispatchEvent(new Event("calendar:unauthorized"));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
    throw new Error(body?.detail || body?.message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const dateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
