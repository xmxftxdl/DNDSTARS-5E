import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import {
  assertExternalArtExcludedFromBuild,
  copyBuildPublicAssets,
} from './scripts/build-public-assets.mjs'

function lightweightPublicAssetsPlugin() {
  return {
    name: 'stars-lightweight-public-assets',
    async writeBundle() {
      await copyBuildPublicAssets()
      await assertExternalArtExcludedFromBuild()
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  publicDir: command === 'serve' ? 'public' : false,
  plugins: [
    react(),
    tailwindcss(),
    ...(command === 'build' ? [lightweightPublicAssetsPlugin()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Map rendering is loaded lazily after the application shell. Without an
  // explicit entry Vite discovers react-konva only on the first map visit,
  // rebuilds the optimized dependency graph, and forces a full-page reload.
  // Pre-bundle the renderer and its React peers before either tabletop opens.
  optimizeDeps: {
    // The map route and dice iframe are lazy HTML/application entries and are
    // invisible to the default index.html scan. Scan them as cold-start roots
    // so their shared chunks are fixed before any browser connects.
    entries: [
      'index.html',
      'dice-box-frame.html',
      'src/pages/MapsWorkspacePage.tsx',
      'src/presentation/maps/MapViewportLayer.tsx',
      'src/presentation/maps/MapWorkspacePanelsLayer.tsx',
    ],
    include: [
      '@3d-dice/dice-box-threejs',
      'fflate',
      'react',
      'react-dom',
      'react-dom/client',
      'react-dom/server',
      'react-router-dom',
      'konva',
      'react-konva',
      'livekit-client',
      'lucide-react',
      'pdfjs-dist',
      'zustand',
      'zustand/middleware',
      'zustand/react/shallow',
    ],
  },
  build: {
    // Multi-page (T-P2-397): the dice iframe is its own HTML entry so Vite
    // bundles the threejs engine + the diceEngine/diceNotation modules into it.
    // It was previously a verbatim public/ file that could not import app code.
    // Both dev (Vite serves root *.html at their path) and the static dist serve
    // preserve the /dice-box-frame.html URL, so the React side is unchanged (AC4).
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        diceFrame: path.resolve(__dirname, 'dice-box-frame.html'),
      },
      output: {
        manualChunks(id) {
          const moduleId = id.replaceAll('\\', '/')
          if (moduleId.includes('srdMonsters.generated.json')) return 'srd-monster-catalog'
          if (moduleId.includes('/node_modules/react/') || moduleId.includes('/node_modules/react-dom/')) {
            return 'react-vendor'
          }
          if (moduleId.includes('/node_modules/lucide-react/')) return 'icon-vendor'
          if (
            moduleId.includes('/node_modules/three/') ||
            moduleId.includes('/node_modules/@3d-dice/') ||
            moduleId.includes('/node_modules/cannon-es/')
          ) return 'dice-vendor'
          if (moduleId.includes('/rulesets/dnd5e/plugins/pluginManifestContracts')) {
            return 'dnd5e-plugin-protocol'
          }
          if (
            moduleId.includes('/rulesets/dnd5e/plugins/pluginRegistryStore') ||
            moduleId.includes('/rulesets/dnd5e/plugins/pluginRequirementProjection')
          ) return 'dnd5e-plugin-registry'
          if (
            moduleId.includes('/rulesets/dnd5e/plugins/pluginHeadlessContracts') ||
            moduleId.includes('/rulesets/dnd5e/plugins/pluginHeadlessRuntimeRegistry')
          ) return 'dnd5e-plugin-headless-runtime'
          if (
            moduleId.includes('/rulesets/dnd5e/plugins/pluginDeclarativeCompiler') ||
            moduleId.includes('/rulesets/dnd5e/plugins/pluginLegacyMigration') ||
            moduleId.includes('/rulesets/dnd5e/plugins/pluginIdentifiers')
          ) return 'dnd5e-plugin-compiler'
            if (moduleId.includes('/rulesets/dnd5e/pluginSandbox')) return 'dnd5e-plugin-sandbox-host'
            if (moduleId.includes('/components/map/MapCombatEffects')) return 'map-combat-effects'
            if (moduleId.includes('/components/map/MapEffectPrimitives')) return 'map-effect-primitives'
            if (moduleId.includes('/components/map/MapCantripEffects')) return 'map-cantrip-effects'
            if (moduleId.includes('/components/map/MapLeveledSpellEffects')) return 'map-leveled-spell-effects'
            if (moduleId.includes('/components/map/MapTokenNode')) return 'map-token-renderer'
            if (moduleId.includes('/components/map/MapVisibilityLayers')) return 'map-visibility-layers'
            if (moduleId.includes('/components/map/MapGeometryLayers')) return 'map-geometry-layers'
            if (moduleId.includes('/components/map/MapPersistentAreaLayers')) return 'map-persistent-area-layers'
        },
      },
    },
  },
}))
