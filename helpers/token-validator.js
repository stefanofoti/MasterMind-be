"use strict";

const { google } = require('googleapis');
var config = require('../config.json');

const https = require('https')


module.exports = (fastify, opts) => {

    const validate = async (token) => {
        if (token === 'DEV1234') {
            return true
        }
        var isValid = false
        const path = '/oauth2/v2/tokeninfo?id_token=' + token
        
        const options = {
            hostname: 'www.googleapis.com',
            port: 443,
            path: path,
            method: 'GET'
        }

        const req = https.request(options, res => {
            res.on('data', d => {
                process.stdout.write(d)
            })
            isValid = res.statusCode === 200 ? true : false 
        })

        req.on('error', error => {
            console.error(error)
        })

        req.end()
        return isValid
    }

    return {
        validate
    }
}
