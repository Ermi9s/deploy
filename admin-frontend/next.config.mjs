/** @type {import('next').NextConfig} */
const managementApi = process.env.NEXT_PUBLIC_MANAGEMENT_API || 'http://localhost:8002'

const nextConfig = {
  env: {
    NEXT_PUBLIC_MANAGEMENT_API: managementApi,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
