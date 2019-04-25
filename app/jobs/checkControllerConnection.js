const logger = require("../utils/logger")

module.exports = (injects) => {
    const {knex} = injects

    return async () => {
        const controllers = await knex("controllers")
            .select("machines.id as machine_id", "controller_states.registration_time", "controllers.connected as connected", "controllers.uid as uid", "controllers.id as controller_id")
            .leftJoin("controller_states", "controllers.last_state_id", "controller_states.id")
            .leftJoin("machines", "machines.controller_id", "controllers.id")
            .where({
                status: "ENABLED",
                connected: true
            })
            // we already have some controller states
            .whereNotNull("controller_states.registration_time")


        for (const controller of controllers) {
            logger.info(`Checking connection of controller ${controller.uid}`)
            await knex.transaction(async (trx) => {
                if (!controller.machine_id) {
                    logger.warning(`Controller ${controller.uid} does not have applied machine, cannot check status`)
                    return
                }

                const [sale] = await knex("sales")
                    .where({
                        machine_id: controller.machine_id,
                    })
                    .orderBy("id", "desc")
                    .limit(1)
                    .transacting(trx)

                const now = new Date()
                const lastCommandTime = Math.max(controller.registration_time.getTime(), (sale ? sale.created_at.getTime() : null))

                const expiryDate = new Date(lastCommandTime + Number(process.env.CONTROLLER_CONNECTION_TIMEOUT_MINUTES) * 60 * 1000)

                if (now > expiryDate) {
                    logger.info(`Controller ${controller.uid} lost connection`)

                    // set connected false
                    await knex("controllers")
                        .where("id", controller.controller_id)
                        .update({
                            connected: false
                        })
                        .transacting(trx)

                    // add machinelog
                    await knex("machine_logs")
                        .insert({
                            message: "Пропала связь",
                            type: "CONNECTION",
                            created_at: now,
                            updated_at: now,
                            machine_id: controller.machine_id
                        })
                        .transacting(trx)
                }

            })
        }
    }

}
