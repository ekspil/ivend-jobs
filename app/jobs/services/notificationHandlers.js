const Services = require("../services/notificationServices")

class Handlers {
    constructor({knex, redis}) {
        this.knex = knex
        this.redis = redis
        this.CONTROLLER_NO_CONNECTION = this.CONTROLLER_NO_CONNECTION.bind(this)
        this.NO_RECEIPT_24H = this.NO_RECEIPT_24H.bind(this)
        this.MACHINE_ATTENTION_REQUIRED = this.MACHINE_ATTENTION_REQUIRED.bind(this)
        this.NO_CASHLESS_24H = this.NO_CASHLESS_24H.bind(this)
        this.NO_CASH_24H = this.NO_CASH_24H.bind(this)
        this.NO_COINS_24H = this.NO_COINS_24H.bind(this)
        this.USER_LOW_BALANCE = this.USER_LOW_BALANCE.bind(this)
        this.CONTROLLER_ENCASHMENT = this.CONTROLLER_ENCASHMENT.bind(this)
        this.CONTROLLER_NO_SALES = this.CONTROLLER_NO_SALES.bind(this)
        this.services = new Services({knex, redis})
    }

    async CONTROLLER_NO_CONNECTION(user, event){

        for (const mach of user.machines) {

            if(mach.connectionBack === "OK"){

                this.services.generateMachineMessages(user, mach, event, "Связь восстановлена")

                await this.redis.set("controller_connected_back" + mach.id, null, "EX", 24 * 60 * 60)
                continue

            }

            if (!await this.services.checkTime(event, "machine" + mach.id + mach.lostConnection)) {
                continue
            }
            if (mach.lostConnection < (new Date().getTime() - 24 * 60 * 60 * 1000)) {
                continue
            }


            this.services.generateMachineMessages(user, mach, event, "Нет связи с автоматом")
            await this.services.setNotificationTime(event.type, "machine" + mach.id + mach.lostConnection)
        }

    }
    async NO_RECEIPT_24H(user, event){

        for (const mach of user.machines) {
            if (!await this.services.checkTime(event, "NO_RECEIPT_24H" + mach.id)) {
                continue
            }
            if(mach.kktStatus === "ERROR" || mach.kktStatus !== "24H" ){
                continue
            }
            this.services.generateMachineMessages(user, mach, event, "Нет чеков 24 часа")

            await this.services.setMachineLog(mach.id, "NO_RECEIPT_24H", "Нет чеков 24 часа")

            await this.services.setNotificationTime(event.type, "NO_RECEIPT_24H" + mach.id)
        }
    }
    async MACHINE_ATTENTION_REQUIRED(user, event){

        for (const mach of user.machines) {

            const status = await this.redis.get("MACHINE_ATTENTION_REQUIRED_NOTIFICATION_" + mach.id)

            if(status === "ERROR"){


                this.services.generateMachineMessages(user, mach, event, "Не работает автомат")

            }
            else if (status === "OK"){


                this.services.generateMachineMessages(user, mach, event, "Автомат работает")

            }
            await this.redis.set("MACHINE_ATTENTION_REQUIRED_NOTIFICATION_" + mach.id, null, "EX", 24 * 60 * 60)

        }
    }
    async NO_CASHLESS_24H(user, event){

        for (const mach of user.machines) {
            if (!await this.services.checkTime(event, "NO_CASHLESS_24H" + mach.id)) {
                continue
            }
            if(mach.terminalStatus === "OK"){
                await this.services.delNotificationTime(event.type, "NO_CASHLESS_24H" + mach.id)
                continue
            }
            this.services.generateMachineMessages(user, mach, event, "Нет безнала 24 часа")


            await  this.services.setMachineLog(mach.id, "NO_CASHLESS_24H", "Нет безнала 24 часа")

            await this.services.setNotificationTime(event.type, "NO_CASHLESS_24H" + mach.id, 30 * 24 * 60 * 60)
        }
    }
    async NO_CASH_24H(user, event){

        for (const mach of user.machines) {
            if (!await this.services.checkTime(event, "NO_CASH_24H" + mach.id)) {
                continue
            }
            if(mach.banknoteCollectorStatus === "OK"){
                await this.services.delNotificationTime(event.type, "NO_CASH_24H" + mach.id)
                continue
            }
            this.services.generateMachineMessages(user, mach, event, "Нет купюр 24 часа")



            await  this.services.setMachineLog(mach.id, "NO_CASH_24H", "Нет купюр 24 часа")

            await this.services.setNotificationTime(event.type, "NO_CASH_24H" + mach.id, 30 * 24 * 60 * 60)
        }

    }
    async NO_COINS_24H(user, event){

        for (const mach of user.machines) {
            if (!await this.services.checkTime(event, "NO_COINS_24H" + mach.id)) {
                continue
            }
            if(mach.coinCollectorStatus === "OK"){
                await this.services.delNotificationTime(event.type, "NO_COINS_24H" + mach.id)
                continue
            }
            this.services.generateMachineMessages(user, mach, event, "Нет монет 24 часа")

            await  this.services.setMachineLog(mach.id, "NO_COINS_24H", "Нет монет 24 часа")

            await this.services.setNotificationTime(event.type, "NO_COINS_24H" + mach.id, 30 * 24 * 60 * 60)
        }
        
    }
    async USER_LOW_BALANCE(user, event){
        if (!await this.services.checkTime(event, "user" + user.user_id)) {
            return
        }
        this.services.generateBalanceMessage(user, event)

        await this.services.setNotificationTime(event.type, "user" + user.user_id)
    }
    async CONTROLLER_ENCASHMENT(user, event){

        for (const mach of user.machines) {
            if (mach.lastEncashment < (new Date().getTime() - 24 * 60 * 60 * 1000)) {
                continue
            }
            if (!await this.services.checkTime(event, "machine" + mach.id + mach.lastEncashment)) {
                continue
            }
            this.services.generateMachineMessages(user, mach, event, "Произведена инкассация")
            await this.services.setNotificationTime(event.type, "machine" + mach.id + mach.lastEncashment)
        }
    }
    async CONTROLLER_NO_SALES(user, event){

        for (const mach of user.machines) {

            if (mach.lastSale > (new Date().getTime() - 24 * 60 * 60 * 1000)) {
                await this.services.delNotificationTime(event.type, "CONTROLLER_NO_SALES" + mach.id)
                continue
            }
            if (!await this.services.checkTime(event, "CONTROLLER_NO_SALES" + mach.id)) {
                continue
            }
            this.services.generateMachineMessages(user, mach, event, "Нет продаж 24 часа")

            await this.services.setControllerError(mach)

            await this.services.setNotificationTime(event.type, "CONTROLLER_NO_SALES" + mach.id, 30 * 24 * 60 * 60)
        }
        

    }
}

module.exports = Handlers