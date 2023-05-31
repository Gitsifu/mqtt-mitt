# MQTT.js与mitt结合使用解决message监听多次的问题

在物联网项目中，前端想要使用mqtt接收设备或是平台的消息，可以使用MQTT.js

下面是 `MQTT.js` 提供的连接示例代码

```javascript
const mqtt = require('mqtt')
const client  = mqtt.connect('mqtt://test.mosquitto.org')

client.on('connect', function () {
  client.subscribe('presence', function (err) {
    if (!err) {
      client.publish('presence', 'Hello mqtt')
    }
  })
})

client.on('message', function (topic, message) {
  // message is Buffer
  console.log(message.toString())
  client.end()
})
```

## 一、注意事项

1、mqtt客户端最好整个项目创建一个，如果一个页面创建一个，可能把服务器搞崩溃

2、`client.on('connect')` 只需监听一次，客户端创建成功并连接后触发，如果整个项目只有一个客户端，那么也就只有一个.on('connect'）。
如果监听了多次，并且在此回调中有相关的业务代码，当连接成功时，将会出现业务代码多次执行的情况。

3、`client.on('message')` 不能监听多次，如果监听多次，就算mqtt服务器只发送一次，代码却会执行多遍

4、`MQTT.js` 本身有断线重连的机制，但是我在实际场景使用时会出现断连了之后，不再重连的情况；所以还需要一个连接守护的程序

## 二、实现

要解决 第`1、2、3` 的问题，那么就需要在整个项目中mqtt创建客户端的代码只能执行一次，
监听 `connect` 也只能执行一次。

同时我们还不能在每个页面去监听 `message` 事件，在此我们也只将监听 `message` 方法
执行一次，然后在回调用通过 `mitt` 转发出去。

要解决第 `4` 个问题，我们只需要写个定时器，定时监听mqtt客户端是否连接成功。
如果连续检测到多次未连接，则尝试重新连接

添加环境变量文件 `.env.development`

```
# 开发环境配置
NODE_ENV='development'

# wss协议
VUE_APP_MQTT='wss://mqtt-connect.com/mqtt'

VUE_APP_MQTT_USERNAME='admin'

VUE_APP_MQTT_PASSWORD='123456'
```

`util/mqtt.js`

```javascript
import {connect} from 'mqtt'
import {nanoid} from "nanoid"
import mitt from 'mitt'

export const emitter = mitt()

export const mqttClient = connect(process.env.VUE_APP_MQTT, {
  clientId: 'mqttClient_' + nanoid(),
  username: process.env.VUE_APP_MQTT_USERNAME,
  password: process.env.VUE_APP_MQTT_PASSWORD
})

mqttClient.on('message', (topic, message) => {
  emitter.emit(topic, {topic, message: message.toString()})
})

function subscribe(topic) {
  mqttClient.subscribe(topic, {qos: 2}, (err) => {
    if (!err) {
      console.log(`订阅主题 ${topic} 成功`)
    }
  })
}

/**
 *
 * @param topic 订阅的topic
 * @param callbackFunction 接收到指定的topic消息之后的回调
 */
export function onMqttMessage({topic, cb}) {
  // mitt监听指定topic
  emitter.on(topic, cb)
  // 已建立mqtt链接
  if (mqttClient.connected) {
    subscribe(topic)
  } else {
    // 如果还没有连接成功，就监听连接，确保订阅一定能成功
    mqttClient.on('connect', () => {
      console.log(`mqtt：${process.env.VUE_APP_MQTT}  连接成功...`)
      // 连接成功之后再订阅
      subscribe(topic)
    })
  }
}

// 取消订阅
export function unsubscribe(topic) {
  emitter.off(topic)
  mqttClient.unsubscribe(topic, {}, (err) => {
    if (!err) {
      console.log(`取消订阅${topic}成功`)
    }
  })
}

// mqtt自检重连，间隔10秒检测一次，连续检测3次都是断连状态则手动进行链接
export function mqttReconnect() {
  let count = 0
  // 每隔10秒检测mqtt是否断连，如果断连了，重新链接
  setInterval(() => {
    // 如果还没创建好客户端
    if (!mqttClient) {
      return;
    }
    // 如果已连接
    if (mqttClient.connected) {
      count = 0
      return
    }
    // mqtt没有连接成功
    count++
    if (count >= 3) {
      mqttClient.reconnect()
      count = 0
    }
  }, 10 * 1000)
}

// 启动mqtt自检重连服务
mqttReconnect()
```

`main.js`
```javascript
import {mqttClient, emitter} from '@/util/mqtt'

Vue.prototype.$emitter = emitter
Vue.prototype.$mqttClient = mqttClient
```

## 在页面中具体使用

在具体的页面中的 `mounted` 我们需要通过 `onMqttMessage()` 来监听具体的mqtt发送过来的消息，
同时，在页面销毁之前我们需要取消 `mqtt` 订阅，以及移除mitt的监听：`unsubscribe()`

`HomeView.vue`

```vue
<template>
    <div class="home">
        mqtt客户端连接状态：{{ mqttClientStatus ? '已连接' : '未连接' }}

        <div>收到mqtt消息：</div>
        <div style="display: flex;justify-content: center;align-items: center;">
            <table border="1">
                <tr>
                    <th>topic</th>
                    <th>内容</th>
                </tr>
                <tr v-for="(item, index) in mqttMsg" :key="index">
                    <td>{{ item.topic }}</td>
                    <td>{{ item.message }}</td>
                </tr>
            </table>
        </div>
    </div>
</template>

<script>
import {onMqttMessage, unsubscribe} from "@/util/mqtt";
import mqttTopic from "@/util/mqttTopic";

export default {
    name: 'HomeView',
    components: {},
    data() {
        return {
            mqttClient: this.$mqttClient,
            mqttMsg: []
        }
    },
    computed: {
        mqttClientStatus() {
            return this.mqttClient.connected
        }
    },
    mounted() {
        onMqttMessage({
            topic: mqttTopic.demo,
            cb: ({topic, message}) => {
                // 收到 mqttTopic.demo 的mqtt消息，将信息打印出来
                console.log(`topic: 【${topic}】\n message: 【${message}】`)
                this.mqttMsg.push({
                    topic,
                    message
                })
            }
        })
    },
    beforeDestroy() {
        // 页面销毁前需要取消订阅对应的topic
        unsubscribe(mqttTopic.demo)
    }
}
</script>
<style scoped lang="scss">

</style>
```

`mqttTopic.js`

```javascript
export default {
  demo: 'mqtt/demo'
}
```

## 示例代码仓库

[GitHub仓库]()

## 注意事项

如果项目使用的是webpack5进行开发打包的，在引入MQTT.js的同时需要在配置 `vue.config.js` 中加上 `node-polyfill-webpack-plugin` 插件

```javascript
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
```

----

> 参考资料：
>
> [MQTT.js](https://github.com/mqttjs/MQTT.js)
>
> [mitt](https://github.com/developit/mitt)
>
> [vue项目中使用mqttjs，注意事项及兼容IE11的处理](https://blog.csdn.net/qinleo6/article/details/107006628/)









