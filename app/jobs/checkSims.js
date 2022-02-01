const logger = require("my-custom-logger")
const fs = require("fs")
const path = require("path")
const fetch = require("node-fetch")

const waitASec = async (time) => {
    return new Promise((resolve => {
        setTimeout(() => {
            resolve()
        }, time || 1000)
    }))
}

const goodLineAuth = async () => {
    const login = process.env.GOODLINE_LOGIN || "api-info@ivend.pro"
    const pass = process.env.GOODLINE_PASS || "95aYfVAWRTG4Uh4b"
    const url = `https://api.m2m.express/api/v2/login?email=${login}&password=${pass}`
    const method = "POST"

    const response = await fetch(url, {
        method,
        headers: {
            "Accept": "application/json"
        }
    })

    switch (response.status) {
        case 200: {
            const json = await response.json()
            return json.access_token
        }
        default:
            throw new Error("GOODLINE_NOT_AUTHENTICATED")
    }

}

const getSimInfo = async (sim, token) => {
    const date = new Date().getTime()

    const url = `https://api.m2m.express/api/v2/simcards/${sim}/cdr?date_from=${new Date(date - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}&date_to=${new Date().toISOString().split("T")[0]}`
    const method = "GET"
    try{
        const response = await fetch(url, {
            method,
            headers: {
                "Accept": "application/json",
                "Authorization": "Bearer " + token
            },
        })

        switch (response.status) {
            case 200: {
                const json = await response.json()
                if(json.internet.length > 0){
                    return json.internet.reduce((acc, item) => {
                        return {
                            traffic: acc.traffic + Number(item.traffic_value),
                            cost: acc.cost + Number(item.cost)
                        }
                    }, {cost: 0, traffic: 0})

                }
                else {
                    return 0
                }

            }
            default:
                return false
        }
    }
    catch (e) {
        logger.error(`job_sims_goodline_fetch_error ${e.message}`)
        return false
    }


}





module.exports = (injects) => {



    const {knex} = injects

    return async () => {

        let token = await goodLineAuth()
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