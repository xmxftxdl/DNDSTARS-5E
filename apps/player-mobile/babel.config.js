module.exports = function babelConfig(api) {
  api.cache(true)
  return {
    presets: [[
      'babel-preset-expo',
      // Shared D&D rules also contain the browser-only Worker sandbox entry.
      // Mobile never executes that entry, but Hermes still has to parse the
      // module graph while bundling the data-only plugin registry.
      { unstable_transformImportMeta: true },
    ]],
  }
}
