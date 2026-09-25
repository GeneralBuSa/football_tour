/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Yalnızca `next dev` için: iki farklı oturumla (localhost + 127.0.0.1) çok oyunculu
  // akışı aynı makinede test edebilmek için. Production build'i etkilemez.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
