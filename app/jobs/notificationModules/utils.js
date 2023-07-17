const logger = require("my-custom-logger")
const fetch = require("node-fetch")

const notificationTime = {}

const setNotificationTime = async (type, item_id) => {
    if(!notificationTime[type]){
        notificationTime[type]={}
    }
    notificationTime[type][item_id] = new Date().getTime()

    return true
}

const checkTime = (event, item_id) => {
    if(notificationTime[event.type]){
        const timeExp =(new Date().getTime()) - notificationTime[event.type][item_id]
        if (timeExp < (24*60*60*1000) ){
            return false
        }
    }
    return true
}


const sendTelegram = async (chat, msg) => {
    const body = JSON.stringify({chat, msg})
    const url = `${process.env.NOTIFICATION_URL}/api/v1/template/TELEGRAM_MSG`
    const method = "POST"
    try {
        return await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body
        })
    }
    catch (e) {
        logger.info(`NOTIFICATION_SEND_TELEGRAM_FETCH_ERROR chat: ${chat} ${e.message}`)
    }

}

const sendEmail = async (email, msg) => {
    const body = JSON.stringify({email, msg})
    const url = `${process.env.NOTIFICATION_URL}/api/v1/template/EMAIL_MSG`
    const method = "POST"
    try {
        return await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body
        }) 
    }
    catch (e) {
        logger.info(`NOTIFICATION_SEND_EMAIL_FETCH_ERROR email: ${email} ${e.message}`)
    }



}

const sendTextSMS = async (phone, text) => {
    const body = JSON.stringify({text, phone})
    const url = `${process.env.NOTIFICATION_URL}/api/v1/template/SMS_NEWS`
    const method = "POST"

    const response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body
    })

    switch (response.status) {
        case 200:
            const json = await response.json()
            const {sent} = json

            if (!sent) {
                throw new Error("JOBS_SMS_TEXT_EMAIL_ERROR_1")
            }

            return
        default:
            throw new Error("JOBS_SMS_TEXT_EMAIL_ERROR_2")
    }




}

const sendTextEmail = async (email, text) => {
    const body = JSON.stringify({text, email})
    const url = `${process.env.NOTIFICATION_URL}/api/v1/template/TEXT_EMAIL`
    const method = "POST"

    const response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body
    })

    switch (response.status) {
        case 200:
            const json = await response.json()
            const {sent} = json

            if (!sent) {
                throw new Error("JOBS_SMS_TEXT_EMAIL_ERROR_1")
            }

            return
        default:
            throw new Error("JOBS_SMS_TEXT_EMAIL_ERROR_2")
    }
}

module.exports = {
    sendEmail,
    sendTelegram,
    checkTime,
    setNotificationTime,
    notificationTime,
    sendTextEmail,
    sendTextSMS


}