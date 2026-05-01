import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware for Authentication
 * Handles route protection and automatic redirects based on authentication state
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get token from cookie
  const token = request.cookies.get("accessToken")?.value;
  
  // Public paths that don't require authentication
  const isLoginPage = pathname === "/login";
  
  // Protected paths (everything except login and public assets)
  const isProtectedPath = !isLoginPage;

  // If user is logged in (has token) and trying to access login page
  // Redirect to dashboard to prevent accessing auth pages when authenticated
  if (token && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // If user is not logged in (no token) and trying to access protected routes
  // Redirect to login page
  if (!token && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Allow normal response with caching for assets
  return NextResponse.next();
}

// Configure which routes should use the middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
  ],
};
