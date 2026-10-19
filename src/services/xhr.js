function getStoredSessionValue(key) {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key)
}

function createHeaders() {
  const appVersion =
    document.querySelector('meta[name="app-version"]')?.content ||
    getStoredSessionValue('app-version') ||
    '20.0.0'

  return {
    'Content-Type': 'application/json',
    'access-token': getStoredSessionValue('access-token') || '',
    'app-version': appVersion,
    'lightspeed-token': 'null',
  }
}

function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return normalizedPath.startsWith('/api/')
    ? normalizedPath
    : `/api${normalizedPath}`
}

function formatQuery(query) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    search.set(
      key,
      typeof value === 'object' ? JSON.stringify(value) : String(value),
    )
  }

  return search.toString()
}

async function readApiError(response) {
  const text = await response.text()
  if (!text) return new Error(`Request failed (${response.status}).`)

  let body
  try {
    body = JSON.parse(text)
  } catch {
    return new Error(`Request failed (${response.status}).`)
  }

  const error = new Error(
    body?.error?.message ??
      body?.message ??
      body?.errors?.[0]?.message ??
      `Request failed (${response.status}).`,
  )
  error.code = body?.error?.code
  error.details = body?.error?.details
  return error
}

export async function requestApi(
  path,
  { method = 'GET', query, body, signal, headers } = {},
) {
  const [pathname, existingQuery] = path.split('?')
  const queryString = formatQuery(query)
  const completeQuery = [existingQuery, queryString].filter(Boolean).join('&')
  const url = `${apiUrl(pathname)}${completeQuery ? `?${completeQuery}` : ''}`
  const response = await fetch(url, {
    method,
    headers: { ...createHeaders(), ...headers },
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  if (response.status < 200 || response.status > 204) {
    throw await readApiError(response)
  }

  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('The server returned an invalid JSON response.')
  }
}

export function readRecordPage(payload, config) {
  const rows = resolvePath(payload, config.rowsPath)
  const total = resolvePath(payload, config.totalPath)

  if (!Array.isArray(rows)) {
    throw new Error('The invoice response is missing its rows array.')
  }
  if (typeof total !== 'number' || !Number.isFinite(total)) {
    throw new Error('The invoice response total must be a number.')
  }

  return {
    rows,
    total,
    hasMore: resolvePath(payload, config.hasMorePath),
  }
}

export function resolvePath(source, path) {
  if (!path) return source
  return path.split('.').reduce((value, key) => value?.[key], source)
}
