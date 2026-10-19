import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { invoiceMockApi } from './vite/invoiceMockApi.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET

  return {
    plugins: [
      react(),
      ...(!apiProxyTarget && mode === 'development' ? [invoiceMockApi()] : []),
    ],
    server: {
      proxy: apiProxyTarget
        ? {
            '/api': {
              target: apiProxyTarget,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  }
})
