import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: 'node_modules/.vite-room-dice-test',
  optimizeDeps: { entries: ['e2e/fixtures/*.html', 'dice-box-frame.html'], include: ['react', 'react-dom/client', 'react/jsx-runtime', '@3d-dice/dice-box-threejs', 'lucide-react', 'zustand'] },
})
