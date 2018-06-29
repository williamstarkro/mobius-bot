require('dotenv').config({path: process.env.NODE_ENV ? './.env' + process.env.NODE_ENV : './.env'})

const Reddit = require('./src/adapters/reddit')
const Twitter = require('./src/adapters/twitter')

async function bootstrap () {

  const models = await require('./src/models')()
  const mobius = await require('./src/mobius')(models)

  let config = { models, mobius }

  const adapters = [
    new Reddit(config),
    new Twitter(config)
  ]

  console.log("Alive and kickin'!")

}

bootstrap()
