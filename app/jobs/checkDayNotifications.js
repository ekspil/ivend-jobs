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
    const period = services.getPeriod("day")
    let sum

    return async () =>{
        logger.info("day notification job started")
        return knex.transaction(async (trx) => {
            const users = await knex("users")
                .transacting(trx)
                .select("id as user_id", "phone", "email" )
            const news = await services.getLastNews(trx)
            for (let user of users){
                const dayEvents = await knex("notification_settings")
                    .transacting(trx)
                    .select("type", "email", "tlgrm", "extraEmail", "telegramChat")
                    .whereIn("type", daylyServices)
                    .andWhere("user_id", user.user_id)
                    .andWhere(function(){
                        this.where("email", true).orWhere("tlgrm", true)
                    })
                if(!dayEvents) continue

                for( let event of dayEvents){
                    switch(event.type){
                        case "GET_DAY_SALES":
                            sum = await services.getSalesSum(user, period, trx)
                            if(event.telegramChat && event.tlgrm) await sendTelegram(event.telegramChat, msgs.report(sum, "день"))
                            if(event.extraEmail && event.email) await sendEmail(event.extraEmail, msgs.report(sum, "день"))
                            break
                        case "GET_NEWS":
                            if(event.telegramChat && event.tlgrm) await sendTelegram(event.telegramChat, news.tlgrm)
                            if(event.extraEmail && event.email) await sendEmail(event.extraEmail, news.mail)
                            break
                        default:
                            break
                    }

                }



            }
            logger.info("day notification job success")
        })

    }
}