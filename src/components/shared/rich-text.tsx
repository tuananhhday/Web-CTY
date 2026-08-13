import { sanitizeRichText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/**
 * Render nội dung rich text từ CMS.
 *
 * Đây là NƠI DUY NHẤT trong toàn bộ dự án được dùng `dangerouslySetInnerHTML`, và chỉ
 * sau khi chuỗi đã đi qua `sanitizeRichText`. Mọi component khác tuyệt đối không được
 * chèn HTML thô (§14, §30.1).
 *
 * Nội dung được sanitize hai lần: một lần khi lưu vào database, một lần tại đây. Lần thứ
 * hai bảo vệ trường hợp dữ liệu vào database bằng đường khác (import, sửa tay, migration).
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  const safeHtml = sanitizeRichText(html);

  return (
    <div
      className={cn(
        "max-w-none text-foreground/80 leading-relaxed",
        "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-navy",
        "[&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:font-semibold [&_h4]:text-navy",
        "[&_p]:mb-4",
        "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:mb-1.5",
        "[&_a]:font-medium [&_a]:text-orange-text [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-orange-text-hover",
        "[&_strong]:font-semibold [&_strong]:text-navy",
        "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-orange [&_blockquote]:bg-navy/5 [&_blockquote]:py-2 [&_blockquote]:pl-4",
        "[&_hr]:my-8 [&_hr]:border-border",
        "[&_img]:rounded-md",
        // Bảng phải cuộn được riêng trên mobile, không đẩy cả trang cuộn ngang.
        "[&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border [&_th]:bg-navy/5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-navy",
        "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
        className
      )}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
