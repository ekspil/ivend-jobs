const logger = require("my-custom-logger")

module.exports = (injects) => {

    const {knex} = injects

    return async () => {

        await knex.transaction(async (trx) => {

            logger.info("job_sims_and_controller_compare_started")
            const controllers = await knex("controllers")
                .transacting(trx)
                .select("imsi", "imsi_terminal", "bank_terminal_mode", "id", "uid")

            for (let controller of controllers){
                if(controller.imsi){
                    await knex("sims")
                        .transacting(trx)
                        .update({
                            controller_id: controller.id,
                            controller_uid: controller.uid,
                        })
                        .where({
                            imsi: controller.imsi.replace(/\D/g,"")
                        })
                }
                if(controller.imsi_terminal){
                    await knex("sims")
                        .transacting(trx)
                        .update({
                            terminal_id: controller.id,
                            controller_uid: controller.uid,
                            terminal: controller.bank_terminal_mode
                        })
                        .where({
                            imsi: controller.imsi_terminal.replace(/\D/g,"")
                        })
                }
            }
            logger.info("job_sims_and_controller_compare_finished")
        })

    }


}