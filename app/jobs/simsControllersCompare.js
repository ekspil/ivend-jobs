const logger = require("my-custom-logger")

module.exports = (injects) => {

    const {knex} = injects

    return async () => {

        await knex.transaction(async (trx) => {

            logger.info("job_sims_and_controller_compare_started")
            const controllers = await knex("controllers")
                .transacting(trx)
                .select("imsi", "imsi_terminal", "bank_terminal_mode", "id")

            for (let controller of controllers){
                if(controller.imsi){
                    await knex("sims")
                        .transacting(trx)
                        .update({
                            controller_id: controller.id
                        })
                        .where({
                            imsi: controller.imsi
                        })
                }
                if(controller.imsi_terminal){
                    await knex("sims")
                        .transacting(trx)
                        .update({
                            terminal_id: controller.id,
                            terminal: controller.bank_terminal_mode
                        })
                        .where({
                            imsi: controller.imsi_terminal
                        })
                }
            }
            logger.info("job_sims_and_controller_compare_finished")
        })

    }


}