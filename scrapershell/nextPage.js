const isElementVisible = async (page, cssSelector, waitTime) => {
    let visible = true;
    await page
        .waitForSelector(cssSelector, {visible: true, timeout: waitTime})
        .catch(() => {
            visible = false;
        });
    return visible;
};

const nextPage = async (page, nextPageConfig) => {
    // console.log('nextPage: ', JSON.stringify(nextPageConfig))
    const {type, selector, waitTime = 100} = nextPageConfig;
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

module.exports = {
    nextPage
}