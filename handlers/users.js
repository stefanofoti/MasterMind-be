"use strict"

const { gmail } = require('googleapis/build/src/apis/gmail')
const tokenValidator = require('../helpers/token-validator')

module.exports = (fastify, opts) => {
  const validator = tokenValidator(fastify, opts)

  const authHandler = async (request, reply) => {
    var body = request.body

    const isValid = await validator.validateGoogleToken(body.token, body.googleId)
    // const isValid = true
    if (!isValid) {
      return reply.code(401).send({ res: 'KO', details: 'Unauthorized. ' })
    } 

    var jwtToken = validator.generateAccessToken(body.googleId)

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
        profilePicUri: body.profilePicUri,
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
      return reply.send({ "res": "OK", ...player, token: jwtToken })
    } else {
      return reply.send({ "res": "KO" })
    }
  }

  const getUserDetails = async (request, reply) => {
    var query = request.query

    const isValid = await validator.validate(query.token, query.googleId)
    if (!isValid) {
      return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
    }

    var jwtToken = validator.generateAccessToken(query.googleId)

    let player = await fastify.mongo.db.collection("players").findOne(
      {
        playerId: query.requestedId
      }, {
      playerId: 1,
      name: 1,
      lastname: 1,
      matchesCounter: 1,
      winCounter: 1,
      loseCounter: 1,
      accessCounter: 1,
      profilePicUri: 1
    }
    )

    if (player && player !== {}) {
      return reply.send({ "res": "OK", ...player, "token": jwtToken })
    } else {
      return reply.send({ "res": "KO" })
    }
  }

  return {
    authHandler,
    getUserDetails
  }
}
