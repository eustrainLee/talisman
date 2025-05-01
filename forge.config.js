// forge.config.js (如不存在请创建)
module.exports = {
    packagerConfig: {
      asar: true,
      extraResource: [
        './node_modules/better-sqlite3' // 包含原生模块
      ],
      ignore: [
        /^\/src($|\/)/,
        /^\/.vite($|\/)/,
        /^\/electron.vite($|\/)/
      ]
    },
    plugins: [
      ['@electron-forge/plugin-auto-unpack-natives', {
        'enabled': true
      }]
    ],
    makers: [
      // 保持您原有的打包器配置
    ]
  }