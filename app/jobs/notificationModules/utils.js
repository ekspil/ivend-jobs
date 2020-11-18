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

    await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body
    })
}

const sendEmail = async (email, msg) => {
    const body = JSON.stringify({email, msg})
    const url = `${process.env.NOTIFICATION_URL}/api/v1/template/EMAIL_MSG`
    const method = "POST"

    const result = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body
    })
    const js = await result.json()
    logger.debug(`Result sending to ${email}: ${JSON.stringify(result)}`)


}

module.exports = {
    sendEmail,
    sendTelegram,
    checkTime,
    setNotificationTime,
    notificationTime


}