import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite (используется в src/lib/db/sqlite.ts для реальных данных ФНС)
  // — нативный встроенный модуль Node.js, бандлить его не нужно и нельзя.
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
