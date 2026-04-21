import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedRoutes = ["/", "/parties", "/products", "/billing", "/cashflow", "/notifications", "/settings"];
const publicRoutes = ["/login", "/signup", "/forgot-password"];

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some((route) => 
    path === route || path.startsWith(`${route}/`)
  )
  const isPublicRoute = publicRoutes.includes(path)

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  if (isPublicRoute && user && path !== '/') {
    const redirectUrl = new URL('/', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
}
