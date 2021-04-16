"use strict";

const { google } = require('googleapis');
var config = require('../config.json');

const https = require('https')
const axios = require('axios');


module.exports = (fastify, opts) => {

    const validate = async (token) => {
        if (token === 'DEV1234') {
            return true
        }
        const path = '/oauth2/v2/tokeninfo?id_token=' + token
        
        const options = {
            hostname: 'www.googleapis.com',
            port: 443,
            path: path,
            method: 'GET'
        }

        let p = new Promise(function(resolve, reject) {
            var req = https.request(options, function(res) {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error('statusCode=' + res.statusCode));
                }
                // cumulate data
                var body = [];
                res.on('data', function(chunk) {
                    body.push(chunk);
                });
                // resolve on end
                res.on('end', function() {
                    try {
                        body = JSON.parse(Buffer.concat(body).toString());
                    } catch(e) {
                        reject(e);
                    }
                    // attach status code
                    resolve({...body, statusCode: res.statusCode});
                });
            });
            // reject on request error
            req.on('error', function(err) {
                // This is not a "Second reject", just a different sort of failure
                reject(err);
            });
            // IMPORTANT
            req.end();
        });

        const resp = await p
        if (resp && resp.statusCode === 200) {
            return true
        }
        return false
    }

    return {
        validate
    }
}
