const logger = require("my-custom-logger")
const fs = require("fs")
const path = require("path")


module.exports = (injects) => {



    const {knex, redis} = injects

    return async () => {
        const fileAddress = path.join(__dirname, "result.txt")

        let file = await fs.readFileSync(fileAddress, "utf8")
        file = file.split("\r\n")
        file = file.map(item => {
            const arr = item.split(";")
            return {
                number: arr[0],
                meta: arr[1],
                imsi: arr[2]
            }
        })




        return knex.transaction(async (trx) => {

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
                    })
            }
        })
    }


}