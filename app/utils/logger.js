class Logger {


    constructor() {
    }

    _log(level, msg) {
        /* eslint-disable no-console */
        console[level](msg)
        /* eslint-enable no-console */
    }

    info(msg) {
        this._log("info", msg)
    }

    warning(msg) {
        this._log("warn", msg)
    }

    debug(msg) {
        this._log("debug", msg)
    }

    error(msg) {
        this._log("error", msg)
    }

    trace(msg) {
        this._log("trace", msg)
    }

}


module.exports = new Logger()
