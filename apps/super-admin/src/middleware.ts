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
  const isLoginPage = pathname === "/";
  const isPublicAsset = pathname.startsWith("/_next") || pathname.startsWith("/favicon");

  // Protected paths (everything except login and public assets)
  const isProtectedPath = !isLoginPage && !isPublicAsset;

  // If user is logged in (has token) and trying to access login page
  // Redirect to dashboard to prevent accessing auth pages when authenticated
  if (token && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const response = NextResponse.redirect(url);
    // Add cache-control to prevent back button issues
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  }

  // If user is not logged in (no token) and trying to access protected routes
  // Redirect to login page
  if (!token && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const response = NextResponse.redirect(url);
    // Add cache-control to prevent back button issues
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  }

  // Add cache-control headers to all responses to prevent back button cache
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

/**
 * Matcher Configuration
 * Specifies which routes should run through middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
