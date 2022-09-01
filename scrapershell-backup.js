#!/usr/bin/env node

const fs = require('fs');
const fsProm = fs.promises;
const puppeteer = require('puppeteer');
// const process = require('process')
const args = process.argv.slice(2);

// console.log('process.argv.length: ', process.argv.length)
if(args.length <= 0) {
    console.log('Missing Arguments: <request_file>')

    process.exit(1)
}

const requestFile = args[0];

const saveCookie = async (page, cookieFile = 'cookies.json') => {
    const cookies = await page.cookies();
    const cookieJson = JSON.stringify(cookies, null, 2);
    await fsProm.writeFile(cookieFile, cookieJson);
}

//load cookie function
const loadCookie = async (page, cookieFile = 'cookies.json') => {
    const cookieJson = await fsProm.readFile(cookieFile);
    const cookies = JSON.parse(cookieJson);
    await page.setCookie(...cookies);
}

let bufferData = fs.readFileSync(requestFile);
let stData = bufferData.toString();
let {
    url,
    qs = null,
    cookieFile = null,
    saveCookies = false,
    outputFile = null,
    userAgent = null,
    puppeteersOptions = {
        headless: true,
        ignoreHTTPSErrors: true
    },
    config = {},
    nextPage = null,
    preScrape = null,
    scrape
} = JSON.parse(stData);

let { parentSelector = null, columns, scrapeMode = 'listing' } = scrape;

let {
    suppressBrowserLog = true,
    acceptCookiesSelector = null ,
    browserLogOutputFile = null
} = config;
// let { url, puppettersOptions, columns } = config

if(qs !== null) {
    const esc = encodeURIComponent;
    const query = Object.keys(qs)
        .map(k => esc(k) + '=' + esc(qs[k]))
        .join('&');

    url += query === '' ? '' : '?' + query;
}

// console.log('url: ', url);
// console.log('nextPage: ', nextPage)
// process.exit(1)

const timestamp = new Date().getTime()

const logBrowserToFile = (fileName, message) => {
    const logFilename = fileName.replace('{{timestamp}}', timestamp)

/*    if(fs.existsSync(logFilename)) {
        fs.appendFileSync(logFilename, message)
    } else {
        console.log(`Creating File ${logFilename}`)*/

    fs.appendFileSync(logFilename, message + "\n")
    // }
}

(async () => {
    // console.log('url: ', url)

    const isElementVisible = async (page, cssSelector, waitTime) => {
        let visible = true;
        await page
            .waitForSelector(cssSelector, {visible: true, timeout: waitTime})
            .catch(() => {
                visible = false;
            });
        return visible;
    };

    const browser = await puppeteer.launch(puppeteersOptions)

    try {
        const page = await browser.newPage()

        if(!!userAgent) {
            await page.setUserAgent(userAgent)
        }

        if(!!cookieFile) {
            await loadCookie(page, cookieFile)
        }

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

        await page.goto(url)

        if(!!acceptCookiesSelector) {
            // console.log('ACCEPTING COOKIES: ', acceptCookiesSelector)

            await page.click(acceptCookiesSelector)
        }

        if(preScrape !== null) {
            const { actions } = preScrape

            for(let i = 0; i < actions.length; i++) {
                const action = actions[i]

                const { type, selector = null, config } = action

                if(type === 'click') {
                    await page.click(selector)
                } else if(type === 'type') {
                    await page.type(selector, config.value)
                } else if(type === 'timeout') {
                    await page.waitForTimeout(config.value);
                } else if(type === 'waitVisibility') {
                    await page.waitForSelector(selector, config.options)
                    await page.waitForFunction(`document.querySelector('${selector}').clientHeight != 0`)
                } else if(type === 'waitDisplay') {
                    await page.waitForSelector(selector, config.options)
                    await page.waitForFunction(`document.querySelector('${selector}').style.display != 'none'`)
                }
            }
        }


        if(nextPage !== null && nextPage.active !== false) {
            // console.log('nextPage: ', JSON.stringify(nextPage))
            const {type, selector, waitTime = 100} = nextPage;
            // console.log('nextPage: ', type, selector, waitTime);

            if (type === 'click') {
                // console.log('TYPE IS CLICK');

                let loadMoreVisible = await isElementVisible(page, selector, waitTime);
                // console.log('loadMoreVisible: ', loadMoreVisible)

                while (loadMoreVisible) {
                    // console.log('loadMoreVisible: ', loadMoreVisible)
                    // console.log('el: ', await page.$$(selector))

                    await page
                        .click(selector)
                        .catch(() => {
                        });
                    loadMoreVisible = await isElementVisible(page, selector);
                }
            }
        }

        const retrievedData = await page.evaluate((parentSelector, scrapeMode, columns, nextPage) => {
            // This block has the page context, which is almost identical to being in the console
            // except for some of the console's supplementary APIs.

            const transformText = (text, transform) => {
                console.log('transform text: ', text)

                if(!(!!transform)) {
                    return text
                }

                let {type = '', regex = '', value = null} = transform

                if(type === 'replace') {
                    const regexp = Function('return ' + regex)()

                    return text.replace(regexp, value)
                } else if(type === 'match') {
                    const regexp = Function('return ' + regex)()

                    return ['match', !!text.match(regexp), text]
                }
            }

            const getColValue = (el, { type, config = {transform: null} }) => {
                const isEl = !!el

                // console.log('getColValue() type: ', type)
                console.log('getColValue() config: ', JSON.stringify(config))
                let {
                    transform = null
                } = config

                if (type === 'text') {
                    return !isEl ? '' : transformText(el.textContent, transform)
                } else if (type === 'html') {
                    return !isEl ? '' : transformText(el.innerHTML, transform)
                } else if (type === 'attr') {
                    return !isEl ? '' : transformText(el.getAttribute(config.attr), transform)
                } else if (type === 'exists') {
                    // console.log('exists ? ', isEl, isEl ? el.textContent : '')

                    return isEl
                } else if (type === 'hasvalue') {
                    if (!isEl) {
                        return false
                    }

                    // console.log('!!config.type ? config.type : \'text\'', !!config.type ? config.type : 'text')

                    let colValue = getColValue(el, {
                        type: !!config.type ? config.type : 'text',
                        config: {}
                    })

                    // console.log('colValue: ', colValue)

                    if (colValue === '' || !colValue) {
                        return false
                    } else {
                        config.caseSensitive = !!config.caseSensitive ? config.caseSensitive : false
                        colValue = config.caseSensitive === true ? colValue : colValue.toLowerCase()

                        // console.log('colValue === (config.caseSensitive ? config.value : config.value.toLowerCase()): ', colValue === (config.caseSensitive ? config.value : config.value.toLowerCase()))

                        return (colValue === (config.caseSensitive ? config.value : config.value.toLowerCase()))
                    }
                } else {
                    throw new Error(`${type} is not supported`)
                }
            }

            // Get the URL host name and path separately
            const {origin, pathname, href} = window.location;

            const keys = Object.keys(columns)

            const data = []

            // console.log('SCRAPE MODE: ', scrapeMode)

            if(scrapeMode === 'listing') {
                if(parentSelector === null) {
                    parentSelector = 'body'
                }

                const parentElement = document.querySelector(parentSelector)

                const firstArray = Array.from(document.querySelectorAll(parentSelector))

                let maxLength = firstArray.length
                let maxIndex = 0

                for (let i = 0; i < keys.length; i++) {
                    const column = keys[i]

                    const elements = Array.from(parentElement.querySelectorAll(
                        columns[column].selector
                    ))

                    if(maxLength < elements.length) {
                        maxLength = elements.length
                        maxIndex = i
                    }
                }

                for(let i = 0; i < maxLength; i++) {
                    const item = {}
                    for (let j = 0; j < keys.length; j++) {
                        const column = keys[j]

                        const el = document.querySelectorAll(
                            columns[column].selector
                        )[i]

                        item[column] = getColValue(el, columns[column])
                    }

                    data.push(item)
                }

            } else if(scrapeMode === 'onebyone') {

                const parentElements = Array.from(document.querySelectorAll(parentSelector))

                console.log('parentElements.length:', parentElements.length)

                for (let childIndex = 0; childIndex < parentElements.length; childIndex++) {
                    const parent = parentElements[childIndex];

                    const item = {}
                    let jumpNextLoop = false

                    for (let i = 0; i < keys.length; i++) {
                        const column = keys[i]

                        console.log('column: ', column)

                        const {
                            selector,
                            type,
                            config = {
                                attr: null
                            }
                        } = columns[column];

                        console.log('columns[ column ]: ', selector, type, config.attr )

                        let elements = parent.querySelectorAll(selector)
                        // console.log('elements.length: ', elements.length)

                        /*if (elements.length === 0) {
                            item[column] = ''
                        } else */
                        if (elements.length <= 1) {
                            // console.log('elements[0] is null ? ', elements[0] === null, type)
                            // console.log('columns[ column ]: ', selector, type, JSON.stringify(config) )

                            item[column] = getColValue(elements[0], { type, config })
                        } else {
                            // console.log('PASSA DI QUI: ', column)

                            item[column] = Array.from(elements)
                                .map(el => getColValue(el, { type, config }))
                        }

                        if(Array.isArray(item[column]) && item[column].length === 3) {
                            if(item[column][0] === 'match') {
                                if(item[column][1] === false) {
                                    jumpNextLoop = true
                                    break
                                }

                                item[column] = item[column][2]
                            }
                        }

                    }

                    if(jumpNextLoop) {
                        jumpNextLoop = false

                        continue
                    }

                    data.push(item)
                }
            }

            return {
                origin,
                pathname,
                href,
                length: data.length,
                data,
            }
        }, parentSelector, scrapeMode, columns, nextPage)

        const retrievedJSON = JSON.stringify(retrievedData, null, 4)

        if(!!outputFile) {
            console.log(`[OUTPUT] Writing ${outputFile}`)

            fs.writeFileSync(outputFile, retrievedJSON)
        } else {
            console.log(retrievedJSON)
        }

        if(saveCookies === true) {
            await saveCookie(page);
        }
        await browser.close()

    } catch(e) {
        console.log('[ERROR] ', e)

        process.exit(1)
    }
    finally {
        await browser.close()
    }
})()
