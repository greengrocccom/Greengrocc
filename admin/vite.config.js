import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const reactRoot = path.dirname(require.resolve('react/package.json'))
const reactDomRoot = path.dirname(require.resolve('react-dom/package.json'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Shared invoice code lives outside this app; its imports must resolve to this app's copies.
      '@shared': path.resolve(__dirname, '../shared'),
      '@react-pdf/renderer': require.resolve('@react-pdf/renderer'),
      react: reactRoot,
      'react-dom': reactDomRoot,
    },
  },
  server: {
    port: 5177,
    host: true,
    fs: {
      allow: ['..'],
    },
  },
})
