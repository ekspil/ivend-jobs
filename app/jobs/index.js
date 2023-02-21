const checkControllerConnection = require("./checkControllerConnection")
const checkNotifications = require("./checkNotifications")
const checkDayNotifications = require("./checkDayNotifications")
const checkWeekNotifications = require("./checkWeekNotifications")
const checkMonthNotifications = require("./checkMonthNotifications")
const checkAdminStatistic = require("./checkAdminStatistics")
const checkDay = require("./dayJobs")
const checkSims = require("./checkSims")
const simsControllersCompare = require("./simsControllersCompare")
const resetSims = require("./resetSims")
const checkNoCashless = require("./checkNoCashless")
const checkIntegrations = require("./checkIntegrations")
const cron = require("node-cron")
const logger = require("my-custom-logger")

const jobs = (injects) => {
    const checkControllerConnectionJob = checkControllerConnection(injects)
    const checkNotificationsJob = checkNotifications(injects)
    const checkDayNotificationsJob = checkDayNotifications(injects)
    const checkWeekNotificationsJob = checkWeekNotifications(injects)
    const checkMonthNotificationsJob = checkMonthNotifications(injects)
    const checkAdminStatisticJob = checkAdminStatistic(injects)
    const checkDayJob = checkDay(injects)
    const checkSimsJob = checkSims(injects)
    const simsControllersCompareJob = simsControllersCompare(injects)
    const resetSimsJob = resetSims(injects)
    const checkNoCashlessJob = checkNoCashless(injects)
    const checkIntegrationsJob = checkIntegrations(injects)

    const get = (jobName) => {
        switch (jobName) {
            case "CHECK_CONTROLLER_CONNECTION":
                return checkControllerConnectionJob
            default:
                return undefined
        }
    }

    const start = () => {
        // CHECK NO CASHLESS EVERY DAY
        cron.schedule("00 00 19 * * *", () => {
            checkNoCashlessJob()
                .catch((e) => {
                    logger.error("FAILED_TO_CHECK_NO_CASHLESS")
                    logger.error(e)
                })
        })
        // RESET SIMS Every 15 minute
        cron.schedule("*/15 * * * *", () => {
            resetSimsJob()
                .catch((e) => {
                    logger.error("Failed to check reset sims")
                    logger.error(e)
                })
        })
        // Every 10 minute
        cron.schedule("*/10 * * * *", () => {
            checkControllerConnectionJob()
                .catch((e) => {
                    logger.error("Failed to check controller connection statuses")
                    logger.error(e)
                })
        })
        // Every 10 minute
        cron.schedule("*/10 * * * *", () => {
            checkIntegrationsJob()
                .catch((e) => {
                    logger.error("FAILED_TO_CHECK_INTEGRATIONS")
                    logger.error(e)
                })
        })
        // Every 1:00
        cron.schedule("00 00 11 * * *", () => {
            checkSimsJob()
                .catch((e) => {
                    logger.error("Failed to check sims")
                    logger.error(e)
                })
        })
        // Every 30 minute
        cron.schedule("*/30 * * * *", () => {
            simsControllersCompareJob()
                .catch((e) => {
                    logger.error("Failed to compare sims and controllers")
                    logger.error(e)
                })
        })
        // Every 5 minute
        cron.schedule("*/6 * * * *", () => {
            checkAdminStatisticJob()
                .catch((e) => {
                    logger.error("Failed to check admin statistic")
                    logger.error(e)
                })
        })

        // Every 15 minutes
        cron.schedule("*/15 * * * *", () => {
            checkNotificationsJob()
                .then(log => logger.info(log))
                .catch((e) => {
                    logger.error("Failed to check fast Notification requests")
                    logger.error(e)
                })
        })

        // Day start
        cron.schedule("00 47 6 * * *", () => {
            checkDayNotificationsJob()
                .then(log => logger.info(log))
                .catch((e) => {
                    logger.error("Failed to check Day Notification requests")
                    logger.error(e)
                })
        })
        // every day
        cron.schedule("00 50 23 * * *", () => {
            checkDayJob()
                .then(log => logger.info(log))
                .catch((e) => {
                    logger.error("Failed to check Day jobs")
                    logger.error(e)
                })
        })

        // Week start
        cron.schedule("00 30 9 * * 1", () => {
            checkWeekNotificationsJob()
                .then(log => logger.info(log))
                .catch((e) => {
                    logger.error("Failed to check Week Notification requests")
                    logger.error(e)
                })
        })

        // Month start
        cron.schedule("00 00 10 1 * *", () => {
            checkMonthNotificationsJob()
                .then(log => logger.info(log))
                .catch((e) => {
                    logger.error("Failed to check Month Notification requests")
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
