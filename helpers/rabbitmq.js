"use strict";

var amqp = require('amqplib/callback_api')
var config = require('../config.json')

let ch = null;
let ch2 = null;

amqp.connect(config.AMQP_URI, function (err, conn) {
    conn.createChannel(function (err, channel) {
       ch = channel
    })
})
amqp.connect(config.AMQP_URI, function (err, conn) {
    conn.createChannel(function (err, channel) {
       ch2 = channel
    })
})

module.exports = (fastify, opts) => {

    const sendMessage = async (queueNames, data) => {
        console.log("sending message "+queueNames)
        ch.assertQueue(queueNames[0], {
            exclusive: false,
            durable: false,
            autoDelete: true
        })
        ch2.assertQueue(queueNames[1], {
            exclusive: false,
            durable: false,
            autoDelete: true
        })
        ch.sendToQueue(queueNames[0], Buffer.from(data[0]))
        ch2.sendToQueue(queueNames[1], Buffer.from(data[1]))
    }

    return {
        sendMessage
    }
}
