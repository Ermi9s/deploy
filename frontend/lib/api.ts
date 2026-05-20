const MANAGEMENT_API = process.env.NEXT_PUBLIC_MANAGEMENT_API || 'http://localhost:8002'
const INGESTION_API = process.env.NEXT_PUBLIC_INGESTION_API || 'http://localhost:8001'

const TOKEN_STORAGE_KEY = 'okm_tokens'

type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface UserProfile {
  id?: number
  contact_info?: string
  firstname?: string
  lastname?: string
  emergency_contact_name?: string
  emergency_number?: string
  profile_pic?: string | null
  address?: string
  created_at?: string
  updated_at?: string
  // MAC fields
  department?: { id: number; name: string } | null
  permission_level?: { id: number; name: string; ranking: number } | null
}

export interface AuthUser {
  id: number
  uuid?: string
  email: string
  first_name?: string
  last_name?: string
  provider?: string
  profile?: UserProfile
}

/** Per-department access rule stored on a DriveItem. */
export type DepartmentAccessMap = Record<string, number> // { "<dept-uuid>": min_ranking }

export interface DriveItem {
  id: string
  name: string
  type: 'file' | 'folder'
  parentId?: string | null
  createdAt: string
  updatedAt?: string
  deletedAt?: string | null
  fileType?: string
  fileSize?: number
  sourceDocumentId?: string | null
  taskId?: string
  /** MAC permission matrix — populated after backend changes. */
  departmentAccess?: DepartmentAccessMap
}

export interface FileVersion {
  id: string
  version: number
  size: number
  checksum: string
  storageKey: string
  createdAt: string
}

interface DriveListResponse {
  items: DriveItem[]
}

interface FileVersionListResponse {
  versions: FileVersion[]
}

interface IngestionUploadResponse {
  document_id: string
  task_id: string
  status: string
  progress: number
  stage: string
}

export interface IngestionStatusSnapshot {
  document_id: string
  task_id?: string
  status: string
  progress: number
  stage: string
  message?: string
  error_message?: string
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: JsonObject
  headers?: Record<string, string>
  auth?: boolean
  baseUrl?: string
  retryOnUnauthorized?: boolean
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function parseJsonSafely(value: string): JsonObject | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as JsonObject
  } catch {
    return null
  }
}

export function getStoredTokens(): AuthTokens | null {
  if (!canUseLocalStorage()) {
    return null
  }

  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!raw) {
    return null
  }

  const parsed = parseJsonSafely(raw)
  const access = typeof parsed?.access === 'string' ? parsed.access : null
  const refresh = typeof parsed?.refresh === 'string' ? parsed.refresh : null

  if (!access || !refresh) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    return null
  }

  return { access, refresh }
}

function setStoredTokens(tokens: AuthTokens): void {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
}

export function clearStoredTokens(): void {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

function decodeJwtPayload(token: string): JsonObject | null {
  const parts = token.split('.')
  if (parts.length < 2) {
    return null
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)
    const payload = JSON.parse(decoded) as unknown
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null
    }
    return payload as JsonObject
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  const tokens = getStoredTokens()
  if (!tokens) {
    return false
  }

  const payload = decodeJwtPayload(tokens.access)
  const exp = typeof payload?.exp === 'number' ? payload.exp : null
  if (!exp) {
    return true
  }

  // Treat tokens as expired a few seconds early to reduce race conditions.
  const now = Math.floor(Date.now() / 1000)
  return exp > now + 10
}

/** Decode MAC claims (department_id + permission_ranking) from the stored JWT. */
export interface MacContext {
  departmentId: string | null
  permissionRanking: number | null
}

export function getMacContext(): MacContext {
  const tokens = getStoredTokens()
  if (!tokens) return { departmentId: null, permissionRanking: null }
  const payload = decodeJwtPayload(tokens.access)
  return {
    departmentId: typeof payload?.department_id === 'string' ? payload.department_id : null,
    permissionRanking: typeof payload?.permission_ranking === 'number' ? payload.permission_ranking : null,
  }
}

function formatErrorMessage(status: number, payload: JsonObject | null): string {
  const detail = typeof payload?.detail === 'string' ? payload.detail : null
  const nonFieldErrors = Array.isArray(payload?.non_field_errors)
    ? payload?.non_field_errors.filter((value): value is string => typeof value === 'string')
    : []

  if (detail) {
    return detail
  }

  if (nonFieldErrors.length > 0) {
    return nonFieldErrors.join(', ')
  }

  if (payload) {
    const fieldError = Object.values(payload).find((value) =>
      typeof value === 'string' || (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string')
    )

    if (typeof fieldError === 'string') {
      return fieldError
    }

    if (Array.isArray(fieldError) && typeof fieldError[0] === 'string') {
      return fieldError[0]
    }
  }

  if (status === 401) {
    return 'Your session has expired. Please sign in again.'
  }

  return 'Request failed'
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const existing = getStoredTokens()
  if (!existing?.refresh) {
    return null
  }

  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${MANAGEMENT_API}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: existing.refresh }),
      })

      if (!response.ok) {
        clearStoredTokens()
        return null
      }

      const json = (await response.json()) as { access?: string; refresh?: string }
      if (!json.access) {
        clearStoredTokens()
        return null
      }

      const updatedTokens: AuthTokens = {
        access: json.access,
        refresh: json.refresh || existing.refresh,
      }

      setStoredTokens(updatedTokens)
      return updatedTokens.access
    } catch {
      clearStoredTokens()
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers,
    auth = true,
    baseUrl = MANAGEMENT_API,
    retryOnUnauthorized = true,
  } = options

  const token = getStoredTokens()?.access
  const requestHeaders: Record<string, string> = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(headers || {}),
  }

  if (auth && token) {
    requestHeaders.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const refreshedToken = await refreshAccessToken()
    if (refreshedToken) {
      return request<T>(path, { ...options, retryOnUnauthorized: false })
    }
  }

  const responseText = await response.text()
  const responseJson = responseText ? parseJsonSafely(responseText) : null

  if (!response.ok) {
    throw new Error(formatErrorMessage(response.status, responseJson))
  }

  if (!responseText) {
    return undefined as T
  }

  return JSON.parse(responseText) as T
}

function normalizeParent(parentId?: string | null): string | null {
  if (!parentId) {
    return null
  }

  return parentId
}

async function uploadToIngestion(file: File): Promise<IngestionUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${INGESTION_API}/api/v1/documents/upload/`, {
    method: 'POST',
    body: formData,
  })

  const responseText = await response.text()
  const responseJson = responseText ? parseJsonSafely(responseText) : null

  if (!response.ok) {
    throw new Error(formatErrorMessage(response.status, responseJson))
  }

  return JSON.parse(responseText) as IngestionUploadResponse
}

export const api = {
  async signup(payload: {
    email: string
    password: string
    first_name?: string
    last_name?: string
  }): Promise<AuthUser> {
    return request<AuthUser>('/auth/signup/', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  async login(email: string, password: string): Promise<AuthTokens> {
    const response = await request<{ access: string; refresh: string }>('/auth/token/', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })

    const tokens: AuthTokens = {
      access: response.access,
      refresh: response.refresh,
    }

    setStoredTokens(tokens)
    return tokens
  },

  logout(): void {
    clearStoredTokens()
  },

  async getCurrentUser(): Promise<AuthUser> {
    return request<AuthUser>('/auth/me/')
  },

  async updateUser(payload: {
    email?: string
    first_name?: string
    last_name?: string
  }): Promise<AuthUser> {
    return request<AuthUser>('/auth/user/', {
      method: 'PATCH',
      body: payload,
    })
  },

  async getProfile(): Promise<UserProfile> {
    return request<UserProfile>('/auth/profile/')
  },

  async updateProfile(payload: Partial<UserProfile>): Promise<UserProfile> {
    return request<UserProfile>('/auth/profile/', {
      method: 'PATCH',
      body: payload as JsonObject,
    })
  },

  async uploadProfilePicture(file: File): Promise<UserProfile> {
    const tokens = getStoredTokens()
    const formData = new FormData()
    formData.append('profile_pic', file)

    const response = await fetch(`${MANAGEMENT_API}/auth/profile/picture/`, {
      method: 'PUT',
      headers: tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : undefined,
      body: formData,
    })

    const responseText = await response.text()
    const responseJson = responseText ? parseJsonSafely(responseText) : null

    if (!response.ok) {
      throw new Error(formatErrorMessage(response.status, responseJson))
    }

    return JSON.parse(responseText) as UserProfile
  },

  async removeProfilePicture(): Promise<void> {
    await request<void>('/auth/profile/picture/', {
      method: 'DELETE',
    })
  },

  async forgotPassword(email: string): Promise<{ detail?: string }> {
    return request<{ detail?: string }>('/auth/forgot-password/', {
      method: 'POST',
      body: { email },
      auth: false,
    })
  },

  async resetPassword(payload: {
    uidb64: string
    token: string
    new_password: string
  }): Promise<{ detail?: string }> {
    return request<{ detail?: string }>('/auth/reset-password/', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  async listFiles(parentId?: string | null): Promise<DriveListResponse> {
    const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''
    return request<DriveListResponse>(`/api/drive/${query}`)
  },

  async createFolder(name: string, parentId?: string | null): Promise<DriveItem> {
    return request<DriveItem>('/api/drive/create_folder/', {
      method: 'POST',
      body: {
        name,
        parentId: normalizeParent(parentId),
      },
    })
  },

  async renameItem(itemId: string, name: string): Promise<DriveItem> {
    return request<DriveItem>(`/api/drive/${itemId}/rename/`, {
      method: 'PATCH',
      body: { name },
    })
  },

  async moveItem(itemId: string, parentId?: string | null): Promise<DriveItem> {
    return request<DriveItem>(`/api/drive/${itemId}/move/`, {
      method: 'PATCH',
      body: {
        parentId: normalizeParent(parentId),
      },
    })
  },

  async deleteFile(itemId: string, permanent = false): Promise<void> {
    const query = permanent ? '?permanent=true' : ''
    await request<void>(`/api/drive/${itemId}/delete_item/${query}`, {
      method: 'DELETE',
    })
  },

  async restoreItem(itemId: string): Promise<DriveItem> {
    return request<DriveItem>(`/api/drive/${itemId}/restore/`, {
      method: 'POST',
      body: {},
    })
  },

  async listTrash(): Promise<DriveListResponse> {
    return request<DriveListResponse>('/api/drive/trash/')
  },

  async getDownloadUrl(itemId: string): Promise<{ downloadUrl: string }> {
    return request<{ downloadUrl: string }>(`/api/drive/${itemId}/download/`)
  },

  async getVersionDownloadUrl(itemId: string, version: number): Promise<{ downloadUrl: string }> {
    return request<{ downloadUrl: string }>(`/api/drive/${itemId}/download/?version=${version}`)
  },

  async listFileVersions(itemId: string): Promise<FileVersionListResponse> {
    return request<FileVersionListResponse>(`/api/drive/${itemId}/versions/`)
  },

  async uploadDocument(file: File, parentId?: string | null, departmentAccess?: DepartmentAccessMap): Promise<DriveItem> {
    const parent = normalizeParent(parentId)
    const mimeType = file.type || 'application/octet-stream'
    const accessMap = departmentAccess || {}

    // Step 1: Upload to ingestion service (with permission matrix)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('departmentAccess', JSON.stringify(accessMap))

    const ingestionResponse = await fetch(`${INGESTION_API}/api/v1/documents/upload/`, {
      method: 'POST',
      body: formData,
    })
    const ingestionText = await ingestionResponse.text()
    const ingestionJson = ingestionText ? parseJsonSafely(ingestionText) : null
    if (!ingestionResponse.ok) {
      throw new Error(formatErrorMessage(ingestionResponse.status, ingestionJson))
    }
    const ingestion = JSON.parse(ingestionText) as IngestionUploadResponse

    // Step 2: Request a presigned PUT URL from management
    const reqData = await request<{ uploadUrl: string; storageKey: string }>('/api/drive/upload/request/', {
      method: 'POST',
      body: { name: file.name, mimeType, size: file.size, parentId: parent },
    })

    // Step 3: Stream directly to MinIO
    const putRes = await fetch(reqData.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': mimeType },
    })
    if (!putRes.ok) {
      throw new Error('Direct S3 upload failed')
    }

    // Step 4: Confirm with MAC matrix
    return request<DriveItem>('/api/drive/upload/confirm/', {
      method: 'POST',
      body: {
        storageKey: reqData.storageKey,
        name: file.name,
        mimeType,
        parentId: parent,
        documentId: ingestion.document_id,
        taskId: ingestion.task_id,
        departmentAccess: accessMap,
      },
    })
  },

  async getIngestionStatus(documentId: string): Promise<IngestionStatusSnapshot> {
    return request<IngestionStatusSnapshot>(`/api/v1/documents/${encodeURIComponent(documentId)}/status/`, {
      baseUrl: INGESTION_API,
      auth: false,
    })
  },

  getIngestionWsUrl(documentId: string): string {
    const baseUrl = new URL(INGESTION_API)
    const protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${baseUrl.host}/ws/uploads/${encodeURIComponent(documentId)}/`
  },
}
