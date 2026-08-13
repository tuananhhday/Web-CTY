import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Chốt bất biến giữa middleware và kết quả build.
 *
 * Middleware chọn CSP theo tiền tố đường dẫn: khu vực riêng tư nhận mức `strict` dựa trên
 * nonce. Nonce chỉ áp được cho trang render động — HTML prerender sinh lúc build không thể
 * mang nonce của request, nên trình duyệt sẽ chặn script khởi động của Next.js và trang
 * trắng hoàn toàn.
 *
 * Hỏng kiểu này KHÔNG lộ ra ở lint, typecheck hay test đơn vị: chỉ cần ai đó thêm một trang
 * dưới `/tai-khoan` mà không đọc dữ liệu theo phiên, Next.js sẽ prerender nó và màn hình đó
 * chết ở production. Test này bắt tại chỗ.
 *
 * Nguồn dữ liệu là `.next/prerender-manifest.json`, nên test chỉ có ý nghĩa sau khi build.
 * Không có `.next` thì bỏ qua thay vì báo đỏ giả — cổng kiểm tra của mỗi pha luôn chạy
 * `pnpm build` nên nó vẫn được thực thi ở đúng lúc.
 */

/** Phải khớp với `PRIVATE_PREFIXES` trong `src/middleware.ts`. */
const PRIVATE_PREFIXES = [
  "/tai-khoan",
  "/tai-xe",
  "/quan-tri",
  "/dang-nhap",
  "/dang-ky",
  "/quen-mat-khau",
  "/dat-lai-mat-khau",
  "/xac-minh",
];

const MANIFEST = resolve(process.cwd(), ".next/prerender-manifest.json");

describe("CSP nghiêm ngặt và render tĩnh không được chồng nhau", () => {
  it.skipIf(!existsSync(MANIFEST))(
    "không route nào dưới khu vực riêng tư được prerender",
    () => {
      const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
        routes: Record<string, unknown>;
        dynamicRoutes: Record<string, unknown>;
      };

      const prerendered = [
        ...Object.keys(manifest.routes ?? {}),
        ...Object.keys(manifest.dynamicRoutes ?? {}),
      ];

      const offenders = prerendered.filter((route) =>
        PRIVATE_PREFIXES.some(
          (prefix) => route === prefix || route.startsWith(`${prefix}/`)
        )
      );

      expect(
        offenders,
        `Các route sau được prerender nhưng lại nhận CSP nonce nên sẽ trắng trang. ` +
          `Thêm "export const dynamic = \\"force-dynamic\\"" vào layout tương ứng, ` +
          `hoặc bỏ chúng khỏi PRIVATE_PREFIXES:\n  ${offenders.join("\n  ")}`
      ).toEqual([]);
    }
  );
});
