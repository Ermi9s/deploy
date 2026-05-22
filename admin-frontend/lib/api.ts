const MANAGEMENT_API = process.env.NEXT_PUBLIC_MANAGEMENT_API || 'http://localhost:8002'
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
  is_superuser?: boolean
  is_staff?: boolean
  profile?: UserProfile
}

export interface PermissionLevel {
  id: number
  name: string
  ranking: number
}

export interface Department {
  id: number
  uuid: string
  name: string
  permission_levels: PermissionLevel[]
}

export interface AuditLog {
  id: number
  actor_email: string
  action_type: string
  action_type_display: string
  target_type: string
  target_type_display: string
  target_id: string
  details: JsonObject
  ip_address: string | null
  timestamp: string
}

export interface AdminDashboardStats {
  total_users: number
  total_departments: number
  total_clearance_levels: number
  recent_audit_logs: AuditLog[]
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: JsonObject
  headers?: Record<string, string>
  auth?: boolean
  retryOnUnauthorized?: boolean
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function parseJsonSafely(value: string): JsonObject | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as JsonObject
  } catch {
    return null
  }
}

export function getStoredTokens(): AuthTokens | null {
  if (!canUseLocalStorage()) return null
  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!raw) return null
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
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
}

export function clearStoredTokens(): void {
  if (!canUseLocalStorage()) return
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

function decodeJwtPayload(token: string): JsonObject | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)
    const payload = JSON.parse(decoded) as unknown
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    return payload as JsonObject
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  const tokens = getStoredTokens()
  if (!tokens) return false
  const payload = decodeJwtPayload(tokens.access)
  const exp = typeof payload?.exp === 'number' ? payload.exp : null
  if (!exp) return true
  return exp > Math.floor(Date.now() / 1000) + 10
}

function formatErrorMessage(status: number, payload: JsonObject | null): string {
  const detail = typeof payload?.detail === 'string' ? payload.detail : null
  if (detail) return detail
  if (status === 401) return 'Your session has expired. Please sign in again.'
  return 'Request failed'
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const existing = getStoredTokens()
  if (!existing?.refresh) return null
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${MANAGEMENT_API}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: existing.refresh }),
      })
      if (!response.ok) { clearStoredTokens(); return null }
      const json = (await response.json()) as { access?: string; refresh?: string }
      if (!json.access) { clearStoredTokens(); return null }
      const updatedTokens: AuthTokens = { access: json.access, refresh: json.refresh || existing.refresh }
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
  const { method = 'GET', body, headers, auth = true, retryOnUnauthorized = true } = options
  const token = getStoredTokens()?.access
  const requestHeaders: Record<string, string> = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(headers || {}),
  }
  if (auth && token) requestHeaders.Authorization = `Bearer ${token}`

  const response = await fetch(`${MANAGEMENT_API}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const refreshedToken = await refreshAccessToken()
    if (refreshedToken) return request<T>(path, { ...options, retryOnUnauthorized: false })
  }

  const responseText = await response.text()
  const responseJson = responseText ? parseJsonSafely(responseText) : null

  if (!response.ok) throw new Error(formatErrorMessage(response.status, responseJson))
  if (!responseText) return undefined as T
  return JSON.parse(responseText) as T
}

export const api = {
  async login(email: string, password: string): Promise<AuthTokens> {
    const response = await request<{ access: string; refresh: string }>('/auth/token/', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })
    const tokens: AuthTokens = { access: response.access, refresh: response.refresh }
    setStoredTokens(tokens)
    return tokens
  },

  logout(): void {
    clearStoredTokens()
  },

  async getCurrentUser(): Promise<AuthUser> {
    return request<AuthUser>('/auth/me/')
  },

  admin: {
    async getDashboardStats(): Promise<AdminDashboardStats> {
      return request<AdminDashboardStats>('/auth/admin/dashboard/')
    },
    async listDepartments(): Promise<Department[]> {
      return request<Department[]>('/auth/admin/departments/')
    },
    async createDepartment(payload: { name: string; initial_levels?: { name: string; ranking: number }[] }): Promise<Department> {
      return request<Department>('/auth/admin/departments/', { method: 'POST', body: payload as unknown as JsonObject })
    },
    async updateDepartment(id: number, payload: { name: string }): Promise<Department> {
      return request<Department>(`/auth/admin/departments/${id}/`, { method: 'PATCH', body: payload as unknown as JsonObject })
    },
    async deleteDepartment(id: number): Promise<void> {
      await request<void>(`/auth/admin/departments/${id}/`, { method: 'DELETE' })
    },
    async listPermissionLevels(deptId: number): Promise<PermissionLevel[]> {
      return request<PermissionLevel[]>(`/auth/admin/departments/${deptId}/permission-levels/`)
    },
    async createPermissionLevel(deptId: number, payload: { name: string; ranking: number }): Promise<PermissionLevel> {
      return request<PermissionLevel>(`/auth/admin/departments/${deptId}/permission-levels/`, { method: 'POST', body: payload as unknown as JsonObject })
    },
    async updatePermissionLevel(id: number, payload: { name?: string; ranking?: number }): Promise<PermissionLevel> {
      return request<PermissionLevel>(`/auth/admin/permission-levels/${id}/`, { method: 'PATCH', body: payload as unknown as JsonObject })
    },
    async deletePermissionLevel(id: number): Promise<void> {
      await request<void>(`/auth/admin/permission-levels/${id}/`, { method: 'DELETE' })
    },
    async listUsers(params: { search?: string; department_id?: string; page?: number } = {}): Promise<PaginatedResponse<AuthUser>> {
      const parts: string[] = []
      if (params.search) parts.push(`search=${encodeURIComponent(params.search)}`)
      if (params.department_id) parts.push(`department_id=${encodeURIComponent(params.department_id)}`)
      if (params.page) parts.push(`page=${params.page}`)
      const query = parts.length > 0 ? `?${parts.join('&')}` : ''
      return request<PaginatedResponse<AuthUser>>(`/auth/admin/users/${query}`)
    },
    async assignUser(userId: number, payload: { department_id: number | null; permission_level_id: number | null }): Promise<AuthUser> {
      return request<AuthUser>(`/auth/admin/users/${userId}/assign/`, { method: 'POST', body: payload as unknown as JsonObject })
    },
    async toggleAdmin(userId: number): Promise<{ user_id: number; email: string; is_superuser: boolean }> {
      return request<{ user_id: number; email: string; is_superuser: boolean }>(`/auth/admin/users/${userId}/toggle-admin/`, { method: 'POST', body: {} })
    },
    async listAuditLogs(params: { action_type?: string; target_type?: string; page?: number } = {}): Promise<PaginatedResponse<AuditLog>> {
      const parts: string[] = []
      if (params.action_type) parts.push(`action_type=${encodeURIComponent(params.action_type)}`)
      if (params.target_type) parts.push(`target_type=${encodeURIComponent(params.target_type)}`)
      if (params.page) parts.push(`page=${params.page}`)
      const query = parts.length > 0 ? `?${parts.join('&')}` : ''
      return request<PaginatedResponse<AuditLog>>(`/auth/admin/audit-logs/${query}`)
    },
  },
}
