const logger = require("my-custom-logger")
const GoodlineService = require("./services/goodlineService")

module.exports = (injects) => {
    const {knex, redis} = injects


    const goodlineService = new GoodlineService(knex)
    const {goodLineAuth, resetSim, waitASec} = goodlineService

    return async () => {
        const logDate = new Date().toTimeString()
        logger.info(`started_reset_sims_job ${logDate}`)
        return knex.transaction(async (trx) => {
            const controllers = await knex("controllers")
                .transacting(trx)
                .select("machines.id as machine_id", "controller_states.registration_time", "controllers.imsi as imsi", "controllers.id as controller_id")
                .leftJoin("controller_states", "controllers.last_state_id", "controller_states.id")
                .leftJoin("machines", "machines.controller_id", "controllers.id")
                .where({
                    status: "ENABLED"
                })
            // we already have some controller states
                .whereNotNull("controller_states.registration_time")
            let token = await goodLineAuth()
            for (const controller of controllers) {

                if (!controller.machine_id || !controller.imsi) continue

                const [sale] = await knex("sales")
                    .select("created_at")
                    .where({
                        machine_id: controller.machine_id,
                    })
                    .orderBy("id", "desc")
                    .limit(1)
                    .transacting(trx)



                const now = new Date()
                const lastCommandTime = Math.max(controller.registration_time ? controller.registration_time.getTime(): null, (sale ? sale.created_at.getTime() : null))

                const expiryDate = new Date(lastCommandTime + 30 * 60 * 1000)

                if (now > expiryDate) {

                    const reset = await redis.get("jobs_sim_reset" + controller.imsi)
                    if(reset === "RESET") continue

                    const [sim] = await knex("sims")
                        .transacting(trx)
                        .select("imsi", "number")
                        .limit(1)
                        .where({
                            imsi: controller.imsi
                        })
                    if (!sim){
                        continue
                    }

                    let simInfo = await resetSim(sim.number, token)
                    await waitASec()
                    if(simInfo === false){
                        await waitASec()
                        token = await goodLineAuth()
                        simInfo = await resetSim(sim.number, token)
                    }


                    // redis set status
                    if(simInfo){
                        await redis.set("jobs_sim_reset" + controller.imsi, `RESET`)

                        // add machine log
                        await knex("machine_logs")
                            .insert({
                                message: "Выполнен сброс сим карты",
                                type: "SIM_CONTROLLER",
                                created_at: now,
                                updated_at: now,
                                machine_id: controller.machine_id
                            })
                            .transacting(trx)
                    }
                    else{
                        logger.info(`job_error_reset_sim ${sim.number}`)
                    }

                }
                else {
                    await redis.set("jobs_sim_reset" + controller.imsi, `OK`)
                }

            }

            logger.info(`finished_reset_sims_job ${logDate}`)
        })
    }

}
