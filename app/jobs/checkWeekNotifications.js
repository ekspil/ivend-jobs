const {sendEmail, sendTelegram} = require("./notificationModules/utils")
const Services = require("./services/notificationServices")
const msgs = require("./notificationModules/messages")
const logger = require("my-custom-logger")

const daylyServices = [
    "GET_WEEK_SALES"
]

module.exports = (injects) => {
    const services = new Services(injects)
    const {knex} = injects
    const period = services.getPeriod("week")
    return async () =>{

        logger.info("start week notification job")
        return knex.transaction(async trx => {
            const users = await knex("users")
                .transacting(trx)
                .select("id as user_id", "phone", "email", "company_name as companyName" )

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
                const {sum, count, balance} = await services.getSalesSum(user, period, trx, true)
                const msgStart = `
${Services.ruTime("datetime")}
${user.companyName} - Баланс ${balance} руб                
                `

                for( let event of dayEvents){
                    switch(event.type){
                        case "GET_WEEK_SALES":
                            if(event.telegramChat && event.tlgrm) await sendTelegram(event.telegramChat, msgs.report(sum, "неделя", user.companyName, count))
                            if(event.extraEmail && event.email) await sendEmail(event.extraEmail, msgStart + msgs.report(sum, "неделя", user.companyName, count))
                            break
                        default:
                            break
                    }

                }


            }
        })
    }
}