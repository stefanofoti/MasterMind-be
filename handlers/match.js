"use strict"

const tokenValidator = require('../helpers/token-validator')
const costants = require('../costants.json')
const matchHelper = require('../helpers/match-helper')

module.exports = (fastify, opts) => {
    const validator = tokenValidator(fastify, opts)
    const hmatch = matchHelper(fastify, opts)

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

        const involvedMatch = await hmatch.userMatches(body.googleId)

        if (involvedMatch.length > 0) {
            return reply.code(400).send({ res: 'KO', details: 'Already playing.', involvedMatch: involvedMatch })
        }

        const assignedMatch = await hmatch.newMatch(body.googleId, body.sec)

        reply.send({ "res": "OK", "matchId": assignedMatch.matchId })

    }

    const matchStatus = async (request, reply) => {
        var query = request.query
        const googleId = query.googleId.replace("%40", "@")
        const isValid = await validator.validate(query.token, query.googleId)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = hmatch.getMatchById(query.matchId)

        if (!match) {
            return reply.code(400).send({ res: 'KO', details: 'Match not found.' })
        }

        if(match && !match.players.includes(googleId)) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized. Not your match.' })
        }

        if(match.status === costants.STATES.HAS_WINNER || match.status === costants.STATES.DRAW) {
            return reply.send({ "res": "OK", "matchId": match.matchId, "status": match.status, ...match })
        }

        var tries = []
        var replies = []

        match.roundBids.forEach(entry => {
            if (entry.triedBy === googleId) {
                tries.push(entry.roundBid)
                replies.push(entry.result)
            }
        })

        const playerIndex = match.players.indexOf(googleId)
        const oppIndex = playerIndex === 0 ? 1 : 0

        console.log("returning match with status: " + match.status)
        return reply.send({ "res": "OK", "matchId": match.matchId, "status": match.status, "tries": tries, "replies": replies, "opponent": match.players[oppIndex] })
    }

    // POST con array json nel body?  risultato su match attivo
    const computeResult = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token, body.googleId)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = hmatch.getMatchById(body.matchId)

        if (!match || match.status === costants.STATES.PENDING) {
            return reply.code(400).send({ res: 'KO', details: 'Match still pending.' })
        }

        if (!match || match.status === costants.STATES.ENDED || match.status === costants.STATES.DRAW || match.status === costants.STATES.HAS_WINNER) {
            return reply.code(200).send({ res: 'OK', details: 'Match ended.', ...match })
        }

        if (match.attemptsCounter[match.players.indexOf(body.googleId)] > 7) {
            return reply.code(200).send({ res: 'KO', details: 'No more attempts available.', ...match })
        }

        const answer = await hmatch.newRound(body.googleId, body.matchId, body.roundBid)

        if(answer.status == costants.STATES.DRAW) {
            return reply.send({ "res": "OK", ...match })            
        }

        return reply.send({ "res": "OK", "matchId": match.matchId, "result": answer.result })
    }

    // PUT nuova partita con lo stesso giocatore
    const playAgain = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token, body.googleId)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = hmatch.getMatchById(body.matchId)

        if (match.status === costants.STATES.ACTIVE) {
            return reply.code(400).send({ res: 'KO', details: 'Match still active.' })
        }

        // Reinizializzare il match 
        match.players.push(body.googleId)
        match.status = match.players.length === 2 ? costants.STATES.ACTIVE : costants.STATES.PENDING
        return reply.send({ "res": "OK" })
    }

    // DELETE termine partita
    const abortMatch = async (request, reply) => {
        // TODO delete rabbitmq queue
        var body = request.body

        const isValid = await validator.validate(body.token, body.googleId)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = hmatch.getMatchById(body.matchId)

        if (match.status !== costants.STATES.ACTIVE) {
            return reply.code(400).send({ res: 'KO', details: 'Match not active.' })
        }

        const res = hmatch.abortMatch(body.googleId, body.matchId)
        if(res) {
            return reply.send({ "res": "OK" })
        }
        return reply.code(500).send({ "res": "KO", details: 'Generic error.' })
    }

    return {
        newMatch,
        matchStatus,
        computeResult,
        playAgain,
        abortMatch
    }
}
