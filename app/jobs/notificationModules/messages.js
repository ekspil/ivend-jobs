function textDate(value, format = "date") {
    const options = {}
    if (format.includes("date")) {
        options.day = "2-digit"
        options.month = "2-digit"
        options.year = "numeric"
    }
    if (format.includes("time")) {
        options.hourCycle = "h24"
        options.hour = "2-digit"
        options.minute = "2-digit"
    }
    if (format.includes("order")) {
        options.minute = "2-digit"
        options.second = "2-digit"
    }

    const string = new Intl.DateTimeFormat("ru-RU", options).format(new Date(value))

    return string
}


module.exports = {
    textDate,
    report: function(sum, period, companyName, count, balance){
        return `${textDate(new Date(), "datetime")}
${companyName}
Статистика: 
Продаж за прошлый(ю) ${period} ${count} на сумму ${sum} руб. ${balance ? "Баланс " + balance + " руб" : ""}`
    },
    reportMonth: function(sum, period, companyName, count, balance){
        return `${textDate(new Date(), "datetime")}
${companyName}
Статистика: 
Продаж за прошлый месяц ${count} на сумму ${sum} руб.  ${balance ? "Баланс " + balance + " руб" : ""}`
    },
    reportWeek: function(sum, period, companyName, count, balance){
        return `${textDate(new Date(), "datetime")}
${companyName}
Статистика: 
Продаж за прошлую неделю ${count} на сумму ${sum} руб.  ${balance ? "Баланс " + balance + " руб" : ""}`
    },
    reportDay: function(sum, period, companyName, count, balance){
        return `${textDate(new Date(), "datetime")}
${companyName}
Статистика: 
Продаж за прошлые сутки ${count} на сумму ${sum} руб.  ${balance ? "Баланс " + balance + " руб" : ""}`
    }
}