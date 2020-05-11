class Services {
    constructor({knex, redis}) {
        this.knex = knex
        this.redis = redis
        this.getSalesSum = this.getSalesSum.bind(this)
    }
    async getSalesSum(user, period){
        return this.knex.transaction(async trx => {
            const machines = await this.knex("machines")
                .transacting(trx)
                .where("user_id", user.id)
                .select("id")
            const machineNumbers = machines.map(machine => machine.id)
            const allSales = await this.knex("sales")
                .transacting(trx)
                .select("type", "price", "created_at", "machine_id")
                .whereIn("machine_id", machineNumbers)
                .andWhere(function(){
                    this.where("created_at", ">", period.from).andWhere("created_at", "<", period.to)
                })
            return allSales.reduce((acc, item)=>{
                return acc + item.price
            }, 0)
        })



    }
    async getLastNews(){
        return this.knex.transaction(async trx => {
            const news = await this.knex("news")
                .transacting(trx)
                .where("new", 0)
                .andWhere("active", 1)
                .select("id", "text", "header")

            const ids = news.map(item => item.id)

            await this.knex("news")
                .transacting(trx)
                .whereIn("id", ids)
                .update({
                    new: 0
                })

            return news.reduce((acc, n) => {
                acc.tlgrm =  acc.tlgrm + `
${n.header}
${n.text}
---------------
                   
                   `
                acc.mail = acc.mail + `
<h2>${n.header}</h2>
<p>${n.text}</p>
<br><br>`
            }, {tlgrm: ``, mail: ``})
        })
        
    }
    getPeriod(value){    
        const period = {}
        let date = new Date()
        switch(value){
            case "day":
                date.setDate(date.getDate() - 1)
                date.setHours(0, 0, 0, 0)
                period.from = date.getTime()
                date.setHours(23, 59, 59, 0)
                period.to = date.getTime()
                break
            case "week":
                date.setDate(date.getDate() - 7)
                date.setHours(0, 0, 0, 0)
                period.from = date.getTime()
                date.setDate(date.getDate() + 6)
                date.setHours(23, 59, 59, 0)
                period.to = date.getTime()
                break
            case "month":
                date.setMonth(date.getMonth() - 1)
                date.setHours(0, 0, 0, 0)
                period.from = date.getTime()
                date.setMonth(date.getMonth() + 1)
                date.setHours(0, 0, 0, 0)
                period.to = date.getTime()
                break

        }
        return period

    }

}

module.exports = Services