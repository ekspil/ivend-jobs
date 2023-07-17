const logger = require("my-custom-logger")
const Services = require("./services/notificationServices")
const Handlers = require("./services/notificationHandlers")

const daylyServices = [
    "CONTROLLER_NO_CONNECTION",
    "CONTROLLER_ENCASHMENT",
    "MACHINE_ATTENTION_REQUIRED",
    "CONTROLLER_NO_SALES",
    "NO_COINS_24H",
    "NO_CASH_24H",
    "NO_CASHLESS_24H",
    "NO_RECEIPT_24H",
    "USER_LOW_BALANCE"
]

module.exports = (injects) => {



    const {CONTROLLER_NO_CONNECTION, NO_RECEIPT_24H, NO_CASH_24H, CONTROLLER_ENCASHMENT, CONTROLLER_NO_SALES, MACHINE_ATTENTION_REQUIRED, NO_COINS_24H, NO_CASHLESS_24H, USER_LOW_BALANCE} = new Handlers(injects)

    const {knex, redis} = injects

    return async () => {

        const logDate = new Date().toTimeString()
        logger.info(`${logDate} STARTED check notifications job`)

        return knex.transaction(async (trx) => {
            const services = new Services({knex, redis})

            const users = await services.getUsers(trx)

            for (const user of users) {

                const notifications = await services.getUserNotificationType(user, daylyServices, trx)
                if(!notifications) continue
                const machines = await services.getUserMachines(user, trx)
                const balance = await services.getUserBalance(user, trx)

                await services.generateMachineBaseData(user, machines, notifications, balance)

                for (const event of notifications) {

                    if(!services.existEventTarget(user, event)) continue


                    switch (event.type) {
                        case "CONTROLLER_NO_CONNECTION":
                            await CONTROLLER_NO_CONNECTION(user, event)
                            break
                        case "NO_RECEIPT_24H":
                            await NO_RECEIPT_24H(user, event)
                            break
                        case "MACHINE_ATTENTION_REQUIRED":
                            await MACHINE_ATTENTION_REQUIRED(user, event)
                            break
                        case "NO_CASHLESS_24H":
                            await NO_CASHLESS_24H(user, event)
                            break
                        case "NO_CASH_24H":
                            await NO_CASH_24H(user, event)
                            break
                        case "NO_COINS_24H":
                            await NO_COINS_24H(user, event)
                            break
                        case "USER_LOW_BALANCE":
                            await USER_LOW_BALANCE(user, event)
                            break
                        case "CONTROLLER_ENCASHMENT":
                            await CONTROLLER_ENCASHMENT(user, event)
                            break
                        case "CONTROLLER_NO_SALES":
                            await CONTROLLER_NO_SALES(user, event)
                            break
                        default:
                            break
                    }


                }

                await services.prepareAndSendMessage(user)


            }
            logger.info(`${logDate} FINISHED check notifications job`)
        })
    }


}
