"use strict";

var amqp = require('amqplib/callback_api')
var config = require('../config.json')

let ch = null;

amqp.connect(config.AMQP_URI, function (err, conn) {
    conn.createChannel(function (err, channel) {
       ch = channel
    })
})

/*process.on('exit', (code) => {
    ch.close();
    console.log(`Closing rabbitmq channel`);
 })*/ 

module.exports = (fastify, opts) => {

    const sendMessage = async (queueName, data) => {
        ch.assertQueue(queueName)
        ch.sendToQueue(queueName, Buffer.from(data))
    }

    return {
        sendMessage
    }
}
