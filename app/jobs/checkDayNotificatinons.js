const {sendEmail, sendTelegram} = require("./notificationModules/utils")
const Services = require("./app/jobs/services/notificationServices")

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
                        case "GET_DAY_SALES":
                            sum = await services.getSalesSum(user, period)
                            if(event.telegramChat && event.tlgrm) sendTelegram()
                            if(event.extraEmail && event.email) sendEmail()
                            break
                        case "GET_NEWS":
                            if(event.telegramChat && event.tlgrm) sendTelegram()
                            if(event.extraEmail && event.email) sendEmail()
                            break
                        default:
                            break
                    }

                }


            }
        })
    }
}