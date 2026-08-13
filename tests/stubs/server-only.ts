/**
 * Stub cho package "server-only" khi chạy Vitest.
 *
 * Package thật ném lỗi nếu bị import ngoài ngữ cảnh React Server Component. Trong test
 * chạy trên Node thuần, điều kiện đó không tồn tại nên phải thay bằng module rỗng —
 * đúng như package thật làm với điều kiện resolve "react-server".
 *
 * Đây CHỈ là stub cho test. Guard thật vẫn hoạt động bình thường khi Next.js build.
 */
export {};
