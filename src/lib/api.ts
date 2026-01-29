type ApiRequestInit = RequestInit & {
  /**
   * When true, the helper will skip automatically adding the `Content-Type`
   * header even if a JSON body is provided.
   */
  skipJsonContentType?: boolean;
};

export interface ApiRequestError extends Error {
  status?: number;
  data?: unknown;
}

type ApiFailureDetail = {
  url: string;
  method: string;
  status: number;
  statusText: string;
  correlationId?: string;
  headers: Record<string, string>;
  body?: BodyInit | null;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const ensureLeadingSlash = (value: string) => (value.startsWith("/") ? value : `/${value}`);

export const resolveApiUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = ensureLeadingSlash(path);
  return normalizedPath.startsWith('/api') ? normalizedPath : `/api${normalizedPath}`;
};

const buildHeaders = (init?: ApiRequestInit) => {
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const hasJsonBody =
    init?.body !== undefined &&
    typeof init.body === "string" &&
    init.body.trim().startsWith("{") &&
    !init?.skipJsonContentType;

  if (hasJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("X-Correlation-ID") && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    headers.set("X-Correlation-ID", crypto.randomUUID());
  }

  try {
    const jwt = typeof localStorage !== "undefined" ? localStorage.getItem("cronox.token") : null;
    if (jwt && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${jwt}`);
    }
  } catch (error) {
    console.warn("[api] Unable to read auth token from storage.", error);
  }

  return headers;
};

const emitApiFailure = (detail: ApiFailureDetail) => {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent("cronox:api-error", { detail }));
  }
};

const parseResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (error) {
      console.warn(`[api] Failed to parse JSON response for ${response.url}.`, error);
      return null;
    }
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn(
      `[api] Non-JSON response received for ${response.url}. Returning raw text.`,
      { error, preview: text.slice(0, 200) },
    );
    return text;
  }
};

export const apiRequest = async <TResponse>(path: string, init?: ApiRequestInit): Promise<TResponse> => {
  const resolvedUrl = resolveApiUrl(path);
  const headers = buildHeaders(init);

  const requestInit: RequestInit = {
    ...init,
    headers,
  };

  console.log("[api] request", {
    url: resolvedUrl,
    method: requestInit.method ?? "GET",
    hasBody: Boolean(requestInit.body),
  });

  const response = await fetch(resolvedUrl, requestInit);
  const data = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("cronox.token");
        }
        if (typeof window !== "undefined") {
          window.location.assign("/signin");
        }
      } catch (error) {
        console.warn("[api] Unable to clear auth state after 401 response.", error);
      }
    }
    const message =
      (data && typeof data === "object" && "message" in data
        ? (data as { message?: unknown }).message
        : undefined) ?? `Request failed with status ${response.status}`;

    const error = new Error(String(message)) as ApiRequestError;
    error.status = response.status;
    error.data = data;

    console.error("[api] request failed", {
      url: resolvedUrl,
      status: response.status,
      statusText: response.statusText,
      data,
    });

    emitApiFailure({
      url: resolvedUrl,
      method: requestInit.method ?? "GET",
      status: response.status,
      statusText: response.statusText,
      correlationId: headers.get("X-Correlation-ID") ?? undefined,
      headers: Object.fromEntries(headers.entries()),
      body: requestInit.body ?? null,
    });

    throw error;
  }

  console.log("[api] request successful", {
    url: resolvedUrl,
    status: response.status,
  });

  return data as TResponse;
};

export const purchaseMarketplaceToken = async (tokenId: string) =>
  apiRequest(`/marketplace/tokens/${tokenId}/purchase`, {
    method: "POST",
  });

export const getBookings = async () =>
  apiRequest(`/scheduling/bookings`, {
  });

export const getProfessionalMe = async () =>
  apiRequest(`/users/professionals/me`, {
  });

export const updateProfessionalProfile = async (payload: { skills?: string[]; certifications?: string[] }) =>
  apiRequest(`/users/professionals/me`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const createBooking = async (tokenId: string, scheduledAt: string) =>
  apiRequest(`/scheduling/bookings`, {
    method: "POST",
    body: JSON.stringify({
      tokenId,
      scheduledAt,
    }),
  });

export const getPayments = async () =>
  apiRequest(`/payments`, {
  });

export const requestRefund = async (paymentId: string) =>
  apiRequest(`/payments/${paymentId}/refund`, {
    method: "POST",
  });

export const approveRefund = async (paymentId: string) =>
  apiRequest(`/payments/${paymentId}/refund/approve`, {
    method: "POST",
  });

export const rejectRefund = async (paymentId: string) =>
  apiRequest(`/payments/${paymentId}/refund/reject`, {
    method: "POST",
  });

export const disputePayment = async (paymentId: string, reason?: string) =>
  apiRequest(`/payments/${paymentId}/dispute`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const cancelBooking = async (bookingId: string) =>
  apiRequest(`/scheduling/bookings/${bookingId}`, {
    method: "DELETE",
  });

export const getWeeklyAvailability = async (professionalId?: string) =>
  apiRequest(`/scheduling/availability/weekly${professionalId ? `?professionalId=${professionalId}` : ""}`, {
  });

export const updateWeeklyAvailability = async (
  availability: Array<{ dayOfWeek: number; startMinute: number; endMinute: number; timezone?: string }>
) =>
  apiRequest(`/scheduling/availability/weekly`, {
    method: "PUT",
    body: JSON.stringify({ availability }),
  });

export const startSession = async (sessionId: string) =>
  apiRequest(`/scheduling/sessions/${sessionId}/start`, {
    method: "POST",
  });

export const endSession = async (sessionId: string, status: "completed" | "failed") =>
  apiRequest(`/scheduling/sessions/${sessionId}/end`, {
    method: "POST",
    body: JSON.stringify({
      status,
    }),
  });
