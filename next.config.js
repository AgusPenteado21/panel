/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Añadimos los paquetes de Firebase aquí para que Next.js los trate como externos en el servidor
    serverComponentsExternalPackages: [
      "cheerio",
      "firebase",
      "firebase/app",
      "firebase/firestore",
      // Si usas otros módulos de Firebase (ej. auth, storage), añádelos también:
      // "firebase/auth",
      // "firebase/storage",
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
