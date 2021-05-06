"use strict";

var config = require('../config.json')
var open = require('amqplib').connect(config.AMQP_URI);

//var amqp = require('amqplib/callback_api')
//let ch = null;
//let ch2 = null;

/*
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
*/

module.exports = (fastify, opts) => {

    function publish(q, msg) {
        let ch;
        var connection;
        let publisher = open.then(function(conn) {
            connection=conn;
            return conn.createChannel();
        }).then(function(chann) {
            ch = chann;
            const queue = ch.assertQueue(q, {
                exclusive: false,
                durable: false,
                autoDelete: true
            })
            ch.purgeQueue(q).catch(function(err) {});
            return queue
        }).then(function(ok) {
            return ch.sendToQueue(q, Buffer.from(msg),{noAck:true});
        }).then(function(ok) {
            console.log('MESSAGE_SENT', msg);
            return ok; //resolve('MESSAGE_SENT')
        })
        /*.then((ok)=>{
            console.log('Assert queue response:', ok);
            setTimeout(function() { connection.close();}, 500);
        })*/
        .catch(function(err) {
            console.log(err);
            console.error('Unable to connect PUBLISHER');
            // process.exit(1);
            //reject('MESSAGE_SENT')
        });
    
        return publisher
    }

    const sendMessage = async (queueNames, data) => {
        for (let index = 0; index < queueNames.length; index++) {
            const q = queueNames[index]
            const msg = JSON.stringify(data[index])
            publish(q, msg)
        }
        /*
        console.log("sending message " + queueNames)
        ch.assertQueue(queueNames[0], {
            exclusive: false,
            durable: false,
            autoDelete: true
        })
        ch.purgeQueue(queueNames[0], function callback(err, result) {
            console.log(result)
            if (err) {
                console.log("No messages purged.")
            }
        })
        if (queueNames.length == 2) {
            ch2.assertQueue(queueNames[1], {
                exclusive: false,
                durable: false,
                autoDelete: true
            })
            ch2.purgeQueue(queueNames[1], function callback(err, result) {
                console.log(result)
                if (err) {
                    console.log("No messages purged.")
                }
            })
        }
        ch.sendToQueue(queueNames[0], Buffer.from(data[0]))
        if (queueNames.length == 2) {
            ch2.sendToQueue(queueNames[1], Buffer.from(data[1]))
        }*/

    }

    return {
        sendMessage
    }
}
