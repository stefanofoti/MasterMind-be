"use strict"

const tokenValidator = require('../helpers/token-validator')

module.exports = (fastify, opts) => {
  const validator = tokenValidator(fastify, opts)

  const authHandler = async (request, reply) => {
    var body = request.body

    const isValid = await validator.validate(body.token)
    if (!isValid) {
      reply.code(401).send({ res: 'KO', details: 'Unauthorized. ' })
    }

    let player = await fastify.mongo.db.collection("players").findOne({
      playerId: body.googleId
    })

    if (!player) {
      // first access!
      player = await fastify.mongo.db.collection("players").insert({
        playerId: body.googleId,
        createdOn: new Date(),
        lastSeenOn: new Date(),
        name: body.name,
        lastname: body.lastname,
        matchesCounter: 0,
        winCounter: 0,
        loseCounter: 0,
        accessCounter: 1,
        firstAccess: true,
        matches: []
      })
      if (player.result.ok) player = player.ops[0]
    } else {
      const update = {
        $set: {
          lastSeenOn: new Date(),
          accessCounter: player.accessCounter + 1,
          firstAccess: false
        }
      }

      player = await fastify.mongo.db.collection("players").findOneAndUpdate({
        playerId: body.googleId
      }, update)
      if (player.ok) player = player.value
    }

    if (player && player !== {}) {
      reply.send({ "res": "OK", ...player })
    } else {
      reply.send({ "res": "KO" })
    }
  }

  return {
    authHandler
  }
}
