#!/usr/bin/env node

const fs = require('fs');
const puppeteer = require('puppeteer');
// const process = require('process')
const args = process.argv.slice(2);

// console.log('process.argv.length: ', process.argv.length)
if(args.length <= 0) {
    console.log('Missing Arguments: <request_file>')

    process.exit(1)
}

const requestFile = args[0];

let bufferData = fs.readFileSync(requestFile);
let stData = bufferData.toString();
let {
    url,
    qs = null,
    puppeteersOptions,
    config = {},
    nextPage = null,
    scrape
} = JSON.parse(stData);

let { parentSelector, columns } = scrape;

let { suppressBrowserLog = true, acceptCookiesSelector = null } = config;
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

                if(!suppressBrowserLog) {
                    console.log(color(`[${type}] ${message.text()}`))
                }
                // console.log('')
            })
            .on('pageerror', ({message}) => {
                if(!suppressBrowserLog) {
                    console.log(red(message))
                }
            })
            // .on('response', response =>
            //     console.log(green(`${response.status()} ${response.url()}`)))
            .on('requestfailed', request => {
                if(!suppressBrowserLog) {
                    console.log(magenta(`${request.failure().errorText} ${request.url()}`))
                }
            })

        await page.goto(url)

        if(!!acceptCookiesSelector) {
            // console.log('ACCEPTING COOKIES: ', acceptCookiesSelector)

            await page.click(acceptCookiesSelector)
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

        const retrievedData = await page.evaluate((parentSelector, columns, nextPage) => {
            // This block has the page context, which is almost identical to being in the console
            // except for some of the console's supplementary APIs.

            // Get the URL host name and path separately
            const {origin, pathname, href} = window.location;

            const keys = Object.keys(columns)

            const data = []

            const parentElements = Array.from(document.querySelectorAll(parentSelector))

            // console.log('parentElements:', parentElements.length)

            for(let childIndex = 0; childIndex < parentElements.length; childIndex++) {
                const parent = parentElements[ childIndex ];

                // let currentElementIndex = 0;

                const item = {}

                for (let i = 0; i < keys.length; i++) {
                    const column = keys[i]

                    // console.log('column: ', column)

                    const {
                        selector,
                        type,
                        config = {
                            attr: null,
                            type: null,

                        }
                    } = columns[column];

                    // console.log('columns[ column ]: ', selector, type, attr )

                    const getColValue = (el, type) => {
                        let colValue = '';

                        if (type === 'text') {
                            colValue = !!el ? el.textContent : ''
                        } else if (type === 'html') {
                            colValue = !!el ? el.innerHTML : ''
                        } else if (type === 'attr') {
                            colValue = !!el ? el.getAttribute(config.attr) : ''
                        } else if (type === 'expectedValue'){
                            console.log('el: ', !!el)

                            if(!el) {
                                return false
                            }

                            colValue = getColValue(el, !!config.type ? config.type : 'text')

                            console.log('colValue: ', colValue)

                            if(colValue === '') {
                                return false
                            } else {
                                config.caseSensitive = !!config.caseSensitive ? config.caseSensitive : false
                                colValue = config.caseSensitive === true ? colValue : colValue.toLowerCase()

                                return colValue === (config.caseSensitive ? config.value : config.value.toLowerCase())
                            }
                        }

                        return colValue
                    }

                    let elements = parent.querySelectorAll(selector)
                    // console.log('elements: ', elements.length)

                    if(elements.length === 0) {
                        item[column] = ''
                    } else if(elements.length === 1) {
                        item[column] = getColValue(elements[0], type)
                    } else {
                        // TODO
                        item[column] = Array.from(elements/*[ currentElementIndex++ ]*/)
                            .map(el => getColValue(el, type))
                    }



                    // console.log('tmpData[column]: ', tmpData[column])
                }

                data.push(item)
            }

            /*let maxLenght = tmpData[keys[0]].length;
            let maxLenghtIndex = 0;

            for (let colIndex = 0; colIndex < keys.length; colIndex++) {
                console.log(keys[colIndex], tmpData[keys[colIndex]].length)

                if (tmpData[keys[colIndex]].length > maxLenght) {
                    maxLenght = tmpData[keys[colIndex]].length
                    maxLenghtIndex = colIndex
                }
            }

            console.log('MAX LENGHT: ', maxLenght)
            console.log('MAX LENGHT INDEX: ', maxLenghtIndex)

            // console.log('PROCESSING DATA: ', tmpData[ keys[0] ].length)
            // console.log('PROCESSING DATA: ', tmpData[ keys[1] ].length)
            // console.log('PROCESSING DATA: ', tmpData[ keys[2] ].length)

            const data = []

            for (let dataIndex = 0; dataIndex < tmpData[ keys[maxLenghtIndex] ].length; dataIndex++) {
                const colData = {}

                for (let colIndex = 0; colIndex < keys.length; colIndex++) {
                    const column = keys[colIndex]

                    // console.log('column: ', column)
                    // console.log('tmpData[column][dataIndex]: ', tmpData[column][dataIndex])

                    colData[column] = !!tmpData[column][dataIndex] ? tmpData[column][dataIndex] : ''
                }

                data.push(colData)
            }*/

            return {
                origin,
                pathname,
                href,
                length: data.length,
                data,
            }
        }, parentSelector, columns, nextPage)

        // console.log(retrievedData)

        // Convert the object from the browser eval to JSON to parse with with jq later
        const retrievedJSON = JSON.stringify(retrievedData, null, 4)

        // console.log writes to stdout in node
        console.log(retrievedJSON)

        await browser.close()

    } catch(e) {
        console.log('[ERROR] ', e)

        process.exit(1)
    }
    finally {
        await browser.close()
    }
})()
