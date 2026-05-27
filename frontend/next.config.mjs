/** @type {import('next').NextConfig} */

// These are server-side only (no NEXT_PUBLIC_ prefix) — they are used in
// rewrites() which run on the Next.js server, not in the browser bundle.
const MANAGEMENT_API = process.env.MANAGEMENT_API || 'http://localhost:8002'
const INGESTION_API = process.env.INGESTION_API || 'http://localhost:8001'
const RAG_API = process.env.RAG_API || 'http://localhost:8004'
const NOTIFICATION_API = process.env.NOTIFICATION_API || 'http://localhost:8003'

const nextConfig = {
  // Django requires trailing slashes — prevent Next.js from stripping them
  // with 308 redirects on proxy paths.
  skipTrailingSlashRedirect: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  /**
   * Proxy rewrites — the browser sends requests to /api/proxy/* (same origin)
   * and Next.js forwards them to the internal Docker services.
   * This eliminates all CORS issues and removes the need for NEXT_PUBLIC_ URLs.
   */
  async rewrites() {
    return [
      // Management service (auth, drive, admin)
      {
        source: '/api/proxy/management/:path*/',
        destination: `${MANAGEMENT_API}/:path*/`,
      },
      {
        source: '/api/proxy/management/:path*',
        destination: `${MANAGEMENT_API}/:path*`,
      },
      // Ingestion service (document upload, status)
      {
        source: '/api/proxy/ingestion/:path*/',
        destination: `${INGESTION_API}/:path*/`,
      },
      {
        source: '/api/proxy/ingestion/:path*',
        destination: `${INGESTION_API}/:path*`,
      },
      // RAG / chat service (sessions, messages)
      {
        source: '/api/proxy/rag/:path*/',
        destination: `${RAG_API}/:path*/`,
      },
      {
        source: '/api/proxy/rag/:path*',
        destination: `${RAG_API}/:path*`,
      },
      // Notification service (in-app notifications + websocket)
      {
        source: '/api/proxy/notification/:path*/',
        destination: `${NOTIFICATION_API}/:path*/`,
      },
      {
        source: '/api/proxy/notification/:path*',
        destination: `${NOTIFICATION_API}/:path*`,
      },
    ]
  },
}

export default nextConfig
