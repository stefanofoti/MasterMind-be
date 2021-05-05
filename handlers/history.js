"use strict"

const tokenValidator = require('../helpers/token-validator')
const costants = require('../costants.json')

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
        maxStreak: 1,
        winner: 1
    }
    )

    var userMatches = []

    player.matches.reverse()
    const lastMatches = player.matches.slice(0,player.matches.length > costants.HISTORY_SIZE ? costants.HISTORY_SIZE: player.matches.length) 

    for(const match of lastMatches) {
      var tries = []
      var replies = []

      var opponentTries = []
      var opponentReplies = []

      match.roundBids.forEach(entry => {
          if (entry.triedBy === googleId) {
              tries.push(entry.roundBid)
              replies.push(entry.result)
          } else {
            opponentReplies.push(entry.result)
            opponentTries.push(entry.roundBid)
          }
      })
      // todo add secrets

      const playerIndex = match.players.indexOf(googleId)
      const oppIndex = playerIndex === 0 ? 1 : 0
      const oppId = match.players[oppIndex]
      console.log("opponent is " + oppId + ", idx=" + oppIndex + "myIndex=" + playerIndex + "my id: " + googleId + "players: "+match.players[0] + ", "+ match.players[1])

      let opponent = await fastify.mongo.db.collection("players").findOne(
        {
            playerId: oppId
        },
        {
            playerId: 1,
            name: 1,
            profilePicUri: 1
        })

      const m = {
        status: match.status,
        opponentId: opponent.playerId,
        opponentName: opponent.name,
        opponentPic: opponent.profilePicUri,
        tries: tries,
        replies: replies,
        opponentTries: opponentTries,
        opponentReplies: opponentReplies,
        winner: match.winner,
        heldOn: match.heldOn
      }
      userMatches.push(m)
    }

    player.matches = userMatches
    
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
