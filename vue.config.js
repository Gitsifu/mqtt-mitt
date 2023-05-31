const { defineConfig } = require('@vue/cli-service')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    plugins: [
      // mqtt.js包使用时需要polyfill，但是webpack5中默认没有这个插件
      new NodePolyfillPlugin(),
    ],
  },
})
