"use strict"

const costants = require('../costants.json')

module.exports = (fastify, opts) => {

  const getLeaderboard = async (request, reply) => {
    let topPlayers = await fastify.mongo.db.collection("players").find(
    {
        maxStreak: { $gt: 0 }
    }).project({
        playerId: 1,
        name: 1,
        lastname: 1,
        matchesCounter: 1,
        winCounter: 1,
        loseCounter: 1,
        accessCounter: 1,
        lastStreak: 1,
        maxStreak: 1,
        profilePicUri: 1,
    }).sort({
        maxStreak: -1
    }).toArray()
    return reply.send({ "res": "OK", count: topPlayers.length, topPlayers: topPlayers })
  }

  return {
    getLeaderboard
  }
}
