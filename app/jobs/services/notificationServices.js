const logger = require("my-custom-logger")
const {sendEmail, sendTelegram} = require("../notificationModules/utils")

class Services {
    constructor({knex, redis}) {
        this.knex = knex
        this.redis = redis
        this.getSalesSum = this.getSalesSum.bind(this)
        this.ruTime = this.ruTime.bind(this)
        this.setNotificationTime = this.setNotificationTime.bind(this)
        this.checkTime = this.checkTime.bind(this)
        this.prepareAndSendMessage = this.prepareAndSendMessage.bind(this)
        this.existEventTarget = this.existEventTarget.bind(this)
        this.generateMachineBaseData = this.generateMachineBaseData.bind(this)
        this.getUserNotificationType = this.getUserNotificationType.bind(this)
        this.getUserMachines = this.getUserMachines.bind(this)
        this.getUserBalance = this.getUserBalance.bind(this)
        this.setMachineLog = this.setMachineLog.bind(this)
        this.generateMachineMessages = this.generateMachineMessages.bind(this)
        this.generateBalanceMessage = this.generateBalanceMessage.bind(this)
        this.getLastNews = this.getLastNews.bind(this)
    }

    async setControllerError(mach){
        try{

            await this.redis.set("machine_error_" + mach.id, `NO SALES 24H`, "px", 31 * 24 * 60 * 60 * 1000)
            await this.redis.set("machine_error_time_" + mach.id, `${(new Date()).getTime()}`, "px", 31 * 24 * 60 * 60 * 1000)
        }
        catch (e) {
            logger.info("NOTIFICATIONS_REDIS_SET_ERROR")
        }
    }
    
    async getUsers(trx){
        try{

            return this.knex("users")
                .transacting(trx)
                .select("email", "phone", "id as user_id")
                .whereNot("role", "CLOSED")
        }
        catch (e) {
            logger.info("NOTIFICATIONS_USER_GET_ERROR")
            return []
        }
    }

    async setNotificationTime(type, item_id, time){
        await this.redis.set(`NOTIFICATION_TIME_${type}_${item_id}`, new Date().getTime(), "EX", time || 24 * 60 * 60)
        return true
    }
    async delNotificationTime(type, item_id){
        await this.redis.del(`NOTIFICATION_TIME_${type}_${item_id}`)
        return true
    }

    async checkTime(event, item_id){
        const time = await this.redis.get(`NOTIFICATION_TIME_${event.type}_${item_id}`)
        if(time){
            return false
            
        }
        return true
    }

    async prepareAndSendMessage(user){
        if (user.msg) {
            const SPBTime = (new Date().getTime() + (1000 * 60 * 60 * 3))
            const date = new Date(SPBTime)

            const options = {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
                hour: "numeric",
                minute: "numeric",
                second: "numeric"
            }

            user.msg = "<br>" + (date.toLocaleString("ru", options)) + "</br><br>" + user.msg

            await sendEmail(user.extraEmail, user.msg)
        }
        if (user.msgT) {
            const SPBTime = (new Date().getTime() + (1000 * 60 * 60 * 3))
            const date = new Date(SPBTime)

            const options = {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
                hour: "numeric",
                minute: "numeric",
                second: "numeric"
            }

            user.msgT = `
${(date.toLocaleString("ru", options))}
${user.msgT}`


            await sendTelegram(user.telegramChat, user.msgT)
        }

    }

    existEventTarget(user, event){
        if (!event.email && !event.tlgrm) {
            return false
        }
        if (!user.extraEmail && event.extraEmail) {
            user.extraEmail = event.extraEmail

        }
        if (!user.telegramChat && event.telegramChat) {
            user.telegramChat = event.telegramChat
        }
        return true

    }
    
    async generateMachineBaseData(user, machines, notifications, balance){


        user.notifications = notifications
        user.balance = Number(balance.sum)
        user.machines = []
        user.msg = ""
        user.msgT = ""


        for (const machine of machines) {

            const redisSale = await this.redis.get("machine_last_sale_" + machine.id)
            const lastSale = {
                created_at: new Date(redisSale)
            }

            const redisEncash = await this.redis.get("machine_encashment_" + machine.id)
            const lastEncashment = {
                created_at: new Date(redisEncash),
                timestamp: new Date(redisEncash),
            }


            const redisLostCon = await this.redis.get("machine_error_time_" + machine.id)
            const lastLostConnection = {
                created_at: new Date(Number(redisLostCon)),
            }


            machine.lastSale = lastSale ? lastSale.created_at.getTime() : 10000000
            machine.lastEncashment = lastEncashment ? lastEncashment.created_at.getTime() : 10000000
            machine.lostConnection = lastLostConnection ? lastLostConnection.created_at.getTime() : 10000000

            machine.kktStatus = await this.redis.get("kkt_status_" + machine.id)
            machine.terminalStatus = await this.redis.get("terminal_status_" + machine.id)
            machine.banknoteCollectorStatus = await this.redis.get("machine_banknote_collector_status_" + machine.id)
            machine.coinCollectorStatus = await this.redis.get("machine_coin_collector_status_" + machine.id)

            machine.connectionBack = await this.redis.get("controller_connected_back" + machine.id)


            user.machines.push(machine)

        }
    }
    
    async getUserNotificationType(user, daylyServices, trx){
        try {
            const notifications = await this.knex("notification_settings")
                .transacting(trx)
                .select("id", "type", "email", "sms", "telegram", "tlgrm", "extraEmail", "telegramChat")
                .whereIn("type", daylyServices)
                .andWhere({
                    user_id: user.user_id
                })
                .andWhere(function(){
                    this.where("email", true).orWhere("tlgrm", true)
                })
            if(!notifications || notifications.length === 0) return null
            return notifications
        }
        catch (e) {
            logger.info(`getUserNotificationType_error: ${e.message}`)
            return null
        }
    }

    async getUserMachines(user, trx){
        try{

            return this.knex("machines")
                .transacting(trx)
                .select("id", "number", "name", "equipment_id", "user_id", "place", "controller_id")
                .whereNull("deleted_at")
                .andWhere({
                    user_id: user.user_id
                })
        }
        catch (e) {
            logger.info(`getUserMachines_error: ${e.message}`)
            return null
        }
    }

    async getUserBalance(user, trx){
        try{
            let [balance] = await this.knex("temps")
                .transacting(trx)
                .select("amount as sum")
                .where({
                    user_id: user.user_id
                })

            if(!balance){
                [balance] = await this.knex("transactions")
                    .transacting(trx)
                    .sum("amount")
                    .where({
                        user_id: user.user_id
                    })

            }
            return balance
        }
        catch (e) {
            logger.info(`getUserBalance_error: ${e.message}`)
            return null
        }
    }
    async setMachineLog(machine_id, type, message){
        try {
        // add machine log
            await this.knex("machine_logs")
                .insert({
                    message,
                    type,
                    created_at: new Date(),
                    updated_at: new Date(),
                    machine_id
                })
        
            return true
        }
        catch (e) {
            logger.info(`setMachineLog_error: ${e.message}`)
            return null
        }
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
        const SPBTime = (new Date().getTime() + (1000 * 60 * 60 * 3))
        const date = new Date(SPBTime)

        return new Intl.DateTimeFormat("ru-RU", options).format(date)
    }
    async getSalesSum(user, period, trx, fastYesterday){
        const [temp] = await this.knex("temps")
            .transacting(trx)
            .where("user_id", user.user_id)
            .select("amount_yesterday", "user_id", "count_yesterday", "amount")

        if(fastYesterday){
            if(!temp){
                return {sum: 0, count: 0, balance: 0}
            }
            return {sum: Number(temp.amount_yesterday), count: Number(temp.count_yesterday), balance: Number(temp.amount)}
        }
        const machines = await this.knex("machines")
            .transacting(trx)
            .whereNull("deleted_at")
            .andWhere("user_id", user.user_id)
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

        return {sum, count, balance: Number(temp.amount)}

    }

    generateMachineMessages(user, mach, event, text){

        if (event.tlgrm && event.telegramChat) {

            user.msgT = `${user.msgT}
Автомат ${mach.name} ( ${mach.number} ) - ${text}`
        }
        if (event.email  && event.extraEmail) {
            user.msg = user.msg + "<br>" + "Автомат " + mach.name + " (" + mach.number + ") - " + text
        }

    }


    generateBalanceMessage(user, event){
        let textBalance = ""
        if (user.balance < Number(process.env.USER_LOW_BALANCE) && user.balance > Number(process.env.BALANCE_LESS_100)) {
            textBalance = `
Баланс вашего кабинета менее ${process.env.USER_LOW_BALANCE} руб.
Пополните баланс!`
        }
        else if(user.balance < Number(process.env.BALANCE_LESS_100) && user.balance > Number(process.env.USER_WILL_BLOCK)){
            textBalance = `
Баланс вашего кабинета менее ${process.env.BALANCE_LESS_100} руб.
Пополните баланс, не допускайте блокировки!`
        }
        else if(user.balance < Number(process.env.USER_WILL_BLOCK) && user.balance > Number(process.env.BALANCE_LESS_M100)){
            textBalance = `
Баланс вашего кабинета менее ${process.env.USER_WILL_BLOCK} руб.
Пополните баланс, не допускайте блокировки!`
        }
        else if(user.balance < Number(process.env.BALANCE_LESS_M100) && user.balance > Number(process.env.BALANCE_BLOCKED)){
            textBalance = `
Баланс вашего кабинета менее ${process.env.BALANCE_LESS_M100} руб.
Пополните баланс, частично ограничен доступ к услугам!`
        }
        else if(user.balance < Number(process.env.BALANCE_BLOCKED)){
            textBalance = `
Баланс вашего кабинета менее ${process.env.USER_LOW_BALANCE} руб.
Пополните баланс, работа онлайн кассы прекращена!`


        }
        else {
            return
        }
        if (event.tlgrm && event.telegramChat) {
            user.msgT = `${user.msgT}
${textBalance}`
        }
        if (event.email  && event.extraEmail) {
            user.msg = user.msg + "<br>" + "Баланс вашего кабинета менее " + process.env.USER_LOW_BALANCE + " руб. " + textBalance
        }
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
            let tgText = n.text.replace( /(<([^>]+)>)*(<([^>]+)>)/ig, `
` )
            tgText = tgText.replace( /&nbsp;/g, " " )

            acc.tlgrm =  acc.tlgrm + `
${n.header}
${tgText}
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