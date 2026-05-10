/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/deck', destination: '/deck.html' },
    ]
  },
}

export default config
