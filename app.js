require("dotenv").config()
const logger = require("./app/utils/logger")

const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
    }
})
const jobs = require("./app/jobs")({knex})


const job = jobs.get(process.env.JOB_NAME)

if (!job) {
    throw new Error(`Job ${process.env.JOB_NAME} not found`)
}


job
    .run()
    .then(() => {
        logger.info(`Successfully ran job ${process.env.JOB_NAME}`)
        process.exit(0)
    })
    .catch((e) => {
        logger.error(e)
        process.exit(1)
    })
