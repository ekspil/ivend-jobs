const logger = require("my-custom-logger")

module.exports = (injects) => {
    const {knex, redis} = injects

    const getStatus = (field) => {
        //Проверку оставшихся дней после того как установлю формат
        if(!field.kktActivationDate){
            return 4
        }
        let date =new Date()
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let yearF = field.kktActivationDate.replace(/[,-/ ]/g, ".").split(".")[2]
        let monthF = field.kktActivationDate.replace(/[,-/ ]/g, ".").split(".")[1]

        if(field.kktModel === "УМКА-01-ФА (ФН36)"){


            if(year - yearF >= 3 && month - monthF <=0){
                return 5
            }
            if(Number(field.kktBillsCount) > 230000){
                return 5
            }
            if(year - yearF >= 3 && month - monthF == 1){
                return 3
            }
            if(Number(field.kktBillsCount) > 220000){
                return 3
            }
        }
        if(field.kktModel === "УМКА-01-ФА (ФН15)"){
            if(year - yearF >= 1 && month - monthF >=3){
                return 5
            }
            if(Number(field.kktBillsCount) > 230000){
                return 5
            }
            if(year - yearF >= 1 && month - monthF >=2){
                return 3
            }
            if(Number(field.kktBillsCount) > 220000){
                return 3
            }
        }
        if(field.kktLastBill){
            let da = new Date(field.kktLastBill).getTime()
            let dn = new Date()
            if (da < (dn - (1000 * 60 * 60 * 24 * 10))) {
                return 3
            }
        }




        return 0
    }

    return async () => {
        const logDate = new Date().toTimeString()
        logger.info(`${logDate} Started checking admin statistic`)
        return knex.transaction(async (trx) => {
            const controllers = await knex("controllers")
                .transacting(trx)
                .select("connected", "status", "id")
                .whereNull("deleted_at")


            const kkts = await knex("kkts")
                .transacting(trx)
                .select("kktBillsCount", "kktActivationDate",  "kktModel",  "kktLastBill", "id")

            const statisticControllers = controllers.reduce((acc, controller) => {
                acc.count++
                if(controller.status === "DISABLED"){
                    acc.disabled++
                }
                if(!controller.connected && controller.status !== "DISABLED"){
                    acc.disconnected++
                }
                return acc
            }, {
                count: 0,
                disabled: 0,
                disconnected: 0
            })

            const statisticKkts = {
                count: 0,
                normal: 0,
                error: 0
            }

            for (let kkt of kkts){
                statisticKkts.count++
                let status = await redis.get("kkt_status_" + kkt.id)
                if(status === "ERROR"){
                    statisticKkts.error++
                    continue
                }
                let kktStatus = getStatus(kkt)
                if(kktStatus === 5){
                    statisticKkts.error++
                }
                if (kktStatus < 4){
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
                    updated_at: new Date()
                })
                .andWhere("id", maxId.max)









            logger.info(` ${logDate} Finished checking admin statistic`)
        })
    }

}