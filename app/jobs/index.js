const checkControllerConnection = require("./checkControllerConnection")
const checkNotifications = require("./checkNotifications")
const cron = require("node-cron")
const logger = require("my-custom-logger")

const jobs = (injects) => {
    const checkControllerConnectionJob = checkControllerConnection(injects)
    const checkNotificationsJob = checkNotifications(injects)

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
        })        // Every 10 minutes
        cron.schedule("*/5 * * * *", () => {
            checkNotificationsJob()
                .then(log => logger.info(log))
                .catch((e) => {
                    logger.error("Failed to check Notification requests for updated statuses")
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
