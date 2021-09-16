class Services {
    constructor({knex, redis}) {
        this.knex = knex
        this.redis = redis
        this.getSalesSum = this.getSalesSum.bind(this)
        this.ruTime = this.ruTime.bind(this)
    }


    ruTime(format = "date") {
        const options = {}
        if (format.includes("date")) {
            options.day = "2-digit"
            options.month = "2-digit"
            options.year = "numeric"
        }
        if (format.includes("time")) {
            options.hour = "2-digit"
            options.minute = "2-digit"
            options.hourCycle = "h24"
        }
        if (format.includes("order")) {
            options.minute = "2-digit"
            options.second = "2-digit"
        }

        return new Intl.DateTimeFormat("ru-RU", options).format(new Date())
    }
    async getSalesSum(user, period, trx, fastYesterday){
        if(fastYesterday){
            const [temp] = await this.knex("temps")
                .transacting(trx)
                .where("user_id", user.user_id)
                .select("amount_yesterday", "user_id", "count_yesterday", "amount")
            if(!temp){
                return {sum: 0, count: 0, balance: 0}
            }
            return {sum: Number(temp.amount_yesterday), count: Number(temp.count_yesterday), balance: Number(temp.amount)}
        }
        const machines = await this.knex("machines")
            .transacting(trx)
            .where("user_id", user.user_id)
            .select("id")
        const machineNumbers = machines.map(machine => machine.id)
        const allSales = await this.knex("sales")
            .transacting(trx)
            .select("type", "price", "created_at", "machine_id")
            .whereIn("machine_id", machineNumbers)
            .andWhere(function(){
                this.where("created_at", ">", new Date(period.from)).andWhere("created_at", "<", new Date(period.to))
            })
        let sum = allSales.reduce((acc, item)=>{
            return Number(acc) + Number(item.price)
        }, 0)
        let count = allSales.length
        return {sum, count}

    }
    async getLastNews(trx){
        const news = await this.knex("news")
            .transacting(trx)
            .where("new", 1)
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
            return acc
        }, {tlgrm: ``, mail: ``})
     
        
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