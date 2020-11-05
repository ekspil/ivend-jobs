module.exports = {
    report: function(sum, period, companyName){
        return ` Компания: ${companyName}
Отчет за прошлый(ю) ${period}:
Продажи составили ${sum} рублей.`
    }
}