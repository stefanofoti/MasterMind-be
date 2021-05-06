"use strict"
const costants = require('../costants.json')

module.exports = (fastify, opts) => {

    const saveMatch = async (player, changes, match) => {
        await fastify.mongo.db.collection("players").findOneAndUpdate(
            {
                playerId: player
            }, {
            $set: changes,
            $push: {
                matches: match
            }
        })
    }

    const getPlayerById = async (id) => {
        let player = await fastify.mongo.db.collection("players").findOne({
            playerId: id
        })
        return player
    }

    return {
        saveMatch,
        getPlayerById
    }
}
