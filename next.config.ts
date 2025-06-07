/** @type {import('next').NextConfig} */
const nextConfig = {
  // Actualizado para Next.js 15
  experimental: {
    // serverComponentsExternalPackages ha sido movido a serverExternalPackages
  },
  // Añadir la nueva ubicación del parámetro
  serverExternalPackages: ["cheerio"],
  // Ignorar errores de ESLint durante el build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignorar errores de TypeScript durante el build
  typescript: {
    ignoreBuildErrors: true,
  }
}

module.exports = nextConfig