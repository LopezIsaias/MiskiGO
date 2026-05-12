import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // MVP: permite cualquier hostname HTTPS. Restringir a dominios específicos en producción.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
