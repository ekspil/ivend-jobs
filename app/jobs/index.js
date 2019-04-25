const checkControllerConnection = require("./checkControllerConnection")

const jobs = (injects) => {
    const get = (jobName) => {

        switch (jobName) {
            case "CHECK_CONTROLLER_CONNECTION":
                return checkControllerConnection(injects)
            default:
                return undefined
        }
    }

    return {
        get
    }
}


module.exports = jobs
