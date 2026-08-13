import { describe, it, expect } from "vitest";
import {
  detectFileType,
  isAllowedMimeType,
  kindOfMimeType,
  maxSizeFor,
  contentDispositionFor,
  ALLOWED_FILE_TYPES,
  MAGIC_BYTES_LENGTH,
  MAX_SIZE_BYTES,
} from "@/modules/media/file-types";

/**
 * Đây là lớp chặn quan trọng nhất của luồng upload: nội dung thật quyết định, không phải
 * Content-Type hay đuôi file do client gửi (§16.3, §30.4).
 */

function bytes(...values: (number | string)[]): Uint8Array {
  const flat: number[] = [];
  for (const value of values) {
    if (typeof value === "number") flat.push(value);
    else flat.push(...[...value].map((char) => char.charCodeAt(0)));
  }
  // Đệm cho đủ độ dài server thực sự đọc được.
  while (flat.length < MAGIC_BYTES_LENGTH) flat.push(0);
  return new Uint8Array(flat);
}

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes("RIFF", 0x24, 0x00, 0x00, 0x00, "WEBP");
const HEIC = bytes(0x00, 0x00, 0x00, 0x20, "ftyp", "heic");
const MP4 = bytes(0x00, 0x00, 0x00, 0x20, "ftyp", "isom");
const MOV = bytes(0x00, 0x00, 0x00, 0x20, "ftyp", "qt  ");
const PDF = bytes("%PDF-1.7");

describe("detectFileType — định dạng hợp lệ", () => {
  it.each([
    ["JPEG", JPEG, "image/jpeg"],
    ["PNG", PNG, "image/png"],
    ["WebP", WEBP, "image/webp"],
    ["HEIC", HEIC, "image/heic"],
    ["MP4", MP4, "video/mp4"],
    ["MOV", MOV, "video/quicktime"],
    ["PDF", PDF, "application/pdf"],
  ])("nhận ra %s", (_name, data, expected) => {
    expect(detectFileType(data)?.mimeType).toBe(expected);
  });

  it("ảnh iPhone (HEIC) phải nhận được — nếu không tài xế không tải ảnh lên nổi", () => {
    expect(detectFileType(HEIC)?.kind).toBe("IMAGE");
  });
});

describe("detectFileType — chặn định dạng nguy hiểm", () => {
  it("từ chối SVG dù đó là ảnh", () => {
    // SVG là XML, chứa được <script> và sự kiện inline — mở trong trình duyệt là chạy mã.
    const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg">');
    expect(detectFileType(svg)).toBeNull();
  });

  it("từ chối SVG có khai báo XML đứng trước", () => {
    expect(detectFileType(bytes('<?xml version="1.0"?><svg'))).toBeNull();
  });

  it("từ chối HTML", () => {
    expect(detectFileType(bytes("<!DOCTYPE html>"))).toBeNull();
    expect(detectFileType(bytes("<html><body>"))).toBeNull();
  });

  it("từ chối script và shell", () => {
    expect(detectFileType(bytes("#!/bin/sh\n"))).toBeNull();
    expect(detectFileType(bytes("<?php system($_GET"))).toBeNull();
  });

  it("từ chối file thực thi Windows và Linux", () => {
    expect(detectFileType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
    expect(detectFileType(bytes(0x7f, "ELF"))).toBeNull();
  });

  it("từ chối file nén", () => {
    expect(detectFileType(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull();
    expect(detectFileType(bytes(0x52, 0x61, 0x72, 0x21))).toBeNull();
  });

  it("từ chối GIF — không cần cho nghiệp vụ nên không nằm trong allowlist", () => {
    expect(detectFileType(bytes("GIF89a"))).toBeNull();
  });

  it("từ chối nội dung rỗng và quá ngắn", () => {
    expect(detectFileType(new Uint8Array([]))).toBeNull();
    expect(detectFileType(new Uint8Array([0xff]))).toBeNull();
  });
});

describe("detectFileType — không bị lừa bởi phần đầu giả", () => {
  it("RIFF nhưng không phải WEBP thì bị từ chối", () => {
    // File WAV cũng bắt đầu bằng RIFF.
    expect(detectFileType(bytes("RIFF", 0x24, 0x00, 0x00, 0x00, "WAVE"))).toBeNull();
  });

  it("ftyp nhưng brand lạ thì bị từ chối", () => {
    expect(detectFileType(bytes(0x00, 0x00, 0x00, 0x20, "ftyp", "xxxx"))).toBeNull();
  });

  it("script có chuỗi magic của ảnh đặt sai vị trí thì vẫn bị từ chối", () => {
    // Magic của JPEG phải nằm ở byte 0, không phải ở giữa file.
    expect(detectFileType(bytes("GET /", 0xff, 0xd8, 0xff))).toBeNull();
  });
});

describe("allowlist MIME", () => {
  it("không có SVG trong danh sách cho phép", () => {
    expect(isAllowedMimeType("image/svg+xml")).toBe(false);
  });

  it.each(["text/html", "application/javascript", "application/zip", "image/gif"])(
    "không cho phép %s",
    (mime) => {
      expect(isAllowedMimeType(mime)).toBe(false);
    }
  );

  it("mọi MIME trong allowlist đều tra được loại và giới hạn dung lượng", () => {
    for (const type of ALLOWED_FILE_TYPES) {
      expect(kindOfMimeType(type.mimeType)).toBe(type.kind);
      expect(maxSizeFor(type.mimeType)).toBe(MAX_SIZE_BYTES[type.kind]);
    }
  });

  it("MIME lạ không có giới hạn dung lượng — buộc tầng trên phải từ chối", () => {
    expect(maxSizeFor("image/svg+xml")).toBeNull();
    expect(kindOfMimeType("image/svg+xml")).toBeNull();
  });
});

describe("contentDispositionFor", () => {
  it("ảnh và video xem trực tiếp", () => {
    expect(contentDispositionFor("image/jpeg", "a.jpg")).toMatch(/^inline;/);
    expect(contentDispositionFor("video/mp4", "a.mp4")).toMatch(/^inline;/);
  });

  it("PDF bị ép tải xuống chứ không mở inline", () => {
    // PDF mở inline chạy được JavaScript trong một số trình duyệt.
    expect(contentDispositionFor("application/pdf", "a.pdf")).toMatch(/^attachment;/);
  });

  it("MIME không nhận diện được cũng ép tải xuống", () => {
    expect(contentDispositionFor("application/octet-stream", "a.bin")).toMatch(/^attachment;/);
  });

  it("lọc ký tự phá cấu trúc header khỏi tên file", () => {
    const header = contentDispositionFor("image/jpeg", 'evil"; x=y\r\nSet-Cookie: a=b');
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
    expect(header.match(/"/g)).toHaveLength(2);
  });
});
