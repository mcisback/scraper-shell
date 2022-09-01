async function saveCookie (page, cookieFile = 'cookies.json') {
    const cookies = await page.cookies();
    const cookieJson = JSON.stringify(cookies, null, 2);
    await fsProm.writeFile(cookieFile, cookieJson);
}

async function loadCookie (page, cookieFile = 'cookies.json') {
    const cookieJson = await fsProm.readFile(cookieFile);
    const cookies = JSON.parse(cookieJson);
    await page.setCookie(...cookies);
}

module.exports = {
    saveCookie,
    loadCookie
}