import DOMPurify from "isomorphic-dompurify";

/**
 * Làm sạch rich text trước khi lưu và trước khi render (§10, §30.1).
 *
 * Chiến lược hai lớp:
 *   1. Sanitize khi LƯU  — dữ liệu trong database luôn sạch.
 *   2. Sanitize khi ĐỌC  — phòng trường hợp dữ liệu vào database bằng đường khác
 *      (import, sửa tay, migration cũ).
 *
 * Dùng allowlist chứ không phải blocklist: chỉ thẻ và thuộc tính có tên dưới đây mới
 * được giữ lại. Mọi thứ khác bị loại, kể cả kiểu tấn công chưa biết.
 */

/** Thẻ được phép trong nội dung CMS. Không có script, style, iframe, object, embed, form. */
const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h2", "h3", "h4",
  "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li",
  "blockquote",
  "a",
  "table", "thead", "tbody", "tr", "th", "td",
  "figure", "figcaption",
  "img",
  "code", "pre",
];

const ALLOWED_ATTR = ["href", "title", "target", "rel", "src", "alt", "width", "height", "colspan", "rowspan"];

/**
 * Làm sạch HTML nội dung CMS.
 *
 * Sau khi DOMPurify chạy, hook bên dưới ép mọi liên kết ngoài phải có
 * `rel="noopener noreferrer"` — yêu cầu bắt buộc của §5 và §30.1.
 */
export function sanitizeRichText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Chặn mọi URI scheme lạ; chỉ cho http, https, mailto, tel và đường dẫn tương đối.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // Không cho phép thẻ tuỳ chỉnh và Shadow DOM.
    CUSTOM_ELEMENT_HANDLING: { tagNameCheck: null, attributeNameCheck: null },
    // Loại bỏ toàn bộ nội dung bên trong thẻ bị cấm thay vì giữ lại text.
    FORBID_CONTENTS: ["script", "style"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    // Thuộc tính sự kiện on* bị chặn bởi allowlist ở trên, khai báo lại cho rõ ý.
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });
}

// Hook chạy một lần cho toàn bộ tiến trình: gắn thuộc tính an toàn cho liên kết ngoài.
let hookInstalled = false;

function installLinkHook() {
  if (hookInstalled) return;
  hookInstalled = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    // Không dùng `instanceof Element`: khi chạy trên Node (SSR, test, script CLI) lớp
    // Element không tồn tại ở global scope. Kiểm tra theo khả năng của node thay vì kiểu.
    const element = node as Partial<Element>;
    if (element.tagName !== "A" || typeof element.getAttribute !== "function") return;

    const href = element.getAttribute("href") ?? "";
    const isExternal = /^https?:\/\//i.test(href);

    if (isExternal) {
      element.setAttribute?.("target", "_blank");
      element.setAttribute?.("rel", "noopener noreferrer");
    } else {
      // Liên kết nội bộ không cần mở tab mới.
      element.removeAttribute?.("target");
      element.removeAttribute?.("rel");
    }
  });
}

installLinkHook();

/**
 * Rút văn bản thuần từ HTML, dùng cho meta description và đoạn tóm tắt.
 * Không dùng để render — kết quả không phải HTML.
 */
export function htmlToPlainText(html: string, maxLength?: number): string {
  const text = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, " ")
    .trim();

  if (!maxLength || text.length <= maxLength) return text;

  // Cắt tại ranh giới từ để không đứt giữa chừng.
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}
