const logger = require("my-custom-logger")

module.exports = (injects) => {
    const {knex, redis} = injects

    const getStatus = (field) => {
        //Проверку оставшихся дней после того как установлю формат
        if(!field.kktFNNumber && !field.kktRegNumber){
            return 0
        }
        if(field.action === "DELETE"){
            return 1
        }
        if(!field.kktActivationDate && (field.kktFNNumber  || field.kktRegNumber)){
            return 4
        }
        if(!field.kktActivationDate && field.kktOFDRegKey && (field.kktFNNumber  || field.kktRegNumber)){
            return 5
        }
        if(field.kktOFDRegKey && field.kktActivationDate && !Number(field.kktBillsCount) && (field.kktFNNumber  || field.kktRegNumber)){
            return 6
        }
        let date =new Date()
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let yearF = field.kktActivationDate.replace(/[,-/ ]/g, ".").split(".")[2]
        let monthF = field.kktActivationDate.replace(/[,-/ ]/g, ".").split(".")[1]

        if(field.kktModel === "УМКА-01-ФА (ФН36)"){


            if((year - yearF >= 3 && month - monthF >=0) || (year - yearF >= 4)){
                return 2
            }
            if(Number(field.kktBillsCount) > 249000){
                return 2
            }
            if(year - yearF >= 3 && month - monthF == 1){
                return 3
            }
            if(Number(field.kktBillsCount) > 230000){
                return 3
            }
        }
        if(field.kktModel === "УМКА-01-ФА (ФН15)"){
            if((year - yearF >= 1 && month - monthF >=3) || (year - yearF >= 2)){
                return 2
            }
            if(Number(field.kktBillsCount) > 249000){
                return 2
            }
            if(year - yearF >= 1 && month - monthF >=2){
                return 3
            }
            if(Number(field.kktBillsCount) > 230000){
                return 3
            }
        }
        if(field.kktLastBill){
            let da = new Date(field.kktLastBill).getTime()
            let dn = new Date()
            if (da < (dn - (1000 * 60 * 60 * 24 * 7))) {
                return 2
            }
            if (da < (dn - (1000 * 60 * 60 * 24 * 3))) {
                return 3
            }
        }




        return 7
    }

    return async () => {
        const logDate = new Date().toTimeString()
        logger.info(`${logDate} Started checking admin statistic`)
        return knex.transaction(async (trx) => {
            const controllers = await knex("controllers")
                .transacting(trx)
                .select("status", "id", "firmware_id")
                .whereNull("deleted_at")



            const kkts = await knex("kkts")
                .transacting(trx)
                .select("kktBillsCount", "kktActivationDate", "kktFNNumber", "kktRegNumber",  "kktModel",  "kktLastBill", "id", "status", "action", "kktOFDRegKey")
            const sims = await knex("sims")
                .transacting(trx)
                .select("traffic", "expense")

            const statisticSims = sims.reduce((acc, sim) => {
                acc.traffic += Number(sim.traffic)
                acc.expense += Number(sim.expense)

                if(Number(sim.traffic) > 0.001){
                    acc.count++
                }
                return acc

            }, {
                count: 0,
                traffic: 0,
                expense: 0,
            })


            let statisticControllers = {
                count: 0,
                disabled: 0,
                disconnected: 0
            }
            for (let controller of controllers){
                statisticControllers.count++
                if(controller.status === "DISABLED"){
                    statisticControllers.disabled++
                }
                const controllerConnected = Boolean(await redis.hget("controller_connected", controller.id))
                if(!controllerConnected && controller.status !== "DISABLED" && controller.firmware_id){
                    statisticControllers.disconnected++
                }

            }

            const statisticKkts = {
                count: 0,
                normal: 0,
                error: 0
            }

            for (let kkt of kkts){
                let kktStatus = getStatus(kkt)

                await knex("kkts")
                    .transacting(trx)
                    .update({
                        status: Number(kktStatus)
                    })
                    .where("id", kkt.id)


                statisticKkts.count++
                let status = await redis.get("kkt_status_" + kkt.id)
                if(status === "ERROR"){
                    statisticKkts.error++
                    continue
                }

                if(kktStatus <= 3 && kktStatus > 1){
                    statisticKkts.error++
                }
                if (kktStatus > 3){
                    statisticKkts.normal++
                }


            }

            const [maxId] = await knex("admin_statistics")
                .transacting(trx)
                .max("id")

            if(!maxId) return

            await knex("admin_statistics")
                .transacting(trx)
                .update({
                    controllers_count: statisticControllers.count,
                    controllers_disabled: statisticControllers.disabled,
                    controllers_disconnected: statisticControllers.disconnected,
                    kkts_count: statisticKkts.count,
                    kkts_normal: statisticKkts.normal,
                    kkts_error: statisticKkts.error,
                    sim_count: statisticSims.count,
                    sim_expense: statisticSims.expense,
                    sim_traffic: statisticSims.traffic,
                    updated_at: new Date()
                })
                .where("id", maxId.max)









            logger.info(` ${logDate} Finished checking admin statistic`)
        })
    }

}
