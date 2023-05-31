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
