import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    // Optional dependencies of wallet libraries that browsers never load.
    config.resolve.fallback = { ...config.resolve.fallback, "@react-native-async-storage/async-storage": false, "pino-pretty": false };
    return config;
  },
};

export default nextConfig;
