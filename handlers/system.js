"use strict"

const costants = require('../costants.json')
const matchHelper = require('../helpers/match-helper')

module.exports = (fastify, opts) => {
    const hmatch = matchHelper(fastify, opts)

    const getMatches = async (request, reply) => {
        return reply.send({
            size: matchHelper.activeMatches && matchHelper.activeMatches.size,
            matches: hmatch.activeMatches
        })
    }

    return {
        getMatches
    }
}
