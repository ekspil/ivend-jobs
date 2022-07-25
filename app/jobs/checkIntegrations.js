const logger = require("my-custom-logger")


const VendistaService = require("./services/vendistaService")

module.exports = (injects) => {
    const {knex} = injects

    const vendistaService = new VendistaService({knex})


    return async () => {

        logger.info(`STARTED_CHECK_VENDISTA_INTEGRATION`)
        return knex.transaction(async (trx) => {



            const integrations = await knex("controller_integrations")
                .transacting(trx)
                .select("id", "type", "imei", "controller_id", "controller_uid")
                .whereNull("controller_uid")

            for (let integration of integrations){


                const terminal = await vendistaService.getTerminal(integration.imei)
                if(!terminal) continue

                const owner = await vendistaService.getOwner(terminal.owner_id)
                if(!owner) continue


                if(!terminal.bank_id){
                    const tids = await vendistaService.getTids(owner.name)
                    if(!tids.length) continue
                    const freeTid = tids.find(item => !item.terminal_ids.length)
                    if(!freeTid) continue
                    await vendistaService.putTerminal(terminal.id, freeTid.tid)

                }

                const [user] = await knex("users")
                    .transacting(trx)
                    .select("id", "inn")
                    .where("inn", owner.inn)

                if(!user) continue

                try{

                    const [newController] = await knex("controllers")
                        .transacting(trx)
                        .insert({
                            uid: "500" + String(terminal.id),
                            mode: "ps_m_D",
                            status: "ENABLED",
                            bank_terminal_mode: "vda1",
                            fiscalization_mode: "NO_FISCAL",
                            connected: true,
                            user_id: user.id,
                            created_at: new Date(),
                            updated_at: new Date(),
                        }, ["uid", "id"])


                    await knex("controller_integrations")
                        .transacting(trx)
                        .update({
                            controller_id: newController.id,
                            controller_uid: newController.uid,
                            user_id: user.id,
                            serial: terminal.serial_number
                        })
                        .where("id", integration.id)

                }
                catch (e) {
                    logger.info(e)
                    continue
                }


            }
            logger.info(`FINISHED_CHECK_VENDISTA_INTEGRATION`)


        })


    }

}
