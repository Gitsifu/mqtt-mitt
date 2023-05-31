import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import {mqttClient, emitter} from './util/mqtt'

Vue.prototype.$emitter = emitter
Vue.prototype.$mqttClient = mqttClient

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
