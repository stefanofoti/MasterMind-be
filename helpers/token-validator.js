"use strict";

const { google } = require('googleapis');
var config = require('../config.json');

const https = require('https')
const axios = require('axios');
var jwt = require('jsonwebtoken');


module.exports = (fastify, opts) => {

    const validateGoogleToken = async (token, googleId) => {
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
        if (resp && resp.statusCode === 200 && resp.email === googleId) {
            return true
        }
        return false
    }

    const generateAccessToken = function (userId) {
        return jwt.sign({ data: userId }, config.TOKEN_SECRET, { expiresIn: "1h" });
    }

    const validate = function (token, userId) {
        try {
            var decoded = jwt.verify(token, config.TOKEN_SECRET)
            if (decoded.data === userId.replace("%40", "@")) {
                return true
            }    
        } catch(err) {
            // token expired or not valid
            return false
        }
        // the token is valid, but does not belong to the given userId
        return false
    }

    return {
        validateGoogleToken,
        generateAccessToken,
        validate
    }
}
