"use strict"

const tokenValidator = require('../helpers/token-validator')

module.exports = (fastify, opts) => {
  const validator = tokenValidator(fastify, opts)
  
  const getUserHistory = async (request, reply) => {
    var query = request.query
    const googleId = query.googleId.replace("%40", "@")

    const isValid = await validator.validate(query.token, googleId)
    if (!isValid) {
      return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
    }

    let player = await fastify.mongo.db.collection("players").findOne(
    {
        playerId: googleId
    },
    {
        playerId: 1,
        matches: 1,
        matchesCounter: 1,
        winCounter: 1,
        loseCounter: 1,
        accessCounter: 1,
        lastStreak: 1,
        maxStreak: 1
    }
    )

    /*
    // TODO push also the active macth (if any) inside the list
    let activeMatchDetails = {}
    if (query.googleId === query.requestedId) {
      const userMatches = await hmatch.userMatches(player.playerId)
      if (await userMatches.length > 0) {
        const match = userMatches[0]
        if (match.status === costants.STATES.ACTIVE) {
          activeMatchDetails = {
            activeMatchId: match.matchId
          }
        }
      }  
    }
    */
    if (player && player !== {}) {
      return reply.send({ "res": "OK", ...player })
    } else {
      return reply.send({ "res": "KO" })
    }
  }

  return {
    getUserHistory
  }
}
