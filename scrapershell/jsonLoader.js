const fs = require("fs");

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

module.exports = {
    removeJsonComments,
    loadJsonParser
}