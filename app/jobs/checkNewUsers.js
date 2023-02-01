const logger = require("my-custom-logger")
const fs = require("fs")
const path = require("path")



module.exports = (injects) => {



    const {knex} = injects
    return async () => {

        const fileAddress = path.join(__dirname, "users_new.txt")
        let count = 0
        let file = await fs.readFileSync(fileAddress, "utf8")
        file = file.split("\n")
        file = file.map(item => {
            count++
            const arr = item.split(";")
            return {
                phone: arr[0].trim().slice(1),
                inn: arr[1].trim(),
                company_name: arr[2].trim(),
                country_code: 7,
                email: `temp${count}@ivend.pro`,
                role: "VENDOR_NO_LEGAL_INFO"
            }
        })
        const numbers = []
        file = file.filter(item => {

            const exist = numbers.find(it=> item.phone === it )
            if(exist) return false
            numbers.push(item.phone)
            return true
        })




        await knex.transaction(async (trx) => {

            for (let item of file){
                const [user] = await knex("users")
                    .select("id")
                    .limit(1)
                    .where({
                        phone: item.phone
                    })
                if (user){
                    logger.info(`user_add_job_error: user phone ${item.phone} exist `)
                    continue
                }

                await knex("users")
                    .transacting(trx)
                    .insert({
                        role: item.role,
                        email: item.email,
                        company_name: item.company_name,
                        country_code: item.country_code,
                        inn: item.inn,
                        phone: item.phone,
                        passwordHash: "$2a$10$pMqNLGwiKsR8ETVrzYahVuBUw3zobKFwJoH65zNGMrT.iUaNSnYNi"
                    })

            }
            logger.info("user_add_job_error: Finished!")
        })

    }




}


