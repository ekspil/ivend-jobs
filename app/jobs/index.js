const checkControllerConnection = require("./checkControllerConnection")
const checkNotifications = require("./checkNotifications")
const checkDayNotifications = require("./checkDayNotifications")
const checkWeekNotifications = require("./checkWeekNotifications")
const checkMonthNotifications = require("./checkMonthNotifications")
const cron = require("node-cron")
const logger = require("my-custom-logger")

const jobs = (injects) => {
    const checkControllerConnectionJob = checkControllerConnection(injects)
    const checkNotificationsJob = checkNotifications(injects)
    const checkDayNotificationsJob = checkDayNotifications(injects)
    const checkWeekNotificationsJob = checkWeekNotifications(injects)
    const checkMonthNotificationsJob = checkMonthNotifications(injects)

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
        cron.schedule("*/2 * * * *", () => {
            checkControllerConnectionJob()
                .catch((e) => {
                    logger.error("Failed to check payment requests for updated statuses")
                    logger.error(e)
                })
        })

        // Every 11 minutes
        cron.schedule("*/15 * * * *", () => {
            checkNotificationsJob()
                .then(log => logger.info(log))
                .catch((e) => {
                    logger.error("Failed to check Notification requests for updated statuses")
                    logger.error(e)
                })
        })

        // Day start
        cron.schedule("01 * * * * *", () => {
            checkDayNotificationsJob()
                .then(log => logger.info(log))
                .catch((e) => {
                    logger.error("Failed to check Notification requests for updated statuses")
                    logger.error(e)
                })
        })

        // Week start
        cron.schedule("00 00 11 * * 1", () => {
            checkWeekNotificationsJob()
                .then(log => logger.info(log))
                .catch((e) => {
                    logger.error("Failed to check Notification requests for updated statuses")
                    logger.error(e)
                })
        })

        // Month start
        cron.schedule("00 30 11 1 * *", () => {
            checkMonthNotificationsJob()
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
