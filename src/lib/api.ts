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
    const jwt = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
    console.log("TOKEN USED:", jwt);
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

  const response = await fetch(resolvedUrl, requestInit);
  const data = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      console.warn("[api] Received 401 Unauthorized response. Auth context will handle clearing state.");
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

  return data as TResponse;
};

export const purchaseMarketplaceToken = async (tokenId: string) =>
  apiRequest(`/marketplace/tokens/${tokenId}/purchase`, {
    method: "POST",
  });

export const getBookings = async () =>
  apiRequest(`/scheduling/bookings`, {
  });

export const getSession = async (id: string) =>
  apiRequest(`/scheduling/sessions/${id}`, {
  });

export const joinSession = async (id: string) =>
  apiRequest(`/scheduling/sessions/${id}/join`, {
    method: "POST"
  });

export const leaveSession = async (id: string) =>
  apiRequest(`/scheduling/sessions/${id}/leave`, {
    method: "POST"
  });

export const getProfessionalMe = async () =>
  apiRequest(`/users/professionals/me`, {
  });

export const createProfessionalProfile = async () =>
  apiRequest(`/users/professionals/me`, {
    method: "POST",
  });

export const updateProfessionalProfile = async (payload: { 
  skills?: string[]; 
  certifications?: string[];
  fullName?: string;
  bio?: string;
  availabilitySummary?: string;
}) =>
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

export const scheduleBooking = async (bookingId: string, scheduledAt: string) =>
  apiRequest(`/scheduling/bookings/${bookingId}/schedule`, {
    method: "POST",
    body: JSON.stringify({
      scheduledAt: scheduledAt
    }),
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

export const requestEarlyStart = async (bookingId: string) =>
  apiRequest(`/scheduling/bookings/${bookingId}/request-early-start`, {
    method: "POST",
  });

export const startSessionNow = async (bookingId: string) =>
  apiRequest<{ success: boolean; meetingLink: string }>(`/scheduling/bookings/${bookingId}/start-now`, {
    method: "POST",
  });

export const buyerJoin = async (bookingId: string) =>
  apiRequest<{ success: boolean; meetingLink: string }>(`/scheduling/bookings/${bookingId}/buyer-join`, {
    method: "POST",
  });

export const pingUser = async () =>
  apiRequest(`/users/me/ping`, {
    method: "POST",
    skipJsonContentType: true
  });

export const endSession = async (sessionId: string, status: "completed" | "failed") =>
  apiRequest(`/scheduling/sessions/${sessionId}/end`, {
    method: "POST",
    body: JSON.stringify({
      status,
    }),
  });

export const getBiometricConsents = async () =>
  apiRequest(`/biometrics/consents`, {
  });

export const grantBiometricConsent = async (payload: { metricType: string; source: string }) =>
  apiRequest(`/biometrics/consents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const revokeBiometricConsent = async (consentId: string) =>
  apiRequest(`/biometrics/consents/${consentId}/revoke`, {
    method: "POST",
  });

export const getFocusScore = async () =>
  apiRequest(`/metrics/focus-score`, {});

export type FocusScoreByUserResponse = {
  score: number;
  confidence: number;
  validUntil: string;
};

export const getFocusScoreByUser = async (userId: string) =>
  apiRequest<FocusScoreByUserResponse>(`/metrics/focus-score?userId=${encodeURIComponent(userId)}`, {});

export const computeFocusScore = async () =>
  apiRequest(`/metrics/focus-score/compute`, {
    method: "POST",
  });

export const getMetrics = async () =>
  apiRequest<unknown[]>(`/metrics`, {});

export type PricingResponse = {
  price: number;
  focusScore: number;
  baseRate: number;
  multiplier: number;
  volatilityPenalty: number;
};

export const calculatePricing = async (professionalId: string) =>
  apiRequest<PricingResponse>(`/pricing/calculate`, {
    method: "POST",
    body: JSON.stringify({ professionalId }),
  });
