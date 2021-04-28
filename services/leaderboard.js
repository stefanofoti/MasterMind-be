"use strict"

const { ObjectId } = require("mongodb")
const S = require('fluent-json-schema')
const leaderboardHandlers = require('../handlers/leaderboard')

module.exports = async function (fastify, opts, next) {
  const handlers = leaderboardHandlers(fastify, opts)

  fastify.route({
    method: 'GET',
    url: '/leaderboard',
    handler: handlers.getLeaderboard 
  })

  next();
};
