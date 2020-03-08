require("dotenv").config()
const Redis = require("ioredis")
const logger = require("my-custom-logger")
const fs = require("fs")
const version = require("./package.json").version

const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        ssl: true
    }
})

const redis = new Redis({
    port: 6379,
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD,
})

const jobs = require("./app/jobs")({knex, redis})

jobs.start()

fs.writeFile("/tmp/.healthy", "", function (err) {
    if (err) throw err
    logger.info(`Ivend jobs ${version} has started`)
})
