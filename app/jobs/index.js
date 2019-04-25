const checkControllerConnection = require("./checkControllerConnection")
const cron = require("node-cron")
const logger = require("../utils/logger")

const jobs = (injects) => {
    const checkControllerConnectionJob = checkControllerConnection(injects)

    const get = (jobName) => {
        switch (jobName) {
            case "CHECK_CONTROLLER_CONNECTION":
                return checkControllerConnectionJob
            default:
                return undefined
        }
    }

    const start = () => {
        // Every minute
        cron.schedule("*/1 * * * *", () => {
            checkControllerConnectionJob()
                .catch((e) => {
                    logger.error("Failed to check payment requests for updated statuses")
                    logger.error(e)
                })
        })
    }

    return {
        get,
        start
    }
}


module.exports = jobs
