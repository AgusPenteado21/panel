/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["cheerio"],
  },
  // Elimina la configuración de imágenes si no es necesaria
  // images: {
  //   unoptimized: true
  // },
}

module.exports = nextConfig