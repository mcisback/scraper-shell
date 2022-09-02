const fs = require("fs");
const {red, yellow, cyan, blue, magenta} = require("colorette");

const timestamp = new Date().getTime()

const logBrowserToFile = (fileName, message) => {
    const logFilename = fileName.replace('{{timestamp}}', timestamp)

    fs.appendFileSync(logFilename, message + "\n")
}

const setupPuppeteersLog = (page, { suppressBrowserLog, browserLogOutputFile }) => {
    const {blue, cyan, green, magenta, red, yellow} = require('colorette')
    page
        .on('console', message => {
            const type = message.type().substr(0, 3).toUpperCase()
            const colors = {
                LOG: text => text,
                ERR: red,
                WAR: yellow,
                INF: cyan
            }
            const color = colors[type] || blue

            if(suppressBrowserLog === false) {
                if(!!browserLogOutputFile) {
                    logBrowserToFile(browserLogOutputFile, `[${type}] ${message.text()}`)
                } else {
                    console.log(color(`[${type}] ${message.text()}`))
                }
            }
        })
        .on('pageerror', ({message}) => {
            if(suppressBrowserLog === false) {
                if(!!browserLogOutputFile) {
                    logBrowserToFile(browserLogOutputFile, `[ERROR] ${message.text()}`)
                } else {
                    console.log(red(`[ERROR] ${message.text()}`))
                }
            }
        })
        // .on('response', response =>
        //     console.log(green(`${response.status()} ${response.url()}`)))
        .on('requestfailed', request => {
            if(suppressBrowserLog === false) {
                if(!!browserLogOutputFile) {
                    logBrowserToFile(browserLogOutputFile, `[REQUEST FAILED] ${request.failure().errorText} ${request.url()}`)
                } else {
                    console.log(magenta(`[REQUEST FAILED] ${request.failure().errorText} ${request.url()}`))
                }
            }
        })
}

module.exports = {
    logBrowserToFile,
    setupPuppeteersLog
}