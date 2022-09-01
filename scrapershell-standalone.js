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

const removeJsonComments = jsonString => {
    return jsonString
        .replace(/^\/\/.+$/gm, '')
        .replace(/^\n$/gm, '')
}

const loadJsonParser = requestFile => {
    const bufferData = fs.readFileSync(requestFile);

    // Load data and remove comments
    // console.log(removeJsonComments(bufferData.toString()))
    // process.exit(0)

    return JSON.parse(removeJsonComments(bufferData.toString()))

    // const stData = parse(fs.readFileSync(requestFile).toString())
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
} = loadJsonParser(requestFile);

let {
    scrapeMode = 'listing',
    parentSelector = null,
    filter = null,
    transform = null,
    columns,
    limit = -1
} = scrape;

let {
    suppressBrowserLog = true,
    acceptCookiesSelector = null ,
    browserLogOutputFile = null
} = config;

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
            console.log('ACCEPTING COOKIES: ', acceptCookiesSelector)

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

        const retrievedData = await page.evaluate(({
            parentSelector,
            scrapeMode,
            columns,
            nextPage,
            limit,
            filter,
            transform
        }) => {
            // This block has the page context, which is almost identical to being in the console
            // except for some of the console's supplementary APIs.
            console.log('Started page.evaluate()', {
                parentSelector,
                scrapeMode,
                columns,
                nextPage,
                limit
            })

            const applyFilters = (item, filter) => {
                const abort = -1

                console.log('Filtering item: ', JSON.stringify(item))

                // TODO: Filter block
                if(!!filter) {
                    console.log('Applying filters: ', JSON.stringify(filter))

                    let {
                        type = 'comparison',
                        config = null
                    } = filter

                    if(!config) {
                        return abort
                    }

                    let {
                        column = null,
                        condition = 'eq',
                        value = null,
                        action = 'include',
                        regex = null
                    } = config

                    if(!item.hasOwnProperty(column)) {
                        return abort
                    }

                    const columnValue = item[column]

                    if(type === 'comparison') {
                        if(!column || !value) {
                            console.log('column or value null', column, value)

                            return abort
                        }

                        // TODO: What if item[column] is array ?
                        if(Array.isArray( columnValue )) {
                            console.log('[NOT IMPLEMENTED YET] columnValue is array, skipping filter')

                            return abort
                        }

                        if(condition === 'eq') {
                            const cond = columnValue === value

                            return action === 'include' ? cond : !cond
                        } else if(condition === 'lt') {
                            const cond = parseFloat(columnValue) < parseFloat(value)

                            return action === 'include' ? cond : !cond
                        } else if(condition === 'lte') {
                            const cond = parseFloat(columnValue) <= parseFloat(value)

                            return action === 'include' ? cond : !cond
                        } else if(condition === 'gt') {
                            const cond = parseFloat(columnValue) > parseFloat(value)

                            return action === 'include' ? cond : !cond
                        } else if(condition === 'gte') {
                            const cond = parseFloat(columnValue) >= parseFloat(value)

                            return action === 'include' ? cond : !cond
                        }
                    } else if(type === 'match') {
                        if(!regex) {
                            console.log('match regex null, skipping filter')

                            return abort
                        }

                        const regexp = Function('return ' + regex)()
                        const cond = !!columnValue.match(regexp)

                        return action === 'include' ? cond : !cond
                    } else if(type === '!match') {
                        if(!regex) {
                            console.log('!match regex null, skipping filter')

                            return abort
                        }

                        const regexp = Function('return ' + regex)()
                        const cond = !!columnValue.match(regexp)

                        return action === 'include' ? !cond : cond
                    }
                }

                return true
            }

            const applyTransform = (item, transform) => {
                if(!item || !transform) {
                    return item
                }

                const columns = Object.keys(transform)

                for(let i = 0; i < columns.length; i++) {
                    const col = columns[i]

                    if(!item.hasOwnProperty(col)) {
                        return item
                    }

                    let {
                        type = null,
                        config = null
                    } = transform[col]

                    if(!type) {
                        return item
                    }

                    if(type === 'pickItem') {
                        if(!config) {
                            return item
                        }

                        let {
                            index = 0
                        } = config

                        if(!Array.isArray(item[col])) {
                            return item
                        }

                        item[col] = item[col][index]
                    } else if(type === 'replace') {
                        if(!config) {
                            return item
                        }

                        let {
                            regex = null,
                            to = null
                        } = config

                        if(!regex || !to){
                            return item
                        }

                        // TODO: And what if it is an array ?
                        if(Array.isArray(item[col])) {
                            item[col] = item[col].map(el => {
                                // For normal strings value in json should be:
                                // "regex": "'value_to_replace'"
                                // For regex:
                                // "regex": /regex/gmi
                                const regexp = Function('return ' + regex)()

                                // ''+item[col] -> item[col] to string
                                return (''+el).replace(regexp, to)
                            })
                        } else {
                            // For normal strings value in json should be:
                            // "regex": "'value_to_replace'"
                            // For regex:
                            // "regex": /regex/gmi
                            const regexp = Function('return ' + regex)()

                            // ''+item[col] -> item[col] to string
                            item[col] = ('' + item[col]).replace(regexp, to)
                        }
                    } else if(type === 'delete') {
                        if(item.hasOwnProperty(col)) {
                            delete item[col]
                        }
                    }
                }

                return item
            }

            const pushItem = (data, item, filter, transform) => {
                console.log('Pushing item')

                const doPushItem = applyFilters(item, filter)

                if(doPushItem === -1 || !!doPushItem) {
                    return data.push(applyTransform(item, transform))
                }
            }

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

                console.log('getColValue() type: ', type)
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

            console.log('SCRAPE MODE: ', scrapeMode)
            console.log('LIMIT IS: ', limit)

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

                    let elements = Array.from(parentElement.querySelectorAll(
                        columns[column].selector
                    ))

                    if(limit >= 0 && elements.length > 1) {
                        elements = elements.slice(0, limit)
                    }

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

                    pushItem(data, item, filter, transform)
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

                        let elements = Array.from(parent.querySelectorAll(selector))
                        console.log('elements.length: ', elements.length)

                        if(limit >= 0 && elements.length > 1) {
                            elements = elements.slice(0, limit)
                        }

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

                    pushItem(data, item, filter, transform)
                }
            }

            return {
                origin,
                pathname,
                href,
                length: data.length,
                data,
            }
        }, {parentSelector,
            scrapeMode,
            columns,
            nextPage,
            limit,
            filter,
            transform
        })

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