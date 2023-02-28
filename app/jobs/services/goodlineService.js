const logger = require("my-custom-logger")
const fetch = require("node-fetch")


class Services {
    constructor({knex}) {
        this.knex = knex
        this.waitASec = this.waitASec.bind(this)
        this.goodLineAuth = this.goodLineAuth.bind(this)
        this.getSimInfo = this.getSimInfo.bind(this)
        this.resetSim = this.resetSim.bind(this)
        this.getNewsData = this.getNewsData.bind(this)
        this.successNewsMassage = this.successNewsMassage.bind(this)
    }

    async waitASec(time) {
        return new Promise((resolve => {
            setTimeout(() => {
                resolve()
            }, time || 1000)
        }))
    }

    async goodLineAuth() {
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

    async getSimInfo(sim, token) {
        const dateEnd = new Date()
        dateEnd.setDate(0)
        const dateStart = new Date()
        dateStart.setDate(1)
        dateStart.setMonth(dateStart.getMonth() - 1)




        const url = `https://api.m2m.express/api/v2/simcards/${sim}/cdr?date_from=${dateStart.toISOString().split("T")[0]}&date_to=${dateEnd.toISOString().split("T")[0]}`
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

    async getNewsData(task){

        const users = await this.knex("users")
            .select("id", "country_code as countryCode", "phone", "email")
            .whereIn("role", ["VENDOR", "PARTNER"])

        if(!users){
            throw new Error("Users table is null")
        }

        const [news] = await this.knex("news")
            .select("id", "text", )
            .where("id", task.target_id)
            .limit(1)

        if(!news){
            throw new Error("News not found")
        }

        return {news, users}

    }

    async successNewsMassage(task){

        await this.knex("long_tasks")
            .where("id", task.id)
            .update({
                status: "DONE",
                updated_at: new Date()
            })
        return true

    }

    async resetSim(sim, token) {

        try{
            const url = `https://api.m2m.express/api/v2/simcards/${sim}/cancelLocation`
            const method = "POST"

            const response = await fetch(url, {
                method,
                headers: {
                    "Accept": "application/json",
                    "Authorization": "Bearer " + token
                },
            })

            switch (response.status) {
                case 200: {
                    return true
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

}

module.exports = Services