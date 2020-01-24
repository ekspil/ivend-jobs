const logger = require("my-custom-logger")
const fetch = require("node-fetch")
const notificationTime = {}

const setNotificationTime = async (type, item_id) => {
    if(!notificationTime[type]){
        notificationTime[type]={}
    }
    notificationTime[type][item_id] = new Date().getTime()

    return true
}

const checkTime = (event, item_id) => {
    if(notificationTime[event.type]){
        const timeExp =(new Date().getTime()) - notificationTime[event.type][item_id]
        if (timeExp < (24*60*60*1000) ){
            return false
        }
    }
    return true
}


const sendTelegram = async (chat, msg) => {
    const body = JSON.stringify({chat, msg})
    const url = `${process.env.NOTIFICATION_URL}/api/v1/template/TELEGRAM_MSG`
    const method = "POST"

    await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body
    })
}

const sendEmail = async (email, msg) => {
    const body = JSON.stringify({email, msg})
    const url = `${process.env.NOTIFICATION_URL}/api/v1/template/EMAIL_MSG`
    const method = "POST"

    await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body
    })
}



module.exports = (injects) => {



    const {knex} = injects

    return async () => {
        return knex.transaction(async (trx) => {
            logger.info("Запуск проверки нотификаций")
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
                    .where({
                        user_id: user.user_id
                    })
                const machines = await knex("machines")
                    .transacting(trx)
                    .select("id", "number", "name", "equipment_id", "user_id", "place")
                    .where({
                        user_id: user.user_id
                    })
                const [balance] = await knex("transactions")
                    .transacting(trx)
                    .sum("amount")
                    .where({
                        user_id: user.user_id
                    })
                user.notifications = notifications
                user.balance = Number(balance.sum)
                user.machines = []
                user.msg = ""
                user.msgT = ``


                for (const machine of machines) {
                    const [lastSale] = await knex("sales")
                        .transacting(trx)
                        .select("id", "machine_id", "created_at")
                        .where({
                            machine_id: machine.id
                        })
                        .orderBy("id", "desc")
                        .limit(1)

                    const [lastEncashment] = await knex("encashments")
                        .transacting(trx)
                        .select("id", "machine_id", "created_at", "timestamp")
                        .where({
                            machine_id: machine.id
                        })
                        .orderBy("id", "desc")
                        .limit(1)

                    const [lastLostConnection] = await knex("machine_logs")
                        .transacting(trx)
                        .select("message", "created_at", "type")
                        .where({
                            message: "Пропала связь",
                            type: "CONNECTION",
                            machine_id: machine.id
                        })
                        .orderBy("id", "desc")
                        .limit(1)


                    machine.lastSale = lastSale ? lastSale.created_at.getTime() : 10000000
                    machine.lastEncashment = lastEncashment ? lastEncashment.created_at.getTime() : 10000000
                    machine.lostConnection = lastLostConnection ? lastLostConnection.created_at.getTime() : 10000000
                    user.machines.push(machine)

                }

                for (const event of notifications) {

                    if (!event.email && !event.telegram) {
                        continue
                    }
                    if (!user.extraEmail && event.extraEmail) {
                        user.extraEmail = event.extraEmail
                    }
                    if (!user.telegramChat && event.telegramChat) {
                        user.telegramChat = event.telegramChat
                    }

                    switch (event.type) {
                        case "CONTROLLER_NO_CONNECTION":

                            for (const mach of user.machines) {
                                if (!checkTime(event, "machine" + mach.id + mach.lostConnection)) {
                                    continue
                                }
                                if (mach.lostConnection < (new Date().getTime() - 24 * 60 * 60 * 1000)) {
                                    continue
                                }
                                if (event.tlgrm && event.telegramChat) {

                                    user.msgT = `${user.msgT}
Нет связи с контроллером на автомате: ${mach.name} ( ${mach.number} )`
                                }
                                if (event.email  && event.extraEmail) {
                                    user.msg = user.msg + "<br>" + "Нет связи с контроллером на автомате:" + mach.name + " (" + mach.number + ")"
                                }
                                await setNotificationTime(event.type, "machine" + mach.id + mach.lostConnection)
                            }

                            break
                        case "USER_LOW_BALANCE":
                            if (!checkTime(event, "user" + user.user_id)) {
                                break
                            }
                            if (user.balance > Number(process.env.USER_LOW_BALANCE) || user.balance < Number(process.env.USER_WILL_BLOCK)) {
                                break
                            }
                            if (event.tlgrm && event.telegramChat) {
                                user.msgT = `${user.msgT}
Баланс близок к нулю`
                            }
                            if (event.email  && event.extraEmail) {
                                user.msg = user.msg + "<br>" + "Баланс близок к нулю"
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
                        case "USER_WILL_BLOCK":
                            if (user.balance > Number(process.env.USER_WILL_BLOCK)) {
                                break
                            }
                            if (!checkTime(event, "user" + user.user_id)) {
                                break
                            }
                            if (event.tlgrm && event.telegramChat) {
                                user.msgT = `${user.msgT}
Возможна блокировка по балансу`
                            }
                            if (event.email  && event.extraEmail) {
                                user.msg = user.msg + "<br>" + "Возможна блокировка по балансу"
                            }
                            await setNotificationTime(event.type, "user" + user.user_id)
                            break
                        case "CONTROLLER_NO_SALES":


                            for (const mach of user.machines) {

                                if (mach.lastSale > (new Date().getTime() - 24 * 60 * 60 * 1000)) {
                                    continue
                                }
                                if (!checkTime(event, "machine" + mach.id)) {
                                    continue
                                }
                                if (event.tlgrm && event.telegramChat) {
                                    user.msgT = `${user.msgT}
Нет продаж за последние сутки автомате: ${mach.name} ( ${mach.number} )`
                                }
                                if (event.email  && event.extraEmail) {
                                    user.msg = user.msg + "<br>" + "Не было продаж в течении суток на автомате:" + mach.name + " (" + mach.number + ")"
                                }
                                await setNotificationTime(event.type, "machine" + mach.id)
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
                    logger.info(`Sending email to ${user.extraEmail}. Message: ${user.msg}`)
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
                    logger.info(`Sending telegram to ${user.telegramChat}. Message: ${user.msgT}`)

                    await sendTelegram(user.telegramChat, user.msgT)
                }


            }
            return "Notifications sent successfully"
        })
    }


}
