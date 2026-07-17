import { NextRequest, NextResponse } from 'next/server';

const LOCALES = ['en', 'ar', 'fr'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!hasLocale) {
    const cookie = request.cookies.get('dar-locale')?.value;
    const locale = LOCALES.includes(cookie ?? '') ? cookie : 'en';
    return NextResponse.redirect(new URL(`/${locale}${pathname === '/' ? '/dashboard' : pathname}`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|.*\\..*).*)'],
};
