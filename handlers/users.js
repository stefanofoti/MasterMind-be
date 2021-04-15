"use strict"

const tokenValidator = require('../helpers/token-validator')

module.exports = (fastify, opts) => {
  const validator = tokenValidator(fastify, opts)

  const authHandler = async (request, reply) => {
    var body = request.body

    const isValid = await validator.validate(body.token)
    if (!isValid) {
      reply.code(401).send({ res: 'KO', details: 'Unauthorized. ' })
    }

    const senator = await fastify.mongo.db.collection("senators").findOne({
      googleId: body.googleId
    });

    if(senator && senator !== {}){
      reply.send({"res": "OK", ...senator })
    } else {
      reply.send({"res": "KO"})
    }
  }

  return {
    authHandler
  }
}
