const {sendEmail, sendTelegram} = require("./notificationModules/utils")
const Services = require("./app/jobs/services/notificationServices")
const msgs = require("./notificationModules/messages")

const daylyServices = [
    "GET_WEEK_SALES"
]

module.exports = (injects) => {
    const services = new Services(injects)
    const {knex} = injects
    const period = services.getPeriod("week")
    let sum
    return async () =>{
        return knex.transacting(async trx => {
            const users = await knex("users")
                .transacting(trx)
                .select("id as user_id", "phone", "email" )

            for (let user of users){
                const dayEvents = await knex("notification_settings")
                    .transaction(trx)
                    .select("type", "email", "tlgrm", "extraEmail", "telegramChat")
                    .whereIn("type", daylyServices)
                    .andWhere("user_id", user.id)
                    .andWhere(function(){
                        this.where("email", true).orWhere("tlgrm", true)
                    })
                if(!dayEvents) continue

                for( let event of dayEvents){
                    switch(event.type){
                        case "GET_WEEK_SALES":
                            sum = await services.getSalesSum(user, period)
                            if(event.telegramChat && event.tlgrm) await sendTelegram(event.telegramChat, msgs.report(sum, "неделя"))
                            if(event.extraEmail && event.email) await sendEmail(event.extraEmail, msgs.report(sum, "неделя"))
                            break
                        default:
                            break
                    }

                }


            }
        })
    }
}