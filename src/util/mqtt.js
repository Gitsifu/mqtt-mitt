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

  // 如果mqttClient是异步创建的，定时监测是否已创建
  // const intervalId = setInterval(() => {
  //   if (mqttClient) {
  //     clearInterval(intervalId)
  //   } else {
  //     return
  //   }
  //   // 已建立mqtt链接
  //   if (mqttClient.connected) {
  //     subscribe(topic, cb)
  //   } else {
  //     // 如果还没有连接成功，就监听连接，确保订阅一定能成功
  //     console.log('mqtt正在建立连接中...')
  //     mqttClient.on('connect', () => {
  //       console.log(`mqtt：${process.env.VUE_APP_MQTT}  连接成功...`)
  //       // 连接成功之后再订阅
  //       subscribe(topic, cb)
  //     })
  //   }
  // }, 10)
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
