import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { ROLE_DASHBOARD } from '@/lib/constants'

const PUBLIC_PATHS = new Set(['/login', '/register'])
const CHANGE_PASSWORD_PATH = '/change-password'

const ROLE_PREFIXES = ['/admin', '/operator', '/delivery', '/supplier', '/customer'] as const

const ALLOWED_PREFIXES: Record<string, string[]> = {
  superadmin:      ['/admin'],
  region_operator: ['/admin'],
  operator:        ['/operator'],
  delivery:        ['/delivery'],
  supplier:        ['/supplier'],
  customer:        ['/customer'],
}

function redirectTo(url: string, request: NextRequest, base: NextResponse): NextResponse {
  const res = NextResponse.redirect(new URL(url, request.url))
  base.cookies.getAll().forEach(c => res.cookies.set(c))
  return res
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request)
  const { pathname } = request.nextUrl

  // API routes manage their own auth
  if (pathname.startsWith('/api')) return supabaseResponse

  // Preview de identidad visual — accesible sin login SOLO en desarrollo.
  if (pathname === '/style-guide' && process.env.NODE_ENV !== 'production') return supabaseResponse

  // Public auth routes: redirect authenticated users to dashboard
  if (PUBLIC_PATHS.has(pathname)) {
    if (!user) return supabaseResponse
    const { data } = await supabase
      .from('users')
      .select('role, must_change_password')
      .eq('id', user.id)
      .maybeSingle()
    if (data?.must_change_password) return redirectTo(CHANGE_PASSWORD_PATH, request, supabaseResponse)
    const role = data?.role ?? 'customer'
    return redirectTo(ROLE_DASHBOARD[role] ?? '/customer', request, supabaseResponse)
  }

  // All other routes require authentication
  if (!user) return redirectTo('/login', request, supabaseResponse)

  // Change-password route: allow only if must_change_password = true
  if (pathname === CHANGE_PASSWORD_PATH) {
    const { data } = await supabase
      .from('users')
      .select('role, must_change_password')
      .eq('id', user.id)
      .maybeSingle()
    if (!data?.must_change_password) {
      return redirectTo(ROLE_DASHBOARD[data?.role ?? 'customer'] ?? '/customer', request, supabaseResponse)
    }
    return supabaseResponse
  }

  // Role-prefix routes and root: verify permission and must_change_password
  const matchedPrefix = ROLE_PREFIXES.find(p => pathname.startsWith(p))
  if (pathname === '/' || matchedPrefix) {
    const { data } = await supabase
      .from('users')
      .select('role, must_change_password')
      .eq('id', user.id)
      .maybeSingle()
    const role = data?.role ?? null

    if (!role) return redirectTo('/login', request, supabaseResponse)

    if (data?.must_change_password) return redirectTo(CHANGE_PASSWORD_PATH, request, supabaseResponse)

    if (pathname === '/') return redirectTo(ROLE_DASHBOARD[role] ?? '/customer', request, supabaseResponse)

    const allowed = ALLOWED_PREFIXES[role] ?? []
    if (matchedPrefix && !allowed.includes(matchedPrefix)) {
      return redirectTo(ROLE_DASHBOARD[role] ?? '/customer', request, supabaseResponse)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
