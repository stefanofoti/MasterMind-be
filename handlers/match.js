"use strict"

const tokenValidator = require('../helpers/token-validator')
const solutionSolver = require('../helpers/solution-solver')
const match = require('../services/match')
const costants = require('../costants.json')
var activeMatches = []

module.exports = (fastify, opts) => {
    const validator = tokenValidator(fastify, opts)
    const solver = solutionSolver(fastify, opts)

    // POST
    const newMatch = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        let player = await fastify.mongo.db.collection("players").findOne({
            playerId: body.googleId
        })

        if (!player) {
            return reply.code(400).send({ res: 'KO', details: 'Unknown player.' })
        }

        const update = {
            $set: {
                matchesCounter: player.matchesCounter + 1
            }
        }

        await fastify.mongo.db.collection("players").findOneAndUpdate(
            {
                playerId: body.googleId
            }, update)

        let lastMatch = activeMatches.length > 0 ? activeMatches[activeMatches.length - 1] : undefined

        const involvedMatch = activeMatches.filter(function checkPlaying(match) {
            if (match.players.includes(body.googleId) && (match.status === costants.STATES.PENDING || costants.STATES.ACTIVE)) {
                return match
            }
        })

        if (involvedMatch.length > 0) {
            return reply.code(400).send({ res: 'KO', details: 'Already playing.', involvedMatch: involvedMatch })
        }

        if (!lastMatch || lastMatch.isFull) {
            lastMatch = {
                isFull: false,
                players: [body.googleId],
                sec: [body.sec],
                matchId: activeMatches.length, //il primo match ha id 0
                status: costants.STATES.PENDING,
                tries: []
            }
            activeMatches.push(lastMatch)
        } else {
            lastMatch.isFull = true
            lastMatch.players.push(body.googleId)
            lastMatch.sec.push(body.sec)
            lastMatch.status = costants.STATES.ACTIVE
        }
        return reply.send({ "res": "OK", "matches": activeMatches })
    }

    // GET polling iniziale
    const matchStatus = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const involvedMatch = activeMatches.filter(function checkPlaying(match) {
            return match.players.includes(body.googleId)
        })

        if (!involvedMatch.length > 0) {
            return reply.code(400).send({ res: 'KO', details: 'Not involved in matchmaking.' })
        }

        const match = involvedMatch[involvedMatch.length - 1]

        if (match.status !== costants.STATES.ACTIVE) {
            return reply.code(400).send({ res: 'KO', details: 'Match not active.' })
        }


        return reply.send({ "res": "OK", "matchId": match.matchId, "status": match.status })
    }

    // GET -- meglio una POST con array json nel body?  risultato su match attivo
    const computeResult = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = activeMatches[body.matchId]

        if (!match || match.status === costants.STATES.PENDING) {
            return reply.code(400).send({ res: 'KO', details: 'Match not active.' })
        }

        if (!match || match.status === costants.STATES.ENDED) {
            return reply.code(200).send({ res: 'OK', details: 'Match ended.' })
        }

        const playerIndex = match.players.indexOf(body.googleId)
        const player = body.googleId
        const oppIndex = playerIndex === 0 ? 1 : 0
        const opponent = match.players[oppIndex]
        const oppSec = match.sec[oppIndex]

        const result = await solver.solCompare(body.try, oppSec)

        match.tries.push({
            triedBy: body.googleId,
            try: body.try,
            result: result
        })

        if (result[0] === 4) {
            // player WIN!
            match.status = ENDED
            match.winner = player
            match.playedBy = match.players
            match.players = []
            match.details = 'Won by ' + body.googleId

            const playerUpdate = {
                $set: {
                    winCounter: player.matchesCounter + 1
                },
                $push: {
                    matches: match
                }
            }

            const opponentUpdate = {
                $set: {
                    loseCounter: player.matchesCounter + 1
                },
                $push: {
                    matches: match
                }
            }


            await fastify.mongo.db.collection("players").findOneAndUpdate(
                {
                    playerId: player
                }, update)

            await fastify.mongo.db.collection("players").findOneAndUpdate(
                {
                    playerId: opponent
                }, update)


        }

        return reply.send({ "res": "OK", "matchId": match.matchId, "result": result })
    }

    // PUT nuova partita con lo stesso giocatore
    const playAgain = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = activeMatches[body.matchId]

        if (match.status === costants.STATES.ACTIVE) {
            return reply.code(400).send({ res: 'KO', details: 'Match still active.' })
        }

        match.players.push(body.googleId)
        match.status = match.players.length === 2 ? costants.STATES.ACTIVE : costants.STATES.PENDING
        return reply.send({ "res": "OK", "matches": activeMatches })
    }


    // DELETE termine partita
    const abortMatch = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = activeMatches[body.matchId]

        if (!match.status === costants.STATES.ACTIVE) {
            return reply.code(400).send({ res: 'KO', details: 'Match not active.' })
        }

        match.details = 'Left by ' + body.googleId
        match.status = costants.STATES.ENDED
        const oppIndex = match.players.indexOf(body.googleId) === 0 ? 1 : 0
        match.winner = match.players[oppIndex]
        match.playedBy = match.players
        match.players = []
        return reply.send({ "res": "OK", "matches": activeMatches })
    }

    return {
        newMatch,
        matchStatus,
        computeResult,
        playAgain,
        abortMatch
    }
}
