//const logger = require("my-custom-logger")
const fetch = require("node-fetch")


class Services {
    constructor({knex}) {
        this.knex = knex
        this.waitASec = this.waitASec.bind(this)
        this.getTerminal = this.getTerminal.bind(this)
        this.getOwner = this.getOwner.bind(this)
        this.getTids = this.getTids.bind(this)
        this.putTerminal = this.putTerminal.bind(this)
    }

    async waitASec(time) {
        return new Promise((resolve => {
            setTimeout(() => {
                resolve()
            }, time || 1000)
        }))
    }

    async getTerminal(id) {
        const url = `https://api.vendista.ru:99/terminals/${id}?token=${process.env.VEDNISTA_API_TOKEN}`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "text/plain"
            }
        })
        const json = await response.json()
        if( !json || !json.success) return null

        return json.item


    }

    async getOwner(id) {
        const url = `https://api.vendista.ru:99/owners/${id}?token=${process.env.VEDNISTA_API_TOKEN}`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "text/plain"
            }
        })
        const json = await response.json()
        if( !json || !json.id) return null

        return json


    }

    async getTids(name) {
        const url = `https://api.vendista.ru:99/tid?ItemsOnPage=999&FilterText=${encodeURI(name)}&token=${process.env.VEDNISTA_API_TOKEN}`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "text/plain"
            }
        })
        const json = await response.json()
        if( !json || !json.success) return null

        return json.items

    }

    async putTerminal(id, tid) {
        const url = `https://api.vendista.ru:99/terminals/${id}?token=${process.env.VEDNISTA_API_TOKEN}`
        const data = {
            bank_id: tid
        }

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Accept": "text/plain",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        const json = await response.json()
        if( !json || !json.success) return null

        return json.item


    }


}

module.exports = Services