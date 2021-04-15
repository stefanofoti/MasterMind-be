"use strict";

const { ObjectId } = require("mongodb");
const S = require('fluent-json-schema')
const usersHandler = require('../handlers/users')

module.exports = async function (fastify, opts, next) {
  const handlers = usersHandler(fastify, opts)

  fastify.route({
    method: 'POST',
    url: '/auth',
    schema: {
      body: S.object()
        .prop('token', S.string().required())
        .prop('googleId', S.string().required())
        .prop('name', S.string().required())
        .prop('lastname', S.string().required())
      },
    handler: handlers.authHandler 
  })


  next();
};
