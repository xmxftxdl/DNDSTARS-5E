const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')
const exclusionList = require('metro-config/private/defaults/exclusionList').default

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')
const config = getDefaultConfig(projectRoot)

// The mobile client imports shared rules and protocol modules from the
// repository, but it must not watch the whole workspace. In particular, the
// desktop Vite servers atomically replace node_modules/.vite-*/deps_temp_*
// directories while optimizing dependencies. Metro's Windows fallback watcher
// can otherwise discover one of those directories after Vite has removed it
// and terminate with ENOENT. Watching only the shared source roots also avoids
// scanning the multi-gigabyte desktop art library.
config.watchFolders = [
  path.resolve(workspaceRoot, 'src'),
  path.resolve(workspaceRoot, 'packages'),
  path.resolve(workspaceRoot, 'shared'),
]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = false

// Vite creates and atomically replaces `.vite-*/deps_temp_*` folders while
// optimizing the desktop clients. Metro's Windows fallback watcher can race
// that replacement and terminate with ENOENT, leaving an attached iOS dev
// client on its black native background. Exclude every Vite cache directory
// from Metro's file map; none of these generated files are mobile inputs.
const workspaceNodeModules = path
  .resolve(workspaceRoot, 'node_modules')
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const viteCachePattern = new RegExp(`${workspaceNodeModules}[\\\\]\\.vite-[^\\\\]+(?:[\\\\].*)?`)
config.resolver.blockList = exclusionList([viteCachePattern])

module.exports = config
