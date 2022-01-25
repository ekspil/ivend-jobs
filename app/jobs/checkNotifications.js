const logger = require("my-custom-logger")
const {sendEmail, sendTelegram, checkTime, setNotificationTime} = require("./notificationModules/utils")

const daylyServices = [
    "CONTROLLER_NO_CONNECTION",
    "CONTROLLER_ENCASHMENT",
    "MACHINE_ATTENTION_REQUIRED",

    "CONTROLLER_NO_SALES",
    "NO_COINS_24H",
    "NO_CASH_24H",
    "NO_CASHLESS_24H",
    "NO_RECEIPT_24H",
]

module.exports = (injects) => {



    const {knex, redis} = injects

    return async () => {
        const logDate = new Date().toTimeString()
        logger.info(`${logDate} STARTED check notifications job`)
        return knex.transaction(async (trx) => {


            const users = await knex("users")
                .transacting(trx)
                .select("email", "phone", "id as user_id")
            // .where({
            //     role: "VENDOR"
            // })


            for (const user of users) {

                const notifications = await knex("notification_settings")
                    .transacting(trx)
                    .select("id", "type", "email", "sms", "telegram", "tlgrm", "extraEmail", "telegramChat")
                    .whereIn("type", daylyServices)
                    .andWhere({
                        user_id: user.user_id
                    })
                    .andWhere(function(){
                        this.where("email", true).orWhere("tlgrm", true)
                    })
                if(!notifications || notifications.length === 0) continue

                const machines = await knex("machines")
                    .transacting(trx)
                    .select("id", "number", "name", "equipment_id", "user_id", "place", "controller_id")
                    .where({
                        user_id: user.user_id
                    })
                let [balance] = await knex("temps")
                    .transacting(trx)
                    .select("amount as sum")
                    .where({
                        user_id: user.user_id
                    })

                if(!balance){
                    [balance] = await knex("transactions")
                        .transacting(trx)
                        .sum("amount")
                        .where({
                            user_id: user.user_id
                        })

                }


                user.notifications = notifications
                user.balance = Number(balance.sum)
                user.machines = []
                user.msg = ""
                user.msgT = ""


                for (const machine of machines) {
                    const redisSale = await redis.get("machine_last_sale_" + machine.id)
                    const lastSale = {
                        created_at: new Date(redisSale)
                    }

                    const redisEncash = await redis.get("machine_encashment_" + machine.id)
                    const lastEncashment = {
                        created_at: new Date(redisEncash),
                        timestamp: new Date(redisEncash),
                    }


                    const redisLostCon = await redis.get("machine_error_time_" + machine.id)
                    const lastLostConnection = {
                        created_at: new Date(Number(redisLostCon)),
                    }


                    machine.lastSale = lastSale ? lastSale.created_at.getTime() : 10000000
                    machine.lastEncashment = lastEncashment ? lastEncashment.created_at.getTime() : 10000000
                    machine.lostConnection = lastLostConnection ? lastLostConnection.created_at.getTime() : 10000000

                    machine.kktStatus = await redis.get("kkt_status_" + machine.id)
                    machine.terminalStatus = await redis.get("terminal_status_" + machine.id)
                    machine.banknoteCollectorStatus = await redis.get("machine_banknote_collector_status_" + machine.id)
                    machine.coinCollectorStatus = await redis.get("machine_coin_collector_status_" + machine.id)

                    machine.connectionBack = await redis.get("controller_connected_back" + machine.id)


                    user.machines.push(machine)

                }

                for (const event of notifications) {

                    if (!event.email && !event.tlgrm) {
                        continue
                    }
                    if (!user.extraEmail && event.extraEmail) {
                        user.extraEmail = event.extraEmail
                    }
                    if (!user.telegramChat && event.telegramChat) {
                        user.telegramChat = event.telegramChat
                    }
                    let textBalance = ""

                    switch (event.type) {
                        case "CONTROLLER_NO_CONNECTION":

                            for (const mach of user.machines) {

                                if(mach.connectionBack === "OK"){



                                    if (event.tlgrm && event.telegramChat) {

                                        user.msgT = `${user.msgT}
Автомат ${mach.name} ( ${mach.number} ) - Связь восстановлена`
                                    }
                                    if (event.email  && event.extraEmail) {
                                        user.msg = user.msg + "<br>" + "Автомат " + mach.name + " (" + mach.number + ") - Связь восстановлена"
                                    }

                                    await redis.set("controller_connected_back" + mach.id, null, "EX", 24 * 60 * 60)
                                    continue

                                }

                                if (!checkTime(event, "machine" + mach.id + mach.lostConnection)) {
                                    continue
                                }
                                if (mach.lostConnection < (new Date().getTime() - 24 * 60 * 60 * 1000)) {
                                    continue
                                }


                                if (event.tlgrm && event.telegramChat) {

                                    user.msgT = `${user.msgT}
Автомат ${mach.name} ( ${mach.number} ) - Нет связи с автоматом`
                                }
                                if (event.email  && event.extraEmail) {
                                    user.msg = user.msg + "<br>" + "Автомат " + mach.name + " (" + mach.number + ") - Нет связи с автоматом"
                                }
                                await setNotificationTime(event.type, "machine" + mach.id + mach.lostConnection)
                            }

                            break
                        case "NO_RECEIPT_24H":

                            for (const mach of user.machines) {
                                if (!checkTime(event, "NO_RECEIPT_24H" + mach.id)) {
                                    continue
                                }
                                if(mach.kktStatus === "ERROR" || mach.kktStatus !== "24H" ){
                                    continue
                                }
                                if (event.tlgrm && event.telegramChat) {

                                    user.msgT = `${user.msgT}
Автомат ${mach.name} (${mach.number}) - Нет чеков 24 часа`
                                }
                                if (event.email  && event.extraEmail) {
                                    user.msg = user.msg + "<br>" + "Автомат " + mach.name + " (" + mach.number + ") - Нет чеков 24 часа"
                                }

                                // add machine log
                                await knex("machine_logs")
                                    .insert({
                                        message: "Нет чеков 24 часа",
                                        type: "NO_RECEIPT_24H",
                                        created_at: new Date(),
                                        updated_at: new Date(),
                                        machine_id: mach.id
                                    })
                                    .transacting(trx)

                                await setNotificationTime(event.type, "NO_RECEIPT_24H" + mach.id)
                            }

                            break
                        case "MACHINE_ATTENTION_REQUIRED":

                            for (const mach of user.machines) {

                                const status = await redis.get("MACHINE_ATTENTION_REQUIRED_NOTIFICATION_" + mach.id)

                                if(status === "ERROR"){


                                    if (event.tlgrm && event.telegramChat) {
                                        user.msgT = `${user.msgT}
Автомат ${mach.name} (${mach.number}) - Не работает автомат`
                                    }
                                    if (event.email  && event.extraEmail) {
                                        user.msg = user.msg + "<br>" + "Автомат " + mach.name + " (" + mach.number + ") - Не работает автомат"
                                    }

                                }
                                else if (status === "OK"){


                                    if (event.tlgrm && event.telegramChat) {
                                        user.msgT = `${user.msgT}
Автомат ${mach.name} (${mach.number}) - Автомат работает`
                                    }
                                    if (event.email  && event.extraEmail) {
                                        user.msg = user.msg + "<br>" + "Автомат " + mach.name + " (" + mach.number + ") - Автомат работает"
                                    }

                                }
                                await redis.set("MACHINE_ATTENTION_REQUIRED_NOTIFICATION_" + mach.id, null, "EX", 24 * 60 * 60)

                            }

                            break
                        case "NO_CASHLESS_24H":

                            for (const mach of user.machines) {
                                if (!checkTime(event, "NO_CASHLESS_24H" + mach.id)) {
                                    continue
                                }
                                if(mach.terminalStatus === "OK"){
                                    continue
                                }
                                if (event.tlgrm && event.telegramChat) {

                                    user.msgT = `${user.msgT}
Автомат ${mach.name} (${mach.number}) - Нет безнала 24 часа`
                                }
                                if (event.email  && event.extraEmail) {
                                    user.msg = user.msg + "<br>" + "Автомат " + mach.name + " (" + mach.number + ") - Нет безнала 24 часа"
                                }


                                // add machine log
                                await knex("machine_logs")
                                    .insert({
                                        message: "Нет безнала 24 часа",
                                        type: "NO_CASHLESS_24H",
                                        created_at: new Date(),
                                        updated_at: new Date(),
                                        machine_id: mach.id
                                    })
                                    .transacting(trx)

                                await setNotificationTime(event.type, "NO_CASHLESS_24H" + mach.id)
                            }

                            break
                        case "NO_CASH_24H":

                            for (const mach of user.machines) {
                                if (!checkTime(event, "NO_CASH_24H" + mach.id)) {
                                    continue
                                }
                                if(mach.banknoteCollectorStatus === "OK"){
                                    continue
                                }
                                if (event.tlgrm && event.telegramChat) {

                                    user.msgT = `${user.msgT}
Автомат ${mach.name} (${mach.number}) - Нет купюр 24 часа.`
                                }
                                if (event.email  && event.extraEmail) {
                                    user.msg = user.msg + "<br>" + "Автомат " + mach.name + " (" + mach.number + ") - Нет купюр 24 часа"
                                }



                                // add machine log
                                await knex("machine_logs")
                                    .insert({
                                        message: "Нет купюр 24 часа",
                                        type: "NO_CASH_24H",
                                        created_at: new Date(),
                                        updated_at: new Date(),
                                        machine_id: mach.id
                                    })
                                    .transacting(trx)

                                await setNotificationTime(event.type, "NO_CASH_24H" + mach.id)
                            }

                            break
                        case "NO_COINS_24H":

                            for (const mach of user.machines) {
                                if (!checkTime(event, "NO_COINS_24H" + mach.id)) {
                                    continue
                                }
                                if(mach.coinCollectorStatus === "OK"){
                                    continue
                                }
                                if (event.tlgrm && event.telegramChat) {

                                    user.msgT = `${user.msgT}
Автомат ${mach.name} (${mach.number}) - Нет монет 24 часа.`
                                }
                                if (event.email  && event.extraEmail) {
                                    user.msg = user.msg + "<br>" + "Автомат " + mach.name + " (" + mach.number + ") - Нет монет 24 часа"
                                }

                                // add machine log
                                await knex("machine_logs")
                                    .insert({
                                        message: "Нет монет 24 часа",
                                        type: "NO_COINS_24H",
                                        created_at: new Date(),
                                        updated_at: new Date(),
                                        machine_id: mach.id
                                    })
                                    .transacting(trx)

                                await setNotificationTime(event.type, "NO_COINS_24H" + mach.id)
                            }

                            break
                        case "USER_LOW_BALANCE":
                            if (!checkTime(event, "user" + user.user_id)) {
                                break
                            }

                            if (user.balance < Number(process.env.USER_LOW_BALANCE) && user.balance > Number(process.env.BALANCE_LESS_100)) {
                                textBalance = `
Баланс вашего кабинета менее ${process.env.USER_LOW_BALANCE} руб.
Пополните баланс!`
                            }
                            else if(user.balance < Number(process.env.BALANCE_LESS_100) && user.balance > Number(process.env.USER_WILL_BLOCK)){
                                textBalance = `
Баланс вашего кабинета менее ${process.env.BALANCE_LESS_100} руб.
Пополните баланс, не допускайте блокировки!`
                            }
                            else if(user.balance < Number(process.env.USER_WILL_BLOCK) && user.balance > Number(process.env.BALANCE_LESS_M100)){
                                textBalance = `
Баланс вашего кабинета менее ${process.env.USER_WILL_BLOCK} руб.
Пополните баланс, не допускайте блокировки!`
                            }
                            else if(user.balance < Number(process.env.BALANCE_LESS_M100) && user.balance > Number(process.env.BALANCE_BLOCKED)){
                                textBalance = `
Баланс вашего кабинета менее ${process.env.BALANCE_LESS_M100} руб.
Пополните баланс, частично ограничен доступ к услугам!`
                            }
                            else if(user.balance < Number(process.env.BALANCE_BLOCKED)){
                                textBalance = `
Баланс вашего кабинета менее ${process.env.USER_LOW_BALANCE} руб.
Пополните баланс, работа онлайн кассы прекращена!`


                            }
                            else {
                                break
                            }
                            if (event.tlgrm && event.telegramChat) {
                                user.msgT = `${user.msgT}
${textBalance}`
                            }
                            if (event.email  && event.extraEmail) {
                                user.msg = user.msg + "<br>" + "Баланс вашего кабинета менее " + process.env.USER_LOW_BALANCE + " руб. " + textBalance
                            }
                            await setNotificationTime(event.type, "user" + user.user_id)
                            break

                        case "CONTROLLER_ENCASHMENT":

                            for (const mach of user.machines) {
                                if (mach.lastEncashment < (new Date().getTime() - 24 * 60 * 60 * 1000)) {
                                    continue
                                }
                                if (!checkTime(event, "machine" + mach.id + mach.lastEncashment)) {
                                    continue
                                }
                                if (event.tlgrm && event.telegramChat) {
                                    user.msgT = `${user.msgT}
Произведена инкассация на автомате: ${mach.name} ( ${mach.number} )`
                                }
                                if (event.email  && event.extraEmail) {
                                    user.msg = user.msg + "<br>" + "Произведена инкассация на автомате:" + mach.name + " (" + mach.number + ")"
                                }
                                await setNotificationTime(event.type, "machine" + mach.id + mach.lastEncashment)
                            }

                            break

                        case "CONTROLLER_NO_SALES":


                            for (const mach of user.machines) {

                                if (mach.lastSale > (new Date().getTime() - 24 * 60 * 60 * 1000)) {
                                    continue
                                }
                                if (!checkTime(event, "CONTROLLER_NO_SALES" + mach.id)) {
                                    continue
                                }
                                if (event.tlgrm && event.telegramChat) {
                                    user.msgT = `${user.msgT}
Автомат ${mach.name} (${mach.number}) - Нет продаж 24 часа`
                                }
                                if (event.email  && event.extraEmail) {
                                    user.msg = user.msg + "<br>" + "Автомат" + mach.name + " (" + mach.number + ") - Нет продаж 24 часа"
                                }
                                await redis.set("machine_error_" + mach.id, `NO SALES 24H`, "px", 31 * 24 * 60 * 60 * 1000)
                                await redis.set("machine_error_time_" + mach.id, `${(new Date()).getTime()}`, "px", 31 * 24 * 60 * 60 * 1000)
                                await setNotificationTime(event.type, "CONTROLLER_NO_SALES" + mach.id)
                            }


                            break
                        default:
                            break
                    }


                }
                if (user.msg) {
                    const SPBTime = (new Date().getTime() + (1000 * 60 * 60 * 3))
                    const date = new Date(SPBTime)

                    const options = {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        weekday: "long",
                        hour: "numeric",
                        minute: "numeric",
                        second: "numeric"
                    }

                    user.msg = "<br>" + (date.toLocaleString("ru", options)) + "</br><br>" + user.msg

                    await sendEmail(user.extraEmail, user.msg)
                }
                if (user.msgT) {
                    const SPBTime = (new Date().getTime() + (1000 * 60 * 60 * 3))
                    const date = new Date(SPBTime)

                    const options = {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        weekday: "long",
                        hour: "numeric",
                        minute: "numeric",
                        second: "numeric"
                    }

                    user.msgT = `
${(date.toLocaleString("ru", options))}
${user.msgT}`


                    await sendTelegram(user.telegramChat, user.msgT)
                }


            }
            logger.info(`${logDate} FINISHED check notifications job`)
        })
    }


}
