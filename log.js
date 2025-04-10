// has to be in its own file for circular reference fixes
const LOGSENABLED = true

let errorLogs = []
let logs = []

function formatString(string, ...data) {
    for (let item of data) {
        try { string = string.replace("%s", JSON.stringify(item)) }
        catch(_) { string = string.replace("%s", item) } // this should never happen, but just in case
    }
    return string
}

/**
 * @param {string} string 
 * @param  {...any} data 
 */
function logDebug(string, ...data)
{
    if (!LOGSENABLED) return

    string = formatString(string, ...data)

    console.log(string)
}

/**
 * @param {string} string 
 * @param  {...any} data 
 */
function log(string, ...data)
{
    // just places the text further to the right LOL
    logDebug(" ".repeat(120) + string, ...data)

    logs.push({
        time: Date.now(),
        message: formatString(string, ...data)
    })
}

/**
 * 
 * @param {number} level 
 * @param {string} string 
 * @param  {...any} data 
 */
function logError(level, string, ...data) {
    logDebug(string, ...data)
    errorLogs.push({
        time: Date.now(),
        level: level,
        message: formatString(string, ...data)
    })
}

// clear logs every 24 hours
setInterval(() => {
    logs = []
}, 8.64e+7)

// clear error logs every week
setInterval(() => {
    errorLogs = []
}, 6.048e+8)

module.exports = { log, logDebug, logError, LOGSENABLED, errorLogs, logs }
