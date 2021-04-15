"use strict";

var config = require('../config.json')

module.exports = (fastify, opts) => {

    const solCompare = async (sol, secret) => {
        let answer = [0, 0]
        let oppNew = {}
        let myNew = {}

        var i;
        for (i = 0; i < secret.length; i++) {
            if (sol[i] === secret[i]) {
                answer[0] += 1
            } else {
                oppNew[secret[i]] = oppNew[secret[i]] ? oppNew[secret[i]] + 1 : 1
                myNew[sol[i]] = myNew[sol[i]] ? myNew[sol[i]] + 1 : 1
            }
        }

        const stats = Object.keys(myNew)

        stats.forEach(item => {
            if (oppNew[item]) {
                answer[1] += parseInt(Math.min(myNew[item], oppNew[item]))
            }
        })


        return answer
    }

    return {
        solCompare
    }
}
