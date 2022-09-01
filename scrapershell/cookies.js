const saveCookie = async (page, cookieFile = 'cookies.json') => {
    const cookies = await page.cookies();
    const cookieJson = JSON.stringify(cookies, null, 2);
    await fsProms.writeFile(cookieFile, cookieJson);
}

// TODO: Add cookie.txt support (npm i cookiefile)
//load cookie function
const loadCookie = async (page, cookieFile = 'cookies.json') => {
    const cookieJson = await fsProms.readFile(cookieFile);
    const cookies = JSON.parse(cookieJson);
    await page.setCookie(...cookies);
}

module.exports = {
    saveCookie,
    loadCookie
}