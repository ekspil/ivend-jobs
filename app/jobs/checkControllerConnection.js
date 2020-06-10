const logger = require("my-custom-logger")

module.exports = (injects) => {
    const {knex, redis} = injects

    return async () => {

        logger.info(`Started checking controllers  lost connection`)
        const controllers = await knex("controllers")
            .select("machines.id as machine_id", "controller_states.registration_time", "controllers.connected as connected", "controllers.uid as uid", "controllers.id as controller_id")
            .leftJoin("controller_states", "controllers.last_state_id", "controller_states.id")
            .leftJoin("machines", "machines.controller_id", "controllers.id")
            .where({
                status: "ENABLED"
            })
            // we already have some controller states
            .whereNotNull("controller_states.registration_time")

        for (const controller of controllers) {
            await knex.transaction(async (trx) => {
                if (!controller.machine_id) {
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
                const expiryDateMonth = new Date(lastCommandTime + 30 * 24 * 60 * 60 * 1000)

                if (now > expiryDate) {
                    let check = 0
                    const update = {
                        connected: false
                    }
                    if(now > expiryDateMonth) {
                        check = 1                    

                        update.status = "DISABLED"
                    }
                    if(!controller.connected && check === 0){
                        return
                    }
                    // set connected false
                    await knex("controllers")
                        .where("id", controller.controller_id)
                        .update(update)
                        .transacting(trx)

                    // redis set status
                    await redis.set("machine_error_" + controller.machine_id, `NO CONNECTION`, "px", 24 * 60 * 60 * 1000)
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
