"use strict";

const { ObjectId } = require("mongodb");
const S = require('fluent-json-schema')
const systemHandler = require('../handlers/system')

module.exports = async function (fastify, opts, next) {
  const handlers = systemHandler(fastify, opts)

  fastify.route({
    method: 'GET',
    url: '/system/matches',
    handler: handlers.getMatches 
  })

  fastify.route({
    method: 'GET',
    url: '/system/reset',
    handler: handlers.resetMatches 
})

  next();
};
