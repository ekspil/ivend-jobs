const logger = require("my-custom-logger")
const fs = require("fs")
const path = require("path")
const GoodlineService = require("./services/goodlineService")



module.exports = (injects) => {



    const {knex} = injects
    const goodlineService = new GoodlineService(knex)
    const {waitASec, goodLineAuth, getSimInfo} = goodlineService
    return async () => {

        let token = await goodLineAuth()
        const fileAddress = path.join(__dirname, "result.txt")

        let file = await fs.readFileSync(fileAddress, "utf8")
        file = file.split("\n")
        file = file.map(item => {
            const arr = item.split(";")
            return {
                number: arr[0],
                meta: arr[1],
                imsi: arr[2]
            }
        })




        await knex.transaction(async (trx) => {

            for (let item of file){
                if(!item.imsi) continue
                const [sim] = await knex("sims")
                    .select("imsi")
                    .limit(1)
                    .where({
                        imsi: item.imsi
                    })
                if (sim){
                    continue
                }

                await knex("sims")
                    .transacting(trx)
                    .insert({
                        number: item.number,
                        imsi: item.imsi,
                        traffic: 0,
                        expense: 0
                    })

            }
            logger.info("job_sims_uploaded")
        })

        logger.info("job_sim_info_update_started")

        const sims = await knex("sims")
            .select("imsi", "number")
        
        for (let sim of sims){

            let simInfo = await getSimInfo(sim.number, token)
            if(simInfo === 0) {
                continue
            }
            if(simInfo === false){
                await waitASec()
                token = await goodLineAuth()
                simInfo = await getSimInfo(sim.number, token)
            }
            if(!simInfo) continue
            await knex("sims")
                .update({
                    expense: simInfo.cost,
                    traffic: simInfo.traffic,
                })
                .where({
                    imsi: sim.imsi
                })

        }

        logger.info("job_sim_info_updated")



    }


}