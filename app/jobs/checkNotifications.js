const logger = require("my-custom-logger")
const fetch = require("node-fetch")
const notificationTime = {}

const setNotificationTime = async (type, item_id) => {
    notificationTime[type]= {
        [item_id]: new Date().getTime()
    }
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
    logger.info(`Попытка отправить сообщение(${msg}) в чат: ${chat}`)
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
        logger.info("Запуск проверки нотификаций")
        const users = await knex("users")
            .select("email", "phone", "id as user_id")
            .where({
                role: "VENDOR"
            })


        for(const user of users){

            const notifications = await knex("notification_settings")
                .select("id", "type", "email", "sms", "telegram", "telegramChat")
                .where({
                    user_id: user.user_id
                })
            const machines = await knex("machines")
                .select("id", "number", "name", "equipment_id", "user_id", "place")
                .where({
                    user_id: user.user_id
                })
            const [balance] = await knex("transactions")
                .sum("amount")
                .where({
                    user_id: user.user_id
                })
            user.notifications = notifications
            user.balance = Number(balance.sum)
            user.machines = []



            for( const machine of machines){
                const [lastSale] = await knex("sales")
                    .select("id", "machine_id", "created_at")
                    .where({
                        machine_id: machine.id
                    })
                    .orderBy("id", "desc")
                    .limit(1)

                const [lastEncashment] = await knex("encashments")
                    .select("id", "machine_id", "created_at", "timestamp")
                    .where({
                        machine_id: machine.id
                    })
                    .orderBy("id", "desc")
                    .limit(1)

                const [lastLostConnection] = await knex("machine_logs")
                    .select("message", "created_at", "type")
                    .where({
                        message: "Пропала связь",
                        type: "CONNECTION",
                        machine_id: machine.id
                    })
                    .orderBy("id", "desc")
                    .limit(1)


                machine.lastSale =lastSale ? lastSale.created_at.getTime() : 10000000
                machine.lastEncashment =lastEncashment ? lastEncashment.created_at.getTime() : 10000000
                machine.lostConnection = lastLostConnection ? lastLostConnection.created_at.getTime() : 10000000
                user.machines.push(machine)

            }

            for(const event of notifications){

                if(!event.email && !event.telegram){
                    continue
                }

                switch (event.type){
                    case "CONTROLLER_NO_CONNECTION":

                        for (const mach of user.machines ){
                            if(!checkTime(event, "machine"+mach.id)){break}
                            if(mach.lostConnection > (new Date().getTime() - 24*60*60*1000)){break}
                            logger.info(`found CONTROLLER_NO_CONNECTION for ${user.email}`)
                            if(event.telegram && event.telegramChat){
                                await sendTelegram(event.telegramChat, "Нет связи с контроллером на автомате:" + mach.number)
                            }
                            if(event.email){
                                await sendEmail(user.email, "Нет связи с контроллером на автомате:" + mach.number)
                            }
                            await setNotificationTime(event.type, "machine"+mach.id)
                        }

                        break
                    case "USER_LOW_BALANCE":
                        if(!checkTime(event, user)){break}
                        if(user.balance > Number(process.env.USER_LOW_BALANCE)){break}
                        logger.info(`found USER_LOW_BALANCE for ${user.email}`)
                        if(event.telegram && event.telegramChat){
                            await sendTelegram(event.telegramChat, "Баланс близок к нулю")
                        }
                        if(event.email){
                            await sendEmail(user.email, "Баланс близок к нулю")
                        }
                        await setNotificationTime(event.type, user.user_id)
                        break
                    case "CONTROLLER_ENCASHMENT":

                        for (const mach of user.machines ){
                            if(mach.lastEncashment > (new Date().getTime() - 24*60*60*1000)){break}
                            if(!checkTime(event, "machine"+mach.id)){break}
                            logger.info(`found CONTROLLER_ENCASHMENT for ${user.email}`)
                            if(event.telegram && event.telegramChat){
                                await sendTelegram(event.telegramChat, "Произведена инкассация на автомате:" + mach.number)
                            }
                            if(event.email){
                                await sendEmail(user.email, "Произведена инкассация на автомате:" + mach.number)
                            }
                            await setNotificationTime(event.type, "machine"+mach.id)
                        }

                        break
                    case "USER_WILL_BLOCK":
                        if(user.balance > Number(process.env.USER_WILL_BLOCK)){break}
                        if(!checkTime(event, user)){break}
                        logger.info(`found USER_WILL_BLOCK for ${user.email}`)
                        if(event.telegram && event.telegramChat){
                            await sendTelegram(event.telegramChat, "Возможна блокировка по балансу")
                        }
                        if(event.email){
                            await sendEmail(user.email, "Возможна блокировка по балансу")
                        }
                        await setNotificationTime(event.type, user.user_id)
                        break
                    case "CONTROLLER_NO_SALES":


                        for (const mach of user.machines ){

                            if(mach.lastSale < (new Date().getTime() - 24*60*60*1000)){break}
                            if(!checkTime(event, "machine"+mach.id)){break}
                            logger.info(`found CONTROLLER_NO_SALES for ${user.email}`)
                            if(event.telegram && event.telegramChat){
                                await sendTelegram(event.telegramChat, "Не было продаж в течении суток на автомате:" + mach.number)
                            }
                            if(event.email){
                                await sendEmail(user.email, "Не было продаж в течении суток на автомате:" + mach.number)
                            }
                            await setNotificationTime(event.type, "machine"+mach.id)
                        }



                        break
                    default: break
                }



            }




        }
        return "Notifications sent successfully"
    }

}
