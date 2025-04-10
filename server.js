const https = require("https")
const messages = require("./funnyMessages").messages
const fs = require("fs")
const crypto = require("crypto")
const compress = require("./utilities").en
const decompress = require("./utilities").de
const { sortLeaderboardData, handlePostRequest, trunc, getLevelFilePath, paginateArray } = require("./utilities")
const backupController = require("./backup.js")
const logError = require("./log").logError
const logDebug = require("./log").logDebug
const log = require("./log").log
const mgdog = require("./dog").image
const logenabled = require("./log").LOGSENABLED
console.log("reading favicon.ico...")
const favicon = fs.readFileSync("./favicon.ico")
console.log("favicon read")
console.log("reading sitemap.txt...")
const sitemap = fs.readFileSync("./sitemap.txt")
console.log("sitemap read!")
console.log("reading jsDocInterfaces.js...")
const jsDocInterfaces = fs.readFileSync("./jsDocInterfaces.js")
console.log("interfaces read!")

const STRVALUES = {
    CORRECT: "{\"value\": true}",
    INCORRECT: "{\"value\": false}",
    STRINGDATA: "{\"value\": \"%%DATA%%\"}",
    OTHERDATA: "{\"value\": %%DATA%%}",
    MISSINGPARAM: "{\"value\": \"MISSINGPARAMETEROREXTRAPARAMETER\", \"parameter\": \"%%DATA%%\"}",
    BLANKDATA: "{\"username\": \"\",\"password\": \"\"}"
}

const ACCOUNTPARAMS = ["username", "password"]
const ADMINPARAMS = ["apassword"]

// not used
/*const VALUES = {
    CORRECT: {"value": true},
    INCORRECT: {"value": false}
}*/

let accounts = {}
let leaderboards = {}
/** @type Object.<string, Level> */
let levels = {}
let logsEnabled = false // THIS IS CHANGED LATER IN THE SCRIPT - DO NOT EDIT HERE
let bans = {}
let adminpassword = "" // again, this is changed later on

let motd = "" // this is changed later on!!

let availableAccountParams = [
    "cores"
]
/** @type InfoJSON */
let infoJson = {} // this is also set later (but taken from info.json)

let rateLimit = 8 // 8 per 5 seconds

// some stuff I would implement in typescript but obviously im not using typescirpt:

// accounts.bin is like:
// {  "USERNAME": {"p":PASSWORD}  }
// as well as any other values
//
// leaderboards.bin is like:
//
// {
//  "levels": [                       << LIST OF ALL THE LEVELS!
//    [                               << this would be level 0 data
//       {                            << leaderboard entry 1
//         "n": USERNAME,
//         "t": TIME (in milliseconds)
//       }
//    ],
//    [                               << level 1 data
//      
//    ]
//  ]
// }

let rateLimits = {}
// clear every 10 seconds
setInterval(_ => {
    if (Object.keys(rateLimits).length != 0)
        logDebug("reset rate limits for %s people", Object.keys(rateLimits).length)
    rateLimits = {}
}, 5000)

let peopleWhoHaveUploadedALevelWithinThePastTwoMinutes = []

let op = {
    cert: fs.readFileSync("./ssl/cert.pem"),
    key: fs.readFileSync("./ssl/key.pem"),
}

const server = https.createServer(op, async (req, res) => {
    try // yeah... fuck proper error checking, just wrap everything in a try catch. If it errors, just return 500 internal server error
    {
        let url = req.url

        let ip = req.socket.remoteAddress

        if (logenabled)
        {
            let m = new Date()
            let str = m.getHours() + ":" + m.getMinutes() + ":" + m.getSeconds() + " "
            logDebug(str.padEnd(100, "-"))
        }

        logDebug("%s request from %s (from %s)", req.method, ip, url)

        // check if ip is banned
        if (Object.keys(bans).includes(ip))
        {   
            logDebug("user %s is banned", ip)
            serverEndRequest403(res, bans[ip])
            return
        }

        // check rate limiting
        if (!(ip in rateLimits))
        {
            logDebug("add %s to ratelimits", ip)
            rateLimits[ip] = 1
        }
        else if (rateLimits[ip] > rateLimit) // 8 per 5 seconds
        {
            // went over the limit
            logDebug("%s is in rate limitin", ip)
            serverEndRequest429(res)
            return
        }
        else rateLimits[ip]++

        logDebug("%s has %s requests in the last 5 seconds", ip, rateLimits[ip])

        /*
        if (ip !== "92.232.84.6" && ip !== "92.17.98.61")
        {
            // whitelist, block every other ip
            logdbg("%s is off of job", ip)
            // if I don't return anything then they might think this isn't a server perhaps?
            serverEndRequest403(res, "This server is on a whitelist!")
            return
        }
        */
    
        if (req.method == "GET")
        {
            // GET requests
            switch(url)
            {
                case "/":
                    serverEndRequest(res, messages[Math.floor(Math.random() * messages.length)], false)
                    return
                case "/favicon.ico":
                    // basically just serverEndRequest lol
                    res.setHeader("Access-Control-Allow-Origin", "*")
                    res.setHeader("Content-Type", "image/vnd.microsoft.icon")
                    res.write(favicon)
                    res.end()
                    return
                case "/sitemap":
                    // basically just serverEndRequest (part 2) lol
                    res.setHeader("Access-Control-Allow-Origin", "*")
                    res.setHeader("Content-Type", "text/plain")
                    res.write(sitemap)
                    res.write("\n\n\nHere's the jsdoc interfaces if you want to know what parameters may be provided (pulled from `jsDocInterfaces.js!`):\n\n\n")
                    res.write(jsDocInterfaces)
                    res.end()
                    return
            }
        }
        else if (req.method == "POST")
        {
            // POST requests
            let body = await handlePostRequest(req)
            logDebug("client sent <redacted, see next messages> (length: %s)", body.length)

            /** @type DataObject */
            let data = {}
            try {data = JSON.parse(body)} catch(_) {
                logDebug("failed to parse data json")
                serverEndRequest400(res)
                return
            }

            if (data.password) {
                let pass = data.password
                delete data.password
                logDebug(data)
                data.password = pass
            } else logDebug(data)
            
            // try creating a username and password from it
            let username = ""
            let password = ""
            try { username = data.username } catch(_) {}
            try { password = data.password } catch(_) {}

            var passwordChange = false

            if (body == STRVALUES.BLANKDATA)
            {
                // something broke on client when logging in or something
                // might as well reject it now before it tries to parse it
                serverEndRequest422(res)
                return
            }

            logDebug("            ".padEnd(100, "-"))

            switch(url)
            {
                case "/":
                    log("post request to / for some reason, just return some funny string...")
                    serverEndRequest(res, "You think you're clever, sending a <strong>POST</strong> request to the server. Well, you're not.", false)
                    return

                /**
                 * Gets the message of the day (but usually not of the day lol)
                 * @requiresaccount
                 * @returnsstring
                 */
                //#region /motd/get
                case "/motd/get":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }
                    log("%s wants the motd!", username)

                    // the stringify is so line breaks work, then have to use OTHERDATA
                    serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", JSON.stringify(motd)))

                    return

                /**
                 * Gets the server's metadata information (also acts as a /ping)
                 * @returnsobject
                 */
                //#region /ping, /meta
                case "/ping":
                case "/meta":
                    serverEndRequest(res, JSON.stringify({
                        ...infoJson,
                        rateLimit: rateLimit
                    }))
                    return

                /**
                 * Changes someone's password with an account name (calls account/new with "certain params")
                 * @requiresadmin
                 * @requiresaccount
                 * @returnsbool
                 */
                //#region /admin/account/changePassword
                case "/admin/account/changePassword":
                    var reqParam = requireParams(data, [...ADMINPARAMS, ...ACCOUNTPARAMS])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("admin: change password for account %s to %s", username, password)
                    passwordChange = true
                /**
                 * Creates a new account
                 * @param data.username Account name
                 * @param data.password Account password
                 * @returnsbool
                 */
                //#region /account/new
                case "/account/new":
                    // dont check if it's a password change
                    if (!passwordChange)
                    {
                        var reqParam = requireParams(data, [...ACCOUNTPARAMS])
                        if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    }


                    var hashed = crypto.createHash("md5").update(password).digest("hex")

                    let rejectionReason = ""
                    if (username.length < 3)                {rejectionReason = "username_too_short"}
                    if (username.length > 16)               {rejectionReason = "username_too_long" }
                    if (password.length < 7)                {rejectionReason = "password_too_short"}
                    if (password.length > 24)               {rejectionReason = "password_too_long" }
                    if (!/^[ -;=?-~]+$/gm.test(username))   {rejectionReason = "regex_not_matching"}
                    if (!passwordChange) // if this is a change password request then dont
                        if (Object.keys(accounts).includes(username)) {rejectionReason = "account_exists"    }

                    log("New account with name %s, pass %s (hash: %s) (allowed? %s, reason: %s), passwordChange: %s", username, password, hashed, rejectionReason == "" ? "yes" : "no", rejectionReason, passwordChange ? "yes" : "no")

                    if (rejectionReason != "")
                    {
                        serverEndRequest(res, STRVALUES.STRINGDATA.replace("%%DATA%%", rejectionReason))
                        return
                    }

                    accounts[username] = {p: hashed}
                    //log(accounts)

                    // update accounts.bin
                    syncAccountsAndReturnRequest(res)
                    return

                /**
                 * Gets an account with a name (verifies the account exists)
                 * @requiresaccount
                 * @returnsbool
                 */
                //#region /account/get
                case "/account/get":
                    // really shouldnt put stuff before the verifyAccount but oh well
                    log("getting account %s", username)
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    serverEndRequest(res, STRVALUES.CORRECT)
                    return

                /**
                 * Sets an account parameter (can be any type)
                 * @requiresaccount
                 * @param data.param The parameter name
                 * @param data.value The value to set it to
                 * @returnsbool
                 */
                //#region /account/setparam
                case "/account/setparam":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "value", "param"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("set account parameter %s = %s on %s", data.param, data.value, username)

                    if (!availableAccountParams.includes(data.param))
                    {
                        logDebug("param %s doesn't exist", data.param)
                        serverEndRequest422(res)
                        return
                    }

                    accounts[username][data.param] = data.value

                    syncAccountsAndReturnRequest(res)
                    return

                /**
                 * Gets an account parameter (does not have to be string, though is always formatted as one)
                 * @requiresaccount
                 * @param data.param The parameter
                 * @param data.username2 The person who the parameter needs to be grabbed from
                 * @returnsstring
                 */
                //#region /account/getparam
                case "/account/getparam":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "param", "username2"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("get account parameter %s on %s", data.param, data.username2)

                    if (!availableAccountParams.includes(data.param))
                    {
                        logDebug("param %s doesn't exist", data.param)
                        serverEndRequest422(res)
                        return
                    }

                    let value = accounts[data.username2][data.param]
                    serverEndRequest(res, STRVALUES.STRINGDATA.replace("%%DATA%%", value))
                    return

                /**
                 * Creates a new record on a level's leaderboard
                 * @requiresaccount
                 * @param data.level The level id
                 * @param data.time the time you got (any type, though really should be number)
                 * @returnsbool
                 */
                //#region /leaderboard/new
                case "/leaderboard/new":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "level", "time"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    var levelId = parseInt(data.level)
                    var time = data.time

                    log("new leaderboard entry: %s got a %sms time on %s", username, time, levelId)

                    // idk why this needs a null check but idk 
                    if (leaderboards.levels[levelId] === undefined || leaderboards.levels[levelId] == null)
                    {
                        // level hasn't gotten data before
                        logDebug("(leaderboard hasn't gotten data before)")
                        leaderboards.levels[levelId] = []
                    }

                    var i = 0
                    for (let time of leaderboards.levels[levelId])
                    {
                        if (time.n == username)
                        {
                            logDebug("%s has already gotten a time on this level - removing before writing...", username)
                            leaderboards.levels[levelId].splice(i, 1)
                            break
                        }

                        i++
                    }

                    leaderboards.levels[levelId].push({n: username, t: time})

                    // update leaderboards.bin
                    syncLeaderboardsAndReturnRequest(res)
                    return

                /**
                 * Gets the top leaderboard data for a level (first 50, unpaginated)
                 * @requiresaccount
                 * @param data.level The level id
                 * @returnsobject
                 */
                //#region /leaderboard/getTop
                case "/leaderboard/getTop":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "level"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    var levelId = parseInt(data.level)

                    log("get the leaderboard data for level %s (TOP)", levelId)

                    try {var sortedBoardData = [...leaderboards.levels[levelId]].sort(sortLeaderboardData)}
                    catch(_)
                    {
                        // no leaderboard entries exist yet (i presume...)
                        logDebug("no leaderboard entries yet?")
                        serverEndRequest(res, STRVALUES.INCORRECT)
                        return
                    }

                    var first50 = sortedBoardData.slice(0, 50)

                    serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", JSON.stringify(first50)))
                    return

                /**
                 * Gets the newest leaderboard data for a level (first 50, unpaginated)
                 * @requiresaccount
                 * @param data.level The level id
                 * @returnsobject
                 */
                //#region /leaderboard/getNewest
                case "/leaderboard/getNewest":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "level"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    var levelId = parseInt(data.level)

                    log("get the leaderboard data for level %s (NEWEST)", levelId)

                    try {var sortedBoardData = [...leaderboards.levels[levelId]].sort(sortLeaderboardData)}
                    catch(_)
                    {
                        // no leaderboard entries exist yet (i presume...)
                        logDebug("no leaderboard entries yet?")
                        serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", "[]"))
                        return
                    }

                    // already sorted in date order
                    //var sortedBoardData = [...leaderboards.levels[levelId]].sort(sortLeaderboardData)
                    var first50 = sortedBoardData.slice(0, 50)

                    serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", JSON.stringify(first50)))
                    return

                /**
                 * Uploads a level to the server!
                 * @requiresaccount
                 * @param data.title The level title
                 * @param data.description The level description
                 * @param data.unlisted whether it's unlisted or not (bool)
                 * @param data.levelDataString the level data as an uncompressed string
                 * @param data.requestedDifficulty the difficulty in cores (number or string doesnt matter gets parsed at frontend anyway)
                 * @param data.verified Whether the level is verified or not
                 * @returnsbool
                 */
                //#region /level/upload
                case "/level/upload":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "title", "description", "unlisted", "levelDataString", "requestedDifficulty", "verified"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("%s is uploading level! %s: %s (unlisted: %s)\ndatastring has length %s", username, data.title, data.description, data.unlisted ? "yes" : "no", data.levelDataString.length)

                    // check if theyve uploaded recently
                    if (peopleWhoHaveUploadedALevelWithinThePastTwoMinutes.includes(username))
                    {
                        logDebug("uh oh, too fast!")
                        serverEndRequest429(res)
                        return
                    }

                    let id = Math.max(...Object.keys(levels)) + 1

                    if (Number.isNaN(id))
                    {
                        // uhh something went wrong
                        serverEndRequest500(res)
                        return
                    }

                    if (id == -Infinity)
                    {
                        // probably no levels in level table yet
                        id = 1
                    }

                    logDebug("this level will have id %s", id)

                    if (data.title.length > 30)                     { serverEndRequest(res, STRVALUES.INCORRECT); logDebug("title too long!"); return }
                    if (data.description.length > 135)              { serverEndRequest(res, STRVALUES.INCORRECT); logDebug("desc too long!"); return }
                    if (!/^[ -;=?-~]+$/gm.test(data.title))         { serverEndRequest(res, STRVALUES.INCORRECT); logDebug("title not matching regex"); return }
                    if (!/^[ -;=?-~]+$/gm.test(data.description))   { serverEndRequest(res, STRVALUES.INCORRECT); logDebug("desc not matching regex"); return }

                    levels[id] = {
                        title: data.title,
                        description: data.description,
                        unlisted: data.unlisted,
                        author: username,
                        requestedDifficulty: data.requestedDifficulty,
                        featured: false,
                        downloads: 0,
                        ranking: -1,
                        id: id,
                        verified: data.verified,
                        uploadDate: Date.now()
                    }

                    logDebug("writing level file to %s...", getLevelFilePath(id))
                    fs.writeFile(getLevelFilePath(id), compress(data.levelDataString), "utf8", () => {
                        logDebug("written level %s!", id)
                    })

                    logDebug("levels length = %s", Object.keys(levels).length)

                    // make person not upload elvels
                    logDebug("adding to peopleWhoHaveUploadedALevelWithinThePastTwoMinutes...")
                    peopleWhoHaveUploadedALevelWithinThePastTwoMinutes.push(username)
                    setTimeout(_ => {
                        peopleWhoHaveUploadedALevelWithinThePastTwoMinutes.splice(peopleWhoHaveUploadedALevelWithinThePastTwoMinutes.indexOf(username))
                        logDebug("%s left level uploading timeout!", username)
                    }, 120000)

                    syncLevelsAndReturnRequest(res)
                    return

                /**
                 * Gets a single level's metadata with a level id
                 * @requiresaccount
                 * @param data.level The level id (duh)
                 * @returnsobject
                 */
                //#region /level/get/single/metadata
                case "/level/get/single/metadata":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "level"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("getting level metadata with id %s", data.level)
                    serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", JSON.stringify(levels[data.level])))
                    return

                /**
                 * Gets a single level's data with a level id
                 * @requiresaccount
                 * @param data.level The level id (duh)
                 * @param data.alreadyDownloaded
                 * @returnsstring
                 */
                //#region /level/get/single/data
                case "/level/get/single/data":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "level", "alreadyDownloaded"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("getting level data with id %s", data.level)
                    let file = fs.readFileSync(getLevelFilePath(data.level), { encoding: "utf8", flag: "r" });
                    logDebug("path: %s", getLevelFilePath(data.level))
                    let decompressed = decompress(file) // this is only for logging lol
                    logDebug("data string has length %s compressed, %s uncompressed", file.length, decompressed.length)

                    if (!data.alreadyDownloaded)
                        levels[data.level].downloads++
                    
                    syncLevelsButDontReturnRequest(res)
                    serverEndRequest(res, STRVALUES.STRINGDATA.replace("%%DATA%%", decompressed))
                    return

                /**
                 * Gets a list's data
                 * @requiresaccount
                 * @param {number} data.page The page of the list
                 * @param {string} data.list The name of the list
                 * @returnsobject
                 */
                //#region /level/get/list/data
                case "/level/get/list/data":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "page", "list"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("%s is getting list %s data", username, data.list)
                    
                    // if it's the popular list...
                    if (data.list == "popular")
                    {
                        logDebug("list: popular")

                        serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%",
                            JSON.stringify(
                                paginateArray(
                                    data.page,
                                    convertListOfIdsToListOfLevelMetadataObjects(
                                        Object.keys(levels)
                                            .filter(key => !levels[key].unlisted)
                                            .sort((a, b) => levels[b].downloads - levels[a].downloads)
                                    )
                                )
                            )
                        ))
                        return
                    }
                    else if (data.list == "recent")
                    {
                        logDebug("list: recent")

                        serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%",
                            JSON.stringify(
                                paginateArray(
                                    data.page,
                                    convertListOfIdsToListOfLevelMetadataObjects(
                                        Object.keys(levels)
                                            .filter(key => !levels[key].unlisted)
                                            .sort((a, b) => levels[b].id - levels[a].id)
                                    )
                                )
                            )
                        ))
                        return
                    }
                    else if (data.list == "featured")
                    {
                        logDebug("list: featured")
                        serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%",
                            JSON.stringify(
                                paginateArray(
                                    data.page,
                                    convertListOfIdsToListOfLevelMetadataObjects(
                                        Object.keys(levels)
                                            .filter(key => !levels[key].unlisted)
                                            .filter(key => levels[key].featured)
                                            .sort((a, b) => levels[b].id - levels[a].id)
                                    )
                                )
                            )
                        ))
                        return
                    }
                    else if (data.list == "ranked")
                    {
                        logDebug("list: ranked")
                        serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%",
                            JSON.stringify(
                                paginateArray(
                                    data.page,
                                    convertListOfIdsToListOfLevelMetadataObjects(
                                        Object.keys(levels)
                                            .filter(key => !levels[key].unlisted)
                                            .filter(key => levels[key].ranking != -1)
                                            .sort((a, b) => levels[b].id - levels[a].id)
                                    )
                                )
                            )
                        ))
                        return
                    }
                
                    serverEndRequest(res, "{value: undefined}");
                    return

                /**
                 * Gets a list's metadata
                 * @requiresaccount
                 * @param {string} data.list The name of the list
                 * @returnsobject
                 */
                //#region /level/get/list/metadata
                case "/level/get/list/metadata":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "list"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("%s is getting list %s metadata", username, data.list)
                    
                    let levelCount

                    switch(data.list) {
                        case "popular":
                        case "recent":
                            levelCount = Object.keys(levels).length
                            break
                        case "featured":
                            levelCount = Object.values(levels).filter(level => level.featured).length
                            break
                        case "ranked":
                            levelCount = Object.values(levels).filter(level => level.ranking != -1).length
                            break
                        default:
                            logDebug("unknown list LOL")
                            levelCount = -1
                    }

                    logDebug("list length: %s", levelCount)
                    serverEndRequest(res, STRVALUES.STRINGDATA.replace("%%DATA%%", levelCount))
                    return

                /**
                 * Searches (duh)
                 * @requiresaccount
                 * @param {string} query The search query
                 * @param {number} page the page
                 * @returnsobject
                 */
                //#region /level/search/data
                case "/level/search/data":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "query", "page"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }
                    serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", JSON.stringify(
                        paginateArray(
                            data.page,
                            convertListOfIdsToListOfLevelMetadataObjects(
                                Object.keys(levels)
                                    .filter(key => !levels[key].unlisted)
                                    // ignore capitalisation
                                    .filter(key => levels[key].title.toLowerCase().startsWith(data.query.toLowerCase()))
                            )
                        )
                    )))

                    return
                
                    
                /**
                 * Searches (duh) (but gets the metadata)
                 * @requiresaccount
                 * @param {string} query The search query
                 * @param {number} page the page
                 * @returnsobject
                 */
                //#region /level/search/metadata
                case "/level/search/metadata":
                    var reqParam = requireParams(data, [...ACCOUNTPARAMS, "query", "page"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAccount(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }
                    serverEndRequest(res, STRVALUES.STRINGDATA.replace("%%DATA%%", (
                        Object.keys(levels)
                            .filter(key => !levels[key].unlisted)
                            // ignore capitalisation
                            .filter(key => levels[key].title.toLowerCase().startsWith(data.query.toLowerCase()))
                            .length
                    )))
                    return

                // --- ADMIN ENDPOINTS ------------------------------------------------------------------------------------------
                //#region admin endpoints
                /**
                 * Deletes a leaderboard record
                 * @requiresadmin
                 * @param data.level The level id
                 * @param data.username The username of the HACKER
                 * @returnsbool
                 */
                //#region /admin/leaderboard/deleteRecord
                case "/admin/leaderboard/deleteRecord":
                    var reqParam = requireParams(data, [...ADMINPARAMS, "level", "username"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    var levelId = parseInt(data.level)

                    log("admin: deleting record by %s on level %s", username, levelId)
                    
                    var i = 0
                    for (let time of leaderboards.levels[levelId])
                    {
                        if (time.n == username)
                        {
                            logDebug("found record, deleting...")
                            leaderboards.levels[levelId].splice(i, 1)
                            syncLeaderboardsAndReturnRequest(res)
                            return
                        }

                        i++
                    }

                    logDebug("record couldn't be found")
                    serverEndRequest(res, STRVALUES.INCORRECT)
                    return

                /**
                 * Deletes an account (wow)
                 * @requiresadmin
                 * @param data.username The username of the HACKER
                 * @returnsbool
                 */
                //#region /admin/account/deleteAccount
                case "/admin/account/deleteAccount":
                    var reqParam = requireParams(data, [...ADMINPARAMS, "username"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("admin: deleting account %s", username)

                    try {
                        delete accounts[username]
                        logDebug("Deleted!")
                    }
                    catch(_) {
                        logDebug("Failed to delete!")
                        serverEndRequest(res, STRVALUES.INCORRECT)
                        return
                    }

                    syncAccountsAndReturnRequest(res)
                    return

                /**
                 * Gets all the account data on the server
                 * @requiresadmin
                 * @returnsstring
                 */
                //#region /admin/get/getAllAccountData
                case "/admin/get/getAllAccountData":
                    var reqParam = requireParams(data, [...ADMINPARAMS])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("admin: get account data")
                    logDebug(accounts)
                    serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", JSON.stringify(accounts)))
                    return
                    
                /**
                 * Gets the account data for one person
                 * @requiresadmin
                 * @param data.username the person
                 * @returnsstring
                 */
                //#region /admin/get/getSpecificAccountData
                case "/admin/get/getSpecificAccountData":
                    var reqParam = requireParams(data, [...ADMINPARAMS, "username"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("admin: get specific account data for %s", username)
                    logDebug(accounts[username])
                    serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", JSON.stringify(accounts[username])))
                    return

                /**
                 * Gets all the leaderboard data
                 * @requiresadmin
                 * @returnsstring
                 */
                //#region /admin/get/getAllLeaderboardData
                case "/admin/get/getAllLeaderboardData":
                    var reqParam = requireParams(data, [...ADMINPARAMS])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("admin: get leaderboard data")
                    logDebug(leaderboards)
                    serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", JSON.stringify(leaderboards)))
                    return

                /**
                 * Gets the leaderbvoard data for one level
                 * @requiresadmin
                 * @param data.level the level id
                 * @returnsstring
                 */
                //#region /admin/get/getSpecificLeaderboardData
                case "/admin/get/getSpecificLeaderboardData":
                    var reqParam = requireParams(data, [...ADMINPARAMS, "level"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    var levelId = parseInt(data.level)

                    log("admin: get specific leaderboard data for %s", levelId)
                    logDebug(leaderboards[levelId])
                    serverEndRequest(res, STRVALUES.OTHERDATA.replace("%%DATA%%", JSON.stringify(leaderboards[levelId])))
                    return

                /**
                 * Removes a level
                 * @requiresadmin
                 * @param data.level the leve lid
                 * @returnsbool
                 */
                //#region /admin/level/delete
                case "/admin/level/delete":
                    var reqParam = requireParams(data, [...ADMINPARAMS, "level"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    var levelId = parseInt(data.level)
                    log("admin: delete level %s", levelId)
                    logDebug("deleting from memory `levels` arr...")
                    delete levels[levelId]

                    logDebug("deleting file...")
                    fs.unlinkSync(getLevelFilePath(data.level))

                    logDebug("syncing memory levels bin...")
                    syncLevelsAndReturnRequest(res)

                    logDebug(levels)

                    logDebug("done!")
                    return

                /**
                 * Sets a parameter on a level
                 * @requiresadmin
                 * @param data.level the leve lid
                 * @param data.param the parameter
                 * @param data.value the favlue
                 * @returnsbool
                 */
                //#region /admin/level/setparam
                case "/admin/level/setparam":
                    var reqParam = requireParams(data, [...ADMINPARAMS, "level", "param", "value"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("set param %s=%s on %s", data.param, data.value, data.level)

                    levels[data.level][data.param] = data.value

                    syncLevelsAndReturnRequest(res)
                    return

                /**
                 * Sets the motd
                 * @requiresadmin
                 * @param data.motd the message of the day
                 * @returnsbool
                 */
                //#region /admin/motd/setMotd
                case "/admin/motd/setMotd":
                    var reqParam = requireParams(data, [...ADMINPARAMS, "motd"])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    log("admin: set motd to %s", data.motd)

                    motd = data.motd
                    fs.writeFile("data/motd", motd, {}, (err => {
                        if (err)
                            logError(5, "error writing to motd file!")
                    }))

                    serverEndRequest(res, STRVALUES.CORRECT)
                    return

                /**
                 * Manually triggers a backup of all the BINs
                 * @requiresadmin
                 * @returnsbool
                 */
                //#region /admin/backup/triggerBinBackup
                case "/admin/backup/triggerBinBackup":
                    var reqParam = requireParams(data, [...ADMINPARAMS])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    backupController.backupBins()

                    serverEndRequest(res, STRVALUES.CORRECT)
                    return

                /**
                 * Manually triggers a backup of all the levels
                 * @requiresadmin
                 * @returnsbool
                 */
                //#region /admin/backup/triggerLevelBackup
                case "/admin/backup/triggerLevelBackup":
                    var reqParam = requireParams(data, [...ADMINPARAMS])
                    if (reqParam != "") { serverEndRequest(res, STRVALUES.MISSINGPARAM.replace("%%DATA%%", reqParam)); return }
                    if (!verifyAdminPassword(data)) { serverEndRequest(res, STRVALUES.INCORRECT); return }

                    backupController.backupLevels()

                    serverEndRequest(res, STRVALUES.CORRECT)
                    return

                /**
                 * Secret secret admin endpoint
                 */
                //#region /admin/debug
                case "/admin/debug":
                    // hidden debug endpoint which can be enabled whenever
                    log("someone found the admin/debug?? WHAT???")
                    serverEndRequest(res, "shhh, this does exist but nobody knows about it")
                    return


                    logDebug(levels)
                    serverEndRequest(res, STRVALUES.CORRECT)
                    return

                //#endregion
                // --- ADMIN ENDPOINTS END ---------------------------------------------------------------------------------------

                /*
                case "/leaderboard/getAround":
                    if (!verifyAccount(data)) { serverEndRequest(res, VALUES.INCORRECT); return }
                    var levelId = parseInt(data.level)

                    var sortedBoardData = leaderboards.levels[levelId].toSorted(sortLeaderboardData)

                    // do shit here

                    return
                */
            }
        }
    
        serverEndRequest(res, "404 this is so sad, like this dog:<br/><img src=\"" + mgdog + "\"/>", false)
    }
    catch(err)
    {
        // warn in console and return 500 if there is an error
        console.warn(err)
        serverEndRequest500(res)
    }
})

/**
 * @param {*} $accounts 
 * @param {*} $leaderboards 
 * @param {boolean} $logs 
 * @param {*} $bans 
 * @param {string} $adminpassword
 * @param {*} $levels
 * @param {number} port
 * @param {number} ipOctet3
 * @param {number} ipOctet4
 * @param {object} $infoJson
 * @param {string} $motd 
 */
function run($accounts, $leaderboards, $logs, $bans, $adminpassword, $levels, port, ipOctet3, ipOctet4, $infoJson, $motd)
{
    leaderboards = $leaderboards
    accounts = $accounts
    logsEnabled = $logs
    bans = $bans
    adminpassword = $adminpassword
    levels = $levels
    infoJson = $infoJson
    motd = $motd
    
    console.log("%s accounts loaded", Object.keys(accounts).length)
    console.log("%s leaderboard levels loaded", leaderboards.levels.length)
    console.log("%s bans loaded", Object.keys(bans).length - 1) // -1 for the comment at the start
    console.log("%s levels loaded", Object.keys(levels).length)
    console.log("should log: %s", logsEnabled)
    console.log("provided ip: 192.168.%s.%s:%s", ipOctet3, ipOctet4, port)
    
    logDebug("Admin password: %s!", adminpassword)

    let ip = `192.168.${ipOctet3}.${ipOctet4}`

    server.listen(port, ip, () => {
        console.log("Server is listening at %s:%s", ip, port)
    })
}

async function syncLeaderboardsAndReturnRequest(res)
{
    fs.writeFile("./data/leaderboards.bin", compress(JSON.stringify(leaderboards)), err => {
        if (err) 
        {
            serverEndRequest500(res)
            logError(5, "Error writing to leaderboards!")
        }

        // file written successfully
        serverEndRequest(res, STRVALUES.CORRECT)
    })
}

async function syncAccountsAndReturnRequest(res)
{
    fs.writeFile("./data/accounts.bin", compress(JSON.stringify(accounts)), err => {
        if (err) 
        {
            serverEndRequest500(res)
            logError(5, "Error writing to accounts!")
        }

        // file written successfully
        serverEndRequest(res, STRVALUES.CORRECT)
    })
}

async function syncLevelsAndReturnRequest(res)
{
    fs.writeFile("./data/levels.bin", compress(JSON.stringify(levels)), err => {
        if (err) 
        {
            serverEndRequest500(res)
            logError(5, "Error writing to levels!")
        }

        // file written successfully
        serverEndRequest(res, STRVALUES.CORRECT)
    })
}

async function syncLevelsButDontReturnRequest(res)
{
    fs.writeFile("./data/levels.bin", compress(JSON.stringify(levels)), err => {
        if (err) 
        {
            logError(5, "Error writing to levels!")
        }

        // file written successfully
        //serverEndRequest(res, STRVALUES.CORRECT)
    })
}

/**
 * @param {Array<number>} listOfIds 
 * @returns {Array<Level>}
 */
function convertListOfIdsToListOfLevelMetadataObjects(listOfIds) { return listOfIds.map(id => { return levels[id] ? levels[id] : { id: id, note: "This level needs to be removed!" } }) }

/**
 * @returns {boolean}
 */
function verifyAccount(data)
{
    try {accounts[data.username].p}
    catch(_) { logDebug("%s is checking password (account doesn't exist)", data.username) }
    
    var hashed = crypto.createHash("md5").update(data.password).digest("hex")
    try {accounts[data.username].p}
    catch(_) {log("Account %s doesn't exist!", data.username); return false} // account doesnt exist

    logDebug("%s is checking password (account definitely exists)", data.username)
    logDebug("HASHES: %s == %s",  trunc(hashed), trunc(accounts[data.username].p))
    logDebug("password is correct? %s", accounts[data.username].p == hashed ? "yes" : "no")

    // account exists, pass might be wrong though... have to check

    if (accounts[data.username].p != hashed) log("Account %s has wrong password!", data.username)

    return accounts[data.username].p == hashed
}

/**
 * @returns {boolean}
 */
function verifyAdminPassword(data)
{
    logDebug("checking admin password (%s) against %s", adminpassword, data.apassword)
    return data.apassword == adminpassword
}

/**
 * @param {Object} data
 * @param {Array<string>} params 
 * @returns {Object} The parameter missing, or "" if there is none
 */
function requireParams(data, params)
{
    // missing parameter check
    try {
        params.forEach(neededParam => {
            if (!(neededParam in data))
            {
                logDebug("parameter %s needed!", neededParam)
                throw(neededParam)
            }
        })
    } catch(paramName) {return paramName}

    // extra parameter check
    try {
        Object.keys(data).forEach(givenParam => {
            if (!params.includes(givenParam))
            {
                logDebug("parameter %s unnecessary!", givenParam)
                throw(givenParam)
            }
        })
    } catch(paramName) {return paramName}

    return ""
}

/**
 * Returns the data and stuff
 * @param {https.ServerResponse} res
 * @param {string} data
 */
function serverEndRequest(res, data="", jsonData=true)
{
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Content-Type", jsonData ? "application/json" : "text/html")
    if (jsonData)
        res.write(data)
    else
        res.write(`<!DOCTYPE html><html><head><style>*{font-family:sans-serif}</style><title>Flikk's Super Secret Backend</title></head><body>${data}</body></html>`)
    res.end()
}

/**
 * Returns a 500 Internal Server Error
 * @param {https.ServerResponse} res
 */
function serverEndRequest500(res)
{
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.statusCode = 500
    res.end("500 Internal Server Error")
}

/**
 * Returns a 429 Too Many Requests
 * @param {https.ServerResponse} res
 */
function serverEndRequest429(res)
{
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.statusCode = 429
    res.end("429 Too Many Requests")
}

/**
 * Returns a 422 Unprocessable Content
 * @param {https.ServerResponse} res
 */
function serverEndRequest422(res)
{
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.statusCode = 422
    res.end("422 Unprocessable Content")
}

/**
 * Returns a 403 Forbidden
 * @param {https.ServerResponse} res
 */
function serverEndRequest403(res, reason)
{
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.statusCode = 403
    res.write(JSON.stringify({reason: reason}))
    res.end("403 Forbidden")
}

/**
 * Returns a 400 Bad Request
 * @param {https.ServerResponse} res
 */
function serverEndRequest400(res, reason)
{
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.statusCode = 400
    res.write(JSON.stringify({reason: reason}))
    res.end("400 Bad Request")
}

module.exports = { run }
