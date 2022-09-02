const preScrape = async (page, preScrapeConfig) => {
    const { actions } = preScrapeConfig

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

module.exports = {
    preScrape
}