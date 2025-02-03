/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true
  },
  experimental: {
    serverComponentsExternalPackages: ["cheerio"],
  },
}

module.exports = nextConfig