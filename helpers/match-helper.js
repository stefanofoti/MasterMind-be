"use strict";

var config = require('../config.json')
const solutionSolver = require('../helpers/solution-solver')
const rabbitmqHelper = require('../helpers/rabbitmq')
const costants = require('../costants.json')

var activeMatches = []


module.exports = (fastify, opts) => {
    const solver = solutionSolver(fastify, opts)
    const rabbitmq = rabbitmqHelper(fastify, opts)

    const getMatchById = function(id) {
        return activeMatches[id]
    }

    const userMatches = async (googleId) => {
        const involvedMatch = activeMatches.filter(function checkPlaying(match) {
            if (match.players.includes(googleId) && (match.status === costants.STATES.PENDING || match.status === costants.STATES.ACTIVE)) {
                return match
            }
        })
        return involvedMatch
    }

    const newMatch = async (googleId, sec) => {
        let player = await fastify.mongo.db.collection("players").findOne({
            playerId: googleId
        })

        const update = {
            $set: {
                matchesCounter: player.matchesCounter + 1
            }
        }

        await fastify.mongo.db.collection("players").findOneAndUpdate(
            {
                playerId: googleId
            }, update)

        let lastMatch = activeMatches.length > 0 ? activeMatches[activeMatches.length - 1] : undefined

        if (!lastMatch || lastMatch.isFull) {
            lastMatch = {
                isFull: false,
                players: [googleId],
                sec: [sec],
                matchId: activeMatches.length, //il primo match ha id 0
                status: costants.STATES.PENDING,
                roundBids: [],
                attemptsCounter: [0, 0]
            }
            activeMatches.push(lastMatch)
        } else {
            lastMatch.isFull = true
            lastMatch.players.push(googleId)
            lastMatch.sec.push(sec)
            lastMatch.status = costants.STATES.ACTIVE
        }

        if (lastMatch.isFull) {
            console.log("sending to "+lastMatch.players[0]+", "+lastMatch.players[1]+"match id = "+lastMatch.matchId)
            const data = [{content:lastMatch.players[1], type: 'id'}, {content:lastMatch.players[0], type: 'id'}]
            rabbitmq.sendMessage(lastMatch.players, data)
        }

        return lastMatch
    }

    const abortMatch = async (googleId, matchId) => {
        const match = activeMatches[matchId]
        if (match.status === costants.STATES.ACTIVE) {
            match.details = 'Left by ' + googleId
            match.status = costants.STATES.HAS_WINNER
            const oppIndex = match.players.indexOf(googleId) === 0 ? 1 : 0
            match.winner = match.players[oppIndex]
            match.playedBy = match.players
    
            let winnerDb = await fastify.mongo.db.collection("players").findOne({
                playerId: match.players[oppIndex]
            })
    
    
            let loserDb = await fastify.mongo.db.collection("players").findOne({
                playerId: googleId
            })
    
            const winnerUpdate = {
                $set: {
                    winCounter: winnerDb.winCounter + 1,
                    lastStreak: winnerDb.lastStreak + 1,
                    maxStreak: Math.max(winnerDb.lastStreak+1, winnerDb.maxStreak)
                },
                $push: {
                    matches: match
                }
            }
    
            const loserUpdate = {
                $set: {
                    loseCounter: loserDb.loseCounter + 1,
                    lastStreak: 0
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
                    playerId: googleId
                }, loserUpdate)
        
            const data = [{content: 'ABORTED', type: 'status'}]

            await rabbitmq.sendMessage([match.winner], data)

        } else if (match.status === costants.STATES.PENDING) {
            match.status = costants.STATES.ENDED
        }


        return match
    }

    const newRound = async (googleId, matchId, roundBid) => {
        const match = activeMatches[matchId]
        const playerIndex = match.players.indexOf(googleId)
        const player = googleId
        const oppIndex = playerIndex === 0 ? 1 : 0
        const opponent = match.players[oppIndex]
        const oppSec = match.sec[oppIndex]


        match.attemptsCounter[playerIndex]++

        const result = await solver.solCompare(roundBid, oppSec)
        var answer = {
            result: result
        }
        match.roundBids.push({
            triedBy: googleId,
            roundBid: roundBid,
            result: result
        })

        if (result[0] === 4) {
            // player WIN!
            match.status = costants.STATES.HAS_WINNER
            match.winner = player
            match.playedBy = match.players
            match.details = 'Won by ' + googleId

            let playerDb = await fastify.mongo.db.collection("players").findOne({
                playerId: googleId
            })


            let opponentDb = await fastify.mongo.db.collection("players").findOne({
                playerId: opponent
            })

            const playerUpdate = {
                $set: {
                    winCounter: playerDb.winCounter + 1,
                    lastStreak: playerDb.lastStreak + 1,
                    maxStreak: Math.max(playerDb.lastStreak+1, playerDb.maxStreak)
                },
                $push: {
                    matches: match
                }
            }

            const opponentUpdate = {
                $set: {
                    loseCounter: opponentDb.loseCounter + 1,
                    lastStreak: 0,
                },
                $push: {
                    matches: match
                }
            }

            /*var dest = []
            var data = []
            dest[playerIndex] = player
            dest[oppIndex] = opponent
            data[playerIndex] = 'WIN'
            data[oppIndex] = 'LOST'
            */
            const data = [{content:'LOST', type: 'status'}]

            rabbitmq.sendMessage([opponent], data)

            await fastify.mongo.db.collection("players").findOneAndUpdate(
                {
                    playerId: player
                }, playerUpdate)

            await fastify.mongo.db.collection("players").findOneAndUpdate(
                {
                    playerId: opponent
                }, opponentUpdate)

            }

            if (match.status !== costants.STATES.HAS_WINNER && match.attemptsCounter[match.players.indexOf(googleId)] >= 8 && match.attemptsCounter[oppIndex] >= 8) {
                // Match ended with no winner
                match.status = costants.STATES.DRAW
                match.winner = undefined
                match.playedBy = match.players
                match.details = 'No winner'
                const data = {content: 'DRAW', type: 'status'}
                rabbitmq.sendMessage(match.players, [data, data])
                answer.status = match.status
                // TODO save match on db
            } else if (match.status !== costants.STATES.HAS_WINNER && match.attemptsCounter[match.players.indexOf(googleId)] >= 8) {
                // Player waits for opponent. Countdown starts
                
                function timeoutFunction(match) {
                    console.log(`received status => ${match.status}`)
                    if (match.status === costants.STATES.ACTIVE) {
                        // Match ended with the timeout, so draw
                        match.status = costants.STATES.DRAW
                        match.winner = undefined
                        match.details = 'No winner'
                        match.playedBy = match.players
                        const data = {content: 'DRAW', type: 'status'}
                        rabbitmq.sendMessage(match.players, [data, data])
                        // TODO save match on db

                    }
                }
                
                setTimeout(timeoutFunction, 30000, match);
                const data = {content: 'TIMER_START', type: 'status'}
                rabbitmq.sendMessage([opponent], [data])
                answer.status = match.status
            }

        return answer
    }

    return {
        getMatchById,
        abortMatch,
        newRound,
        userMatches,
        newMatch
    }
}
