import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isMobile = mode === 'mobile'

  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    base: './',
    build: {
      outDir: isMobile ? 'dist-mobile' : 'dist',
      rollupOptions: {
        input: {
          main: isMobile
            ? path.resolve(__dirname, 'index.mobile.html')
            : path.resolve(__dirname, 'index.html'),
        },
      },
    },
  }
})
