#!/usr/bin/env node

const fs = require('fs');
const puppeteer = require('puppeteer');
// const process = require('process')

const { loadJsonParser } = require('./scrapershell/jsonLoader')
const { saveCookie, loadCookie } = require('./scrapershell/cookies')
const { setupPuppeteersLog } = require('./scrapershell/log')
// const { applyFilters } = require('./scrapershell/applyFilters')
const { preScrape } = require('./scrapershell/preScrape')
const { nextPage } = require('./scrapershell/nextPage')
const { evaluateJsInDOM } = require('./scrapershell/evaluate')

// console.log('process.argv.length: ', process.argv.length)
const args = process.argv.slice(2)

if(args.length <= 0) {
    console.log('Missing Arguments: <request_file>')

    process.exit(1)
}

const requestFile = args[0];

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
    nextPageConfig = null,
    preScrapeConfig = null,
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
// console.log('nextPageConfig: ', nextPageConfig)
// process.exit(1)

(async () => {
    // console.log('url: ', url)

    const browser = await puppeteer.launch(puppeteersOptions)

    try {
        const page = await browser.newPage()

        if(!!userAgent) {
            await page.setUserAgent(userAgent)
        }

        if(!!cookieFile) {
            await loadCookie(page, cookieFile)
        }

        setupPuppeteersLog(page, {
            suppressBrowserLog,
            browserLogOutputFile
        })

        await page.goto(url)

        if(!!acceptCookiesSelector) {
            console.log('ACCEPTING COOKIES: ', acceptCookiesSelector)

            await page.click(acceptCookiesSelector)
        }

        if(preScrapeConfig !== null) {
            await preScrape(page, preScrapeConfig)
        }


        if(nextPageConfig !== null && nextPageConfig.active !== false) {
            await nextPage(page, nextPageConfig)
        }

        // await page.exposeFunction('applyFilters', applyFilters)

        const retrievedData = await evaluateJsInDOM( page, {
            parentSelector,
            scrapeMode,
            columns,
            limit,
            filter,
            transform,
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
