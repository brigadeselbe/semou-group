import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome pour l'image Docker (Coolify) ; sans effet sur Vercel
  output: "standalone",
};

export default nextConfig;
