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
        port: process.env.POSTGRES_PORT,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        ssl: true
    }
})

const redis = new Redis({
    sentinels: [
        {host: process.env.REDIS_HOST, port: process.env.REDIS_PORT}
    ],
    name: process.env.REDIS_NAME,
    password: process.env.REDIS_PASSWORD,
    role: "master"
})

const jobs = require("./app/jobs")({knex, redis})

jobs.start()

fs.writeFile("/tmp/.healthy", "", function (err) {
    if (err) throw err
    logger.info(`Ivend jobs ${version} has started`)
})
