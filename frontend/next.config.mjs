/** @type {import('next').NextConfig} */
const managementApi = process.env.NEXT_PUBLIC_MANAGEMENT_API || 'http://localhost:8002'
const ingestionApi = process.env.NEXT_PUBLIC_INGESTION_API || 'http://localhost:8001'

const nextConfig = {
  env: {
    NEXT_PUBLIC_MANAGEMENT_API: managementApi,
    NEXT_PUBLIC_INGESTION_API: ingestionApi,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
