"use strict";

const { ObjectId } = require("mongodb");
const S = require('fluent-json-schema')
const historyHandler = require('../handlers/history')

module.exports = async function (fastify, opts, next) {
  const handlers = historyHandler(fastify, opts)

  fastify.route({
  method: 'GET',
    url: '/history',
    schema: {
      querystring: S.object()
        .prop('token', S.string().required())
        .prop('googleId', S.string().required())
      },
    handler: handlers.getUserHistory 
  })

  next();
}
