/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/top-25',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
