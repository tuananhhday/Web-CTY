import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import {
  buildContentSecurityPolicy,
  generateNonce,
  securityHeaders,
} from "@/lib/security-headers";

/**
 * Middleware chỉ làm hai việc: điều hướng sớm và đặt header bảo mật.
 *
 * ĐÂY KHÔNG PHẢI LỚP BẢO VỆ (§5, §30.2).
 * Middleware chỉ kiểm tra sự TỒN TẠI của cookie phiên, không xác minh chữ ký, không đọc
 * database, không biết vai trò. Mục đích là tránh chớp giao diện rồi mới redirect.
 * Authorization thật nằm ở `requireUser`/`requireStaff`/`requireDriver` trong Server
 * Component và ở policy của từng service.
 *
 * Header bảo mật thì NGƯỢC LẠI — chúng có tác dụng thật, và middleware là nơi duy nhất đặt
 * được vì CSP cần nonce mới cho từng request (§30.1).
 */

/** Khu vực bắt buộc đăng nhập. Phân quyền chi tiết do server guard đảm nhiệm. */
const PROTECTED_PREFIXES = ["/tai-khoan", "/tai-xe", "/quan-tri"];

/** Trang chỉ dành cho người chưa đăng nhập. */
const GUEST_ONLY_PATHS = ["/dang-nhap", "/dang-ky", "/quen-mat-khau"];

/** Khu vực riêng tư — không được lập chỉ mục và không cache (§28). */
const PRIVATE_PREFIXES = [...PROTECTED_PREFIXES, "/dang-nhap", "/dang-ky", "/quen-mat-khau", "/dat-lai-mat-khau", "/xac-minh"];

function isUnder(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Chỉ chấp nhận đường dẫn nội bộ, chống open redirect (§9). */
function safeReturnTo(pathname: string, search: string): string {
  const target = `${pathname}${search}`;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return "/tai-khoan";
  }
  return target;
}

/** Host ảnh ngoài được phép, giữ khớp với `images.remotePatterns` trong `next.config.ts`. */
const IMAGE_HOSTS = ["https://images.unsplash.com"] as const;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Gắn header bảo mật lên một response bất kỳ, kể cả redirect. */
function applySecurityHeaders(response: NextResponse, csp: string): NextResponse {
  for (const [name, value] of Object.entries(securityHeaders(IS_PRODUCTION))) {
    response.headers.set(name, value);
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  /*
   * Chọn mức CSP theo khu vực (§30.1).
   *
   * `PRIVATE_PREFIXES` khớp chính xác tập route render động: cả ba khu vực đăng nhập
   * (`/tai-khoan`, `/tai-xe`, `/quan-tri`) đọc phiên nên luôn động, còn nhóm `(auth)` được
   * ép động trong `src/app/(auth)/layout.tsx` để dùng được mức này.
   *
   * Trang public còn lại là prerender. HTML của chúng sinh lúc build nên không mang được
   * nonce của request; áp mức nghiêm ngặt vào đó sẽ khiến trình duyệt chặn script khởi động
   * của Next.js và trang mất sạch tương tác. Chúng nhận mức `static` — mở `'unsafe-inline'`
   * cho script nhưng giữ nguyên `frame-ancestors`, `object-src`, `form-action`, `base-uri`.
   *
   * ⚠️ Thêm trang TĨNH mới dưới `PRIVATE_PREFIXES` sẽ làm trang đó trắng. Test
   * `tests/unit/security-headers.test.ts` và bước dựng lại đều kiểm điều kiện này.
   */
  const isPrivate = isUnder(pathname, PRIVATE_PREFIXES);
  const nonce = isPrivate ? generateNonce() : undefined;
  const csp = buildContentSecurityPolicy({
    profile: isPrivate ? "strict" : "static",
    nonce,
    isProduction: IS_PRODUCTION,
    imageHosts: IMAGE_HOSTS,
  });

  // Sự tồn tại của cookie, KHÔNG phải bằng chứng phiên hợp lệ.
  const hasSessionCookie = getSessionCookie(request) !== null;

  if (!hasSessionCookie && isUnder(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dang-nhap";
    url.search = `?tiep-tuc=${encodeURIComponent(safeReturnTo(pathname, search))}`;
    return applySecurityHeaders(NextResponse.redirect(url), csp);
  }

  if (hasSessionCookie && GUEST_ONLY_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/tai-khoan";
    url.search = "";
    return applySecurityHeaders(NextResponse.redirect(url), csp);
  }

  const requestHeaders = new Headers(request.headers);

  if (nonce) {
    /*
     * Next.js đọc nonce từ header `Content-Security-Policy` CỦA REQUEST rồi tự gắn vào các
     * thẻ script nó sinh ra. Không truyền vào đây thì script khởi động của Next bị CSP chặn
     * và trang trắng. `x-nonce` là để code ứng dụng đọc lại qua `headers()` khi cần.
     */
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
  }

  const response = applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    csp
  );

  if (isPrivate) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store, must-revalidate");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Bỏ qua asset tĩnh và route API:
     *   - /api/*      tự kiểm tra quyền trong handler
     *   - /_next/*    build output
     *   - file có phần mở rộng (favicon, ảnh, robots.txt, sitemap.xml)
     */
    "/((?!api|_next/static|_next/image|.*\\.).*)",
  ],
};
