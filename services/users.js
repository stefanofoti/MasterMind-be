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
        .prop('profilePicUri', S.string().required())
      },
    handler: handlers.authHandler 
  })

  fastify.route({
    method: 'GET',
    url: '/user/details',
    schema: {
      querystring: S.object()
        .prop('token', S.string().required())
        .prop('googleId', S.string().required())
        .prop('requestedId', S.string().required())
      },
    handler: handlers.getUserDetails 
  })

  next();
};
