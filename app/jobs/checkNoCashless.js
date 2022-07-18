const logger = require("my-custom-logger")

module.exports = (injects) => {
    const {knex, redis} = injects


    return async () => {

        logger.info(`STARTED_NO_CASHLESS_CHECK`)
        return knex.transaction(async (trx) => {

            const controllers = await knex("controllers")
                .transacting(trx)
                .select("id",  "uid", "cashless")
                .whereNotNull("cashless")

            for (let controller of controllers){

                const lastCashless = await redis.get("machine_cashless_" + controller.id)

                const update = {}
                if(!lastCashless){
                    update.cashless = null
                }
                else {
                    continue
                }

                await knex("controllers")
                    .where("id", controller.id)
                    .update(update)
                    .transacting(trx)



            }
            logger.info(`FINISHED_NO_CASHLESS_CHECK`)


        })


    }

}
