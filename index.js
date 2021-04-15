const AutoLoad = require("fastify-autoload")
const path = require("path")
const fs = require("fs")
const fmongodb = require("fastify-mongodb")
var config = require('./config.json');
const fastifyHttpsRedirect = require("fastify-https-redirect");

const fastify = require("fastify")

const port = process.env.PORT || 3000;

//const fastify = require("fastify")({ 
//  logger: true,
  /* http2: true,
  https: {
    allowHTTP1: true,
    key: fs.readFileSync('./cert/key.pem'),
    cert: fs.readFileSync('./cert/cert.pem'),
    requestCert: false,
    rejectUnauthorized: false,
  } */
// });

const app = fastify({
  logger: true
})

app.register(fmongodb, {
  forceClose: true,
  url: config.DB_URI,
});

app.register(AutoLoad, {
  dir: path.join(__dirname, "services"),
});

app.listen(port, '0.0.0.0', (err, address) => {
  if (err) {
    console.log(err)
    process.exit(1)
  }
})

/*
module.exports = function (fastify, opts, next) {
  // fastify.register(fastifyHttpsRedirect, {httpPort:1080})

  fastify.register(fmongodb, {
    forceClose: true,
    url: config.DB_URI,
  });

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, "services"),
    options: Object.assign({ prefix: "/api" }),
  });

  next();
};
*/

















/*module.exports = function (fastify, opts, next) {
  // fastify.register(fastifyHttpsRedirect, {httpPort:1080})

  fastify.register(fmongodb, {
    forceClose: true,
    url: config.DB_URI,
  });

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, "services"),
    options: Object.assign({ prefix: "/api" }, opts),
  });

  next();
};
*/

