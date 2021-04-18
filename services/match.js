"use strict";

const { ObjectId } = require("mongodb");
const S = require('fluent-json-schema')
const matchHandler = require('../handlers/match')

module.exports = async function (fastify, opts, next) {
  const handlers = matchHandler(fastify, opts)

  fastify.route({
    method: 'POST',
    url: '/match/new',
    schema: {
      body: S.object()
        .prop('token', S.string().required())
        .prop('googleId', S.string().required())
        .prop('sec', S.array().minItems(4).maxItems(4).items(S.number().minimum(0).maximum(7)).required())
    },
    handler: handlers.newMatch 
  })

  fastify.route({
    method: 'POST',
    url: '/match/result',
    schema: {
      body: S.object()
        .prop('token', S.string().required())
        .prop('googleId', S.string().required())
        .prop('matchId', S.integer().required())
        .prop('roundBid', S.array().minItems(4).maxItems(4).items(S.number().minimum(0).maximum(7)).required())
    },
    handler: handlers.computeResult 
  })

  fastify.route({
    method: 'GET',
    url: '/match',
    schema: {
      querystring: S.object()
        .prop('token', S.string().required())
        .prop('googleId', S.string().required())
        .prop('matchId', S.integer().required())
    },
    handler: handlers.matchStatus 
  })

  fastify.route({
    method: 'PUT',
    url: '/match',
    schema: {
      body: S.object()
        .prop('token', S.string().required())
        .prop('googleId', S.string().required())
        .prop('matchId', S.integer().required())
    },
    handler: handlers.matchStatus 
  })

  fastify.route({
    method: 'DELETE',
    url: '/match',
    schema: {
      body: S.object()
        .prop('token', S.string().required())
        .prop('googleId', S.string().required())
        .prop('matchId', S.integer().required())
    },
    handler: handlers.abortMatch 
  })


  next();
};
