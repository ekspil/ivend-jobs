const {sendEmail, sendTelegram} = require("./notificationModules/utils")

const Services = require("./services/notificationServices")
const msgs = require("./notificationModules/messages")
const logger = require("my-custom-logger")

const daylyServices = [
    "GET_DAY_SALES",
    "GET_NEWS"
]

module.exports = (injects) => {
    const services = new Services(injects)
    const {knex} = injects



    return async () =>{


        const logDate = new Date().toTimeString()
        logger.info(`${logDate} STARTED Day notification job`)
        return knex.transaction(async (trx) => {
            const period = services.getPeriod("day")
            const users = await knex("users")
                .transacting(trx)
                .select("id as user_id", "phone", "email", "company_name as companyName" )
                .whereIn("role", ["VENDOR", "PARTNER", "VENDOR_NEGATIVE_BALANCE", "ADMIN"])

            const news = await services.getLastNews(trx)
            let listOfAll = ``
            for (let user of users){
                try  {

                    const dayEvents = await knex("notification_settings")
                        .transacting(trx)
                        .select("type", "email", "tlgrm", "extraEmail", "telegramChat")
                        .whereIn("type", daylyServices)
                        .andWhere("user_id", user.user_id)
                        .andWhere(function(){
                            this.where("email", true).orWhere("tlgrm", true)
                        })

                    if(!dayEvents || dayEvents.length === 0) continue
                    const {sum, count, balance} = await services.getSalesSum(user, period, trx, true)
                    const msgStart = `
${services.ruTime("datetime")}
${user.companyName} - Баланс ${balance} руб                
                `

                    // Проверка блокировки раз в сутки
                    if(balance > -1000 && balance <= -100) {
                        let msg = `
Баланс вашего кабинета меньше -100 руб. 
Пополните баланс!
`
                        await sendEmail(user.email, msgStart + msg, balance)

                    }
                    if(balance > -2000 && balance <= -1000) {
                        let msg = `
Баланс вашего кабинета меньше -1000 руб. 
Пополните баланс, терминал отключен!
`
                        await sendEmail(user.email, msgStart + msg, balance)

                    }
                    if(balance > -4000 && balance <= -2000) {
                        let msg = `
Баланс вашего кабинета меньше -2000 руб. 
Пополните баланс, работа онлайн кассы прекращена!
`
                        await sendEmail(user.email, msgStart + msg, balance)

                    }
                    if(balance < -4000) {
                        let msg = `
Баланс вашего кабинета меньше -4000 руб. 
Пополните баланс, касса будет снята с регистрационного учета!
`
                        await sendEmail(user.email, msgStart + msg, balance)

                    }



                    listOfAll += `
${user.email}:
`
                    for( let event of dayEvents){
                        listOfAll += `${event.type},
`
                        let msg = ""
                        let mail = event.extraEmail || user.email
                        switch(event.type){
                            case "GET_DAY_SALES":

                                msg = msgs.report(sum, "день", user.companyName, count, balance)
                                if(event.telegramChat && event.tlgrm) await sendTelegram(event.telegramChat, msg)
                                if(mail && event.email) await sendEmail(mail, msgStart + msg)
                                break
                            case "GET_NEWS":
                                if (news.mail === "") break
                                if(event.telegramChat && event.tlgrm) await sendTelegram(event.telegramChat, news.tlgrm)
                                if(mail && event.email) await sendEmail(mail, msgStart + news.mail)
                                break
                            default:
                                break
                        }

                    }


                }
                catch (e) {
                    logger.error("day_notification_error_info_" + e.message)
                }

            }
            logger.info(`${logDate} FINISHED Day notification job`)
            logger.info("LIST_OFF_ALL " +  listOfAll)
        })

    }
}