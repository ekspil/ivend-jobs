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
        let sum

        const period = services.getPeriod("day")
        const logDate = new Date().toTimeString()
        logger.info(`${logDate} STARTED Day notification job`)
        return knex.transaction(async (trx) => {
            const users = await knex("users")
                .transacting(trx)
                .select("id as user_id", "phone", "email", "company_name as companyName" )
            const news = await services.getLastNews(trx)
            let listOfAll = ``
            for (let user of users){

                const dayEvents = await knex("notification_settings")
                    .transacting(trx)
                    .select("type", "email", "tlgrm", "extraEmail", "telegramChat")
                    .whereIn("type", daylyServices)
                    .andWhere("user_id", user.user_id)
                    .andWhere(function(){
                        this.where("email", true).orWhere("tlgrm", true)
                    })
                if(!dayEvents || dayEvents.length === 0) continue
                listOfAll += `
${user.email}:
`
                for( let event of dayEvents){
                    listOfAll += `${event.type},
`

                    let mail = event.extraEmail || user.email
                    switch(event.type){
                        case "GET_DAY_SALES":
                            sum = await services.getSalesSum(user, period, trx, true)
                            let msg = msgs.report(sum, "день", user.companyName)
                            if(event.telegramChat && event.tlgrm) await sendTelegram(event.telegramChat, msg)
                            if(mail && event.email) await sendEmail(event.extraEmail, msg)
                            break
                        case "GET_NEWS":
                            if (news.mail === "") break
                            if(event.telegramChat && event.tlgrm) await sendTelegram(event.telegramChat, news.tlgrm)
                            if(mail && event.email) await sendEmail(event.extraEmail, news.mail)
                            break
                        default:
                            break
                    }

                }



            }
            logger.info(`${logDate} FINISHED Day notification job`)
            logger.info(listOfAll)
        })

    }
}