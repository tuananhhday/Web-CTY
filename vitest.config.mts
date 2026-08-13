import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vite tự đọc paths trong tsconfig.json, không cần plugin riêng.
    tsconfigPaths: true,
    alias: {
      // Package "server-only" ném lỗi khi chạy ngoài React Server Component. Test chạy
      // trên Node thuần nên thay bằng module rỗng — tương đương điều kiện resolve
      // "react-server" mà package thật dùng. Guard vẫn hoạt động khi Next.js build.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      exclude: ["src/generated/**", "prisma/**", "tests/**", "**/*.config.*", ".next/**"],
    },

    /**
     * Hai nhóm test tách riêng:
     *   - unit: thuần logic, chạy song song, không cần hạ tầng
     *   - integration: chạm database thật, chạy tuần tự để không giẫm chân nhau
     */
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["./tests/setup-integration.ts"],
          // Nhiều file cùng ghi vào một database sẽ gây nhiễu lẫn nhau.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
