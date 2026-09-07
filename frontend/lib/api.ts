const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(key = "token"): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

async function uploadFile(path: string, file: File): Promise<{ url: string }> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? "Upload failed");
  }
  return res.json();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  tokenKey = "token",
): Promise<T> {
  const token = getToken(tokenKey);
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<import("@/types").Supplier>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<import("@/types").Supplier>("/auth/me"),
  orders: {
    list: () => request<import("@/types").Order[]>("/orders"),
    get: (id: number) => request<import("@/types").Order>(`/orders/${id}`),
    confirm: (id: number) =>
      request<import("@/types").Order>(`/orders/${id}/confirm`, {
        method: "PATCH",
      }),
    fulfill: (id: number) =>
      request<import("@/types").Order>(`/orders/${id}/fulfill`, {
        method: "PATCH",
      }),
    setDeliveryDate: (id: number, delivery_date: string | null) =>
      request<import("@/types").Order>(`/orders/${id}/delivery-date`, {
        method: "PATCH",
        body: JSON.stringify({ delivery_date }),
      }),
    setNotes: (id: number, notes: string | null) =>
      request<import("@/types").Order>(`/orders/${id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      }),
  },
  invoices: {
    list: () => request<import("@/types").Invoice[]>("/invoices"),
    create: (order_id: number) =>
      request<import("@/types").Invoice>("/invoices", {
        method: "POST",
        body: JSON.stringify({ order_id }),
      }),
    markPaid: (id: number) =>
      request<import("@/types").Invoice>(`/invoices/${id}/mark-paid`, {
        method: "PATCH",
      }),
    sendEmail: (id: number) =>
      request<void>(`/invoices/${id}/send-email`, { method: "POST" }),
  },
  clients: {
    list: () => request<import("@/types").Client[]>("/clients"),
  },
  reports: {
    get: (period: string) =>
      request<import("@/types").Report>(`/reports?period=${period}`),
  },
  adminLogin: (email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  admin: {
    createSupplier: (name: string, email: string, password: string) =>
      request<import("@/types").Supplier>("/admin/suppliers", { method: "POST", body: JSON.stringify({ name, email, password }) }, "admin_token"),
    suppliers: () =>
      request<import("@/types").SupplierWithStats[]>("/admin/suppliers", {}, "admin_token"),
    setPlan: (id: number, plan: string) =>
      request<import("@/types").Supplier>(`/admin/suppliers/${id}/plan`, { method: "PATCH", body: JSON.stringify({ plan }) }, "admin_token"),
    toggleSuspend: (id: number) =>
      request<import("@/types").Supplier>(`/admin/suppliers/${id}/suspend`, { method: "PATCH" }, "admin_token"),
    deleteSupplier: (id: number) =>
      request<void>(`/admin/suppliers/${id}`, { method: "DELETE" }, "admin_token"),
    impersonate: (id: number) =>
      request<{ access_token: string }>(`/admin/suppliers/${id}/impersonate`, { method: "POST" }, "admin_token"),
    orders: () =>
      request<import("@/types").AdminOrder[]>("/admin/orders", {}, "admin_token"),
    broadcast: (subject: string, message: string) =>
      request<void>("/admin/broadcast", { method: "POST", body: JSON.stringify({ subject, message }) }, "admin_token"),
    changePassword: (current_password: string, new_password: string) =>
      request<import("@/types").Supplier>("/auth/me/password", { method: "PUT", body: JSON.stringify({ current_password, new_password }) }, "admin_token"),
  },
  whatsapp: {
    getConnection: () =>
      request<{ bsp_endpoint: string; phone_number: string } | null>(
        "/auth/whatsapp-connection",
      ),
    saveConnection: (data: {
      bsp_endpoint: string;
      bsp_api_key: string;
      phone_number: string;
    }) =>
      request<{ bsp_endpoint: string; phone_number: string }>(
        "/auth/whatsapp-connection",
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
  },
  profile: {
    update: (data: {
      name?: string;
      address?: string;
      phone?: string;
      logo?: string | null;
    }) =>
      request<import("@/types").Supplier>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    changePassword: (current_password: string, new_password: string) =>
      request<import("@/types").Supplier>("/auth/me/password", {
        method: "PUT",
        body: JSON.stringify({ current_password, new_password }),
      }),
  },
  logo: {
    upload: (file: File) => uploadFile("/auth/logo", file),
  },
  broadcast: {
    send: (message: string, mediaUrl?: string | null) =>
      request<{ sent: number; failed: number; total: number }>("/broadcast", {
        method: "POST",
        body: JSON.stringify({ message, media_url: mediaUrl ?? undefined }),
      }),
    uploadMedia: (file: File) => uploadFile("/broadcast/upload", file),
  },
  products: {
    list: () => request<import("@/types").Product[]>("/products"),
    create: (data: {
      name: string;
      sku?: string;
      unit: string;
      price_usd?: string;
      price_lbp?: string;
    }) =>
      request<import("@/types").Product>("/products", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: number,
      data: {
        name?: string;
        sku?: string;
        unit?: string;
        price_usd?: string | null;
        price_lbp?: string | null;
      },
    ) =>
      request<import("@/types").Product>(`/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deactivate: (id: number) =>
      request<void>(`/products/${id}/deactivate`, { method: "PATCH" }),
    activate: (id: number) =>
      request<void>(`/products/${id}/activate`, { method: "PATCH" }),
  },
};
