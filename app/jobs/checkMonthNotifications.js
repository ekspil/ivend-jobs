const {sendEmail, sendTelegram} = require("./notificationModules/utils")
const Services = require("./services/notificationServices")
const msgs = require("./notificationModules/messages")
const logger = require("my-custom-logger")

const daylyServices = [
    "GET_MONTH_SALES"
]

module.exports = (injects) => {
    const services = new Services(injects)
    const {knex} = injects
    const period = services.getPeriod("month")
    let sum
    return async () =>{
        logger.info("start month notification job")
        return knex.transaction(async trx => {
            const users = await knex("users")
                .transacting(trx)
                .select("id as user_id", "phone", "email" )

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
                        case "GET_MONTH_SALES":
                            sum = await services.getSalesSum(user, period, trx)
                            if(event.telegramChat && event.tlgrm) await sendTelegram(event.telegramChat, msgs.report(sum, "месяц"))
                            if(event.extraEmail && event.email) await sendEmail(event.extraEmail, msgs.report(sum, "месяц"))
                            break
                        default:
                            break
                    }

                }


            }
        })
    }
}