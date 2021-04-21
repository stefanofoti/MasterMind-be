"use strict"

const tokenValidator = require('../helpers/token-validator')
const solutionSolver = require('../helpers/solution-solver')
const match = require('../services/match')
const costants = require('../costants.json')
const rabbitmqHelper = require('../helpers/rabbitmq')
var activeMatches = []

module.exports = (fastify, opts) => {
    const validator = tokenValidator(fastify, opts)
    const solver = solutionSolver(fastify, opts)
    const rabbitmq = rabbitmqHelper(fastify, opts)

    // POST
    const newMatch = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token, body.googleId)
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
                roundBids: [],
                attemptsCounter: [0, 0]
            }
            activeMatches.push(lastMatch)
        } else {
            lastMatch.isFull = true
            lastMatch.players.push(body.googleId)
            lastMatch.sec.push(body.sec)
            lastMatch.status = costants.STATES.ACTIVE
        }
        
        reply.send({ "res": "OK", "matchId": lastMatch.matchId })
        if (lastMatch.isFull) {
            rabbitmq.sendMessage(lastMatch.matchId.toString(), 'OK')
        }
    }

    // GET polling iniziale
    const matchStatus = async (request, reply) => {
        var query = request.query

        const isValid = await validator.validate(query.token, query.googleId)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        var jwtToken = validator.generateAccessToken(body.googleId)

        const match = activeMatches[query.matchId]

        if(match && !match.players.includes(query.googleId)) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized. Not your match.' })
        }

        if (!match) {
            return reply.code(400).send({ res: 'KO', details: 'Match not found.' })
        }

        if (match.status !== costants.STATES.ACTIVE) {
            return reply.code(400).send({ res: 'KO', details: 'Match not active.' })
        }

        return reply.send({ "res": "OK", "matchId": match.matchId, "status": match.status, "winner": match.winner, "token": jwtToken })
    }

    // POST con array json nel body?  risultato su match attivo
    const computeResult = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token, body.googleId)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = activeMatches[body.matchId]

        if (!match || match.status === costants.STATES.PENDING) {
            return reply.code(400).send({ res: 'KO', details: 'Match still pending.' })
        }

        if (!match || match.status === costants.STATES.ENDED) {
            return reply.code(200).send({ res: 'OK', details: 'Match ended.', ...match })
        }

        if (!match || match.status === costants.STATES.HAS_WINNER) {
            return reply.code(200).send({ res: 'OK', details: 'You lost.', ...match })
        }

        const playerIndex = match.players.indexOf(body.googleId)
        const player = body.googleId
        const oppIndex = playerIndex === 0 ? 1 : 0
        const opponent = match.players[oppIndex]
        const oppSec = match.sec[oppIndex]

        if (match.attemptsCounter[playerIndex] > 7) {
            return reply.code(200).send({ res: 'KO', details: 'No more attempts available.', ...match })
        }

        match.attemptsCounter[playerIndex]++

        const result = await solver.solCompare(body.roundBid, oppSec)

        match.roundBids.push({
            triedBy: body.googleId,
            roundBid: body.roundBid,
            result: result
        })

        if (result[0] === 4) {
            // player WIN!
            match.status = costants.STATES.HAS_WINNER
            match.winner = player
            match.playedBy = match.players
            match.details = 'Won by ' + body.googleId

            let playerDb = await fastify.mongo.db.collection("players").findOne({
                playerId: body.googleId
            })


            let opponentDb = await fastify.mongo.db.collection("players").findOne({
                playerId: opponent
            })

            const playerUpdate = {
                $set: {
                    winCounter: playerDb.winCounter + 1
                },
                $push: {
                    matches: match
                }
            }

            const opponentUpdate = {
                $set: {
                    loseCounter: opponentDb.loseCounter + 1
                },
                $push: {
                    matches: match
                }
            }


            await fastify.mongo.db.collection("players").findOneAndUpdate(
                {
                    playerId: player
                }, playerUpdate)

            await fastify.mongo.db.collection("players").findOneAndUpdate(
                {
                    playerId: opponent
                }, opponentUpdate)

        }

        if (match.status !== costants.STATES.HAS_WINNER && match.attemptsCounter[playerIndex] >= 8 && match.attemptsCounter[oppIndex] >= 8) {
            // Match ended with no winner
            match.status = costants.STATES.DRAW
            match.winner = undefined
            match.playedBy = match.players
            match.details = 'No winner'
            return reply.code(200).send({ res: 'KO', details: 'No more attempts available.', ...match })
        }

        return reply.send({ "res": "OK", "matchId": match.matchId, "result": result })
    }

    // PUT nuova partita con lo stesso giocatore
    const playAgain = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token, body.googleId)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = activeMatches[body.matchId]
        if (match.status === costants.STATES.ACTIVE) {
            return reply.code(400).send({ res: 'KO', details: 'Match still active.' })
        }

        // Reinizializzare il match 

        match.players.push(body.googleId)
        match.status = match.players.length === 2 ? costants.STATES.ACTIVE : costants.STATES.PENDING
        return reply.send({ "res": "OK", "matches": activeMatches })
    }

    // DELETE termine partita
    const abortMatch = async (request, reply) => {
        // TODO delete rabbitmq queue
        var body = request.body

        const isValid = await validator.validate(body.token, body.googleId)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = activeMatches[body.matchId]

        if (match.status !== costants.STATES.ACTIVE) {
            return reply.code(400).send({ res: 'KO', details: 'Match not active.' })
        }

        match.details = 'Left by ' + body.googleId
        match.status = costants.STATES.HAS_WINNER
        const oppIndex = match.players.indexOf(body.googleId) === 0 ? 1 : 0
        match.winner = match.players[oppIndex]
        match.playedBy = match.players
        match.players = []

        let winnerDb = await fastify.mongo.db.collection("players").findOne({
            playerId: match.players[oppIndex]
        })


        let loserDb = await fastify.mongo.db.collection("players").findOne({
            playerId: body.googleId
        })

        const winnerUpdate = {
            $set: {
                winCounter: winnerDb.winCounter + 1
            },
            $push: {
                matches: match
            }
        }

        const loserUpdate = {
            $set: {
                loseCounter: loserDb.loseCounter + 1
            },
            $push: {
                matches: match
            }
        }


        await fastify.mongo.db.collection("players").findOneAndUpdate(
            {
                playerId: match.players[oppIndex]
            }, winnerUpdate)

        await fastify.mongo.db.collection("players").findOneAndUpdate(
            {
                playerId: body.googleId
            }, loserUpdate)

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
