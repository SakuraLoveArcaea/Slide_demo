import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
      vue(),
      svgLoader() // 支持svg
  ],
    base: '/Slide_demo/',
})
