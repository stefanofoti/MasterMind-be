"use strict"

const tokenValidator = require('../helpers/token-validator')
const costants = require('../costants.json')
const matchHelper = require('../helpers/match-helper')
const rabbitmqHelper = require('../helpers/rabbitmq')

module.exports = (fastify, opts) => {
    const validator = tokenValidator(fastify, opts)
    const hmatch = matchHelper(fastify, opts)
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

        const involvedMatch = await hmatch.userMatches(body.googleId)

        if (involvedMatch.length > 0 && involvedMatch[involvedMatch.length-1].status === costants.STATES.PENDING) {
            return reply.send({ "res": "OK", "matchId": involvedMatch[involvedMatch.length-1].matchId })            
        } else if (involvedMatch.length > 0) {
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

        if (match && !match.players.includes(googleId)) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized. Not your match.' })
        }

        if (match.status === costants.STATES.HAS_WINNER || match.status === costants.STATES.DRAW) {
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

        if (answer.status == costants.STATES.DRAW) {
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

        match.players.push(body.googleId)
        
        match.sec.push(body.sec)

        if (match.sec.length === 2) {
            match.status = costants.STATES.ACTIVE
            const data = {content: 'REMATCH_ACTIVE', type: 'status'}
            rabbitmq.sendMessage(match.players, [data, data])
        }
        
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
        if (res) {
            return reply.send({ "res": "OK" })
        }
        return reply.code(500).send({ "res": "KO", details: 'Generic error.' })
    }

    // POST
    const rematch = async (request, reply) => {
        var body = request.body

        const isValid = await validator.validate(body.token, body.googleId)
        if (!isValid) {
            return reply.code(401).send({ res: 'KO', details: 'Unauthorized.' })
        }

        const match = hmatch.getMatchById(body.matchId)

        if(match.status === costants.STATES.PENDING || match.status === costants.STATES.ACTIVE) {
            return reply.code(400).send({ res: 'KO', details: 'Can not rematch.' })
        }

        if(!match.wantsRematch) {
            match.wantsRematch = []
        }
        if(!match.wantsRematch.includes(body.googleId)) {
            match.wantsRematch.push(body.googleId)
        }

        function timeoutFunction(match) {
            console.log(`received status => ${match.status}`)            
            if (match.wantsRematch.length === 1) {
                // No rematch req received by opponent!
                match.status = costants.STATES.ENDED
                match.winner = undefined
                match.details = undefined
                const data = {content: 'REMATCH_TIMEOUT', type: 'status'}
                rabbitmq.sendMessage(match.wantsRematch, [data])
            }
        }
        if(match.wantsRematch.length === 1) {
            const data = {content: 'REMATCH_REQ', type: 'status'}
            const playerIndex = match.players.indexOf(match.wantsRematch[0])
            const oppIndex = playerIndex === 0 ? 1 : 0
            rabbitmq.sendMessage([match.players[oppIndex]], [data])
            setTimeout(timeoutFunction, 5000, match)
        }

        if(match.wantsRematch.length === 2 && match.status != costants.STATES.ENDED) {
            const data = {content: 'REMATCH_OK', type: 'status'}
            rabbitmq.sendMessage(match.wantsRematch, [data, data])
            match.sec = []
            match.roundBids = []
            match.players = []
            match.attemptsCounter = [0,0]
            match.wantsRematch = []
            match.status = costants.STATES.PENDING
        }

        return reply.send( { res: 'OK', details: 'Rematch pending' } )
    }

    return {
        newMatch,
        matchStatus,
        computeResult,
        playAgain,
        abortMatch,
        rematch
    }
}
