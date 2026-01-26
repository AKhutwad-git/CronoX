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

  return headers;
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

    throw error;
  }

  console.log("[api] request successful", {
    url: resolvedUrl,
    status: response.status,
  });

  return data as TResponse;
};
