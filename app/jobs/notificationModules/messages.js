function textDate(value, format = "date") {
    const options = {}
    if (format.includes("date")) {
        options.day = "2-digit"
        options.month = "long"
        options.year = "numeric"
    }
    if (format.includes("time")) {
        options.hour = "2-digit"
        options.minute = "2-digit"
    }
    if (format.includes("order")) {
        options.minute = "2-digit"
        options.second = "2-digit"
    }

    return new Intl.DateTimeFormat("ru-RU", options).format(new Date(value))
}


module.exports = {
    report: function(sum, period, companyName, count){
        return `${textDate(new Date(), "datetime")}
${companyName}
Статистика: 
Продаж за прошлый(ю) ${period} ${count} на сумму ${sum} руб.`
    },
    reportMonth: function(sum, period, companyName, count){
        return `${textDate(new Date(), "datetime")}
${companyName}
Статистика: 
Продаж за прошлый месяц ${count} на сумму ${sum} руб.`
    },
    reportWeek: function(sum, period, companyName, count){
        return `${textDate(new Date(), "datetime")}
${companyName}
Статистика: 
Продаж за прошлую неделю ${count} на сумму ${sum} руб.`
    },
    reportDay: function(sum, period, companyName, count){
        return `${textDate(new Date(), "datetime")}
${companyName}
Статистика: 
Продаж за прошлые сутки ${count} на сумму ${sum} руб.`
    }
}