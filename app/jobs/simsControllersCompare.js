const logger = require("my-custom-logger")

module.exports = (injects) => {

    const {knex} = injects

    return async () => {

        await knex.transaction(async (trx) => {

            logger.info("job_sims_and_controller_compare_started")
            const controllers = await knex("controllers")
                .transacting(trx)
                .select("imsi", "imsi_terminal", "bank_terminal_mode", "controllers.id as id", "controllers.uid as uid", "controllers.user_id as user_id", "users.company_name as company_name")
                .leftJoin("users", "users.id", "controllers.user_id")

            for (let controller of controllers){

                if(controller.imsi){
                    const [updatedSim] = await knex("sims")
                        .transacting(trx)
                        .update({
                            controller_id: controller.id,
                            controller_uid: controller.uid,
                            user_id: Number(controller.user_id),
                            user_name: controller.company_name,
                        }, ["number", "id"] )
                        .where({
                            imsi: controller.imsi.replace(/\D/g,"")
                        })

                    await knex("controllers")
                        .transacting(trx)
                        .update({
                            sim: updatedSim.number,
                        })
                        .where({
                            id: controller.id
                        })

                }
                if(controller.imsi_terminal){
                    await knex("sims")
                        .transacting(trx)
                        .update({
                            terminal_id: controller.id,
                            controller_uid: controller.uid,
                            terminal: controller.bank_terminal_mode,
                            user_id: Number(controller.user_id),
                            user_name: controller.company_name
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