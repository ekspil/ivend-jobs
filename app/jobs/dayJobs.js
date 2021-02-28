const logger = require("my-custom-logger")

module.exports = (injects) => {
    const {knex} = injects


    return async () => {


        logger.info(`Started day jobs`)
        return knex.transaction(async (trx) => {

            const kkts = await knex("kkts")
                .orderBy("id", "desc")
                .transacting(trx)

            for (let kkt of kkts){

                const [user] = await knex("users")
                    .where("id", kkt.user_id)
                    .orderBy("id", "desc")
                    .limit(1)
                    .transacting(trx)


                const [legal] = await knex("legal_infos")
                    .where("id", user.legal_info_id)
                    .orderBy("id", "desc")
                    .limit(1)
                    .transacting(trx)

                const update = {
                    companyName: legal.company_name,
                    inn: legal.inn
                }

                await knex("kkts")
                    .where("id", kkt.id)
                    .update(update)
                    .transacting(trx)



            }
            logger.info(`Finished day jobs`)


        })


    }

}
