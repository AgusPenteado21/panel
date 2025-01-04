/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  output: 'export', // Habilita la exportación estática
  // Si estás usando el sistema de rutas en el directorio 'app' en lugar del sistema tradicional de 'pages', necesitas esto
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;
