const logger = require("my-custom-logger")
const GoodlineService = require("./services/goodlineService")
const {sendTextSMS, sendTextEmail} = require("./notificationModules/utils")


module.exports = (injects) => {
    const {knex, redis} = injects

    const goodlineService = new GoodlineService({knex})
    const {waitASec, getNewsData, successNewsMassage} = goodlineService

    return async () => {
        logger.info("started_long_job_process")

        const tasks = await knex("long_tasks")
            .select("id", "type", "status", "target_id")
            .where("status", "WAITING")
            .orderBy("id", "DESC")


        for( let task of tasks){




            if(task.type === "NEWS_SMSING"){

                const {news, users} = await getNewsData(task)

                let text = news.text.replace( /(<([^>]+)>)/ig, `
` )
                const counter = {all: users.length, success: 0, error: 0}
                for(let us of users){
                    
                    if(!us.countryCode) us.countryCode = "7"
                    const tel = us.countryCode + us.phone
                    try {
                        await sendTextSMS(tel, text)
                        counter.success++
                    }
                    catch (e) {
                        counter.error++
                        logger.info("JOBS_LONG_PROCESSES " + e.message)
                    }
                    await redis.hset("JOBS_LONG_PROCESSES_NEWS_SMSING_STATUS", task.target_id, JSON.stringify(counter))
                    await waitASec(1000)

                }
                await successNewsMassage(task)
                continue

            }
            if(task.type === "NEWS_MAILING"){

                const {news, users} = await getNewsData(task)

                const counter = {all: users.length, success: 0, error: 0}
                for(let us of users){


                    try {
                        await sendTextEmail(us.email, news.text)
                        counter.success++
                    }
                    catch (e) {
                        counter.error++
                        logger.info("JOBS_LONG_PROCESSES " + e.message)
                    }
                    await redis.hset("JOBS_LONG_PROCESSES_NEWS_MAILING_STATUS", task.target_id, JSON.stringify(counter))
                    await waitASec(5000)

                }

                await successNewsMassage(task)
                continue

            }
        }
    }
}
