console.log("starting server...")

let args = process.argv
args.shift()
args.shift()

// test if files need to be generated before ANYTHING
if (args.includes("--generate"))
{
    const fs = require("fs")
    console.log("generating default files...")

    // when writing at first they dont need to be compressed - they get compressed when they sync
    console.log("creating data dir...")
    try {fs.mkdirSync("data/")} catch(_) {console.log("already exists?")}
    console.log("creating accounts.bin...")
    try {fs.writeFileSync("data/accounts.bin", "{}", {flag: "wx"})} catch(_) {console.log("already exists?")}
    console.log("creating leaderboards.bin...")
    try {fs.writeFileSync("data/leaderboards.bin", "{\"levels\":[]}", {flag: "wx"})} catch(_) {console.log("already exists?")}
    console.log("creating levels.bin...")
    try {fs.writeFileSync("data/levels.bin", "{}", {flag: "wx"})} catch(_) {console.log("already exists?")}
    console.log("creating levels dir...")
    try {fs.mkdirSync("data/levels")}catch(_) {console.log("already exists?")}
    console.log("creating backups dir...")
    try {fs.mkdirSync("backups/")}catch(_) {console.log("already exists?")}
    console.log("creating backups/bins dir...")
    try {fs.mkdirSync("backups/bins")}catch(_) {console.log("already exists?")}
    console.log("creating backups/levels dir...")
    try {fs.mkdirSync("backups/levels")}catch(_) {console.log("already exists?")}
    console.log("creating info.json...")
    try {fs.writeFileSync("info.json", `{\n"version": "--TODO-VERSION",\n"description": "",\n"": "The available features are accounts, levels, leaderboards, lists, admin, motd, backups (please delete this!)",\n"features": []\n}\n`, {flag: "wx"})}catch(_) {console.log("already exists?")}
    console.log("creating motd...")
    try {fs.writeFileSync("data/motd", "Please remember to set the MOTD!", {flag: "wx"})} catch(_) {console.log("already exists?")}

    console.log("done!")
    return
}

!(async () => {
/** @type InfoJSON */
let infoJson = {}
try
{
    infoJson = JSON.parse(require("fs").readFileSync("info.json"))
}
catch(_)
{
    console.log("Please run with --generate to generate the needed files!")
    return
}

let VERSION = infoJson.version
if (VERSION == "--TODO-VERSION")
{
    console.log("Please setup the info.json!!!")
    return
}
if (infoJson[""])
{
    console.log("Please remove the available features comment!!!")
    return
}
console.log("Getting git commit hash (--short)...")
async function getGitVer() {
    return new Promise((resolve, reject) => {
        require("child_process").exec("git rev-parse --short HEAD", (err, stdout, stderr) => {
            if (stderr) reject(stderr)
            else resolve(stdout)
        })
    })
}

if (!process.env.ADMIN_PASSWORD) {
    console.log("Please set ADMIN_PASSWORD environment variable!! (Do this in the run.bat file perhaps)")
    return
}

try {
    fs.readFileSync("./ssl/cert.pem")
} catch(_) {
    console.log("Please add ssl certificates to the ./ssl/cert.pem and ./ssl/key.pem files!")
    return
}

let GITVER = await getGitVer()
let ADMINPASSWORD = process.env.ADMIN_PASSWORD
let DESCRIPTION = infoJson.description
let FEATURES = infoJson.features
console.log("Commit hash: %s (adding to infojson in memory)", GITVER)
infoJson.GITVER = GITVER.toString()
console.log("------------------------------------")
console.log(`Server Info:
- Version: ${VERSION},
- Description: ${DESCRIPTION},
- Supports features: ${FEATURES.toString().replaceAll(",", ", ")}
`)
console.log("------------------------------------")

if (args.includes("--help"))
{
    // ahh help!
    console.log("-- Help for FLIKK backend:")
    console.log("")
    console.log("use --port to change the port")
    console.log("use --ipOctet3 and --ipOctet4 to specify the IP (192.168.ipOctet3.ipOctet4)")
    console.log("use --generate to generate blank \"database\" bin files")
    return
}

forcePort = undefined
if (args.includes("--port"))
{
    let portArgIndex = args.indexOf("--port") + 1
    forcePort = args[portArgIndex]
}
else
{
    console.log("--port has to be specified!")
    return
}

forceOctet3 = 0
if (args.includes("--ipOctet3"))
{
    let aIndex = args.indexOf("--ipOctet3") + 1
    forceOctet3 = args[aIndex]
}
else
{
    console.log("--ipOctet3 has to be specified!")
    return
}

forceOctet4 = 0
if (args.includes("--ipOctet4"))
{
    let aIndex = args.indexOf("--ipOctet4") + 1
    forceOctet4 = args[aIndex]
}
else
{
    console.log("--ipOctet4 has to be specified!")
    return
}
// options
const LOGSENABLED = require("./log").LOGSENABLED // edit in the log.js file! NOT HERE

if (LOGSENABLED)
    console.warn("Having logs enabled is dangerous - usernames and passwords are shown!")

const fs = require("fs")
const decode = require("./utilities").de
console.log("reading accounts.bin...")
let accounts = JSON.parse(decode(fs.readFileSync("data/accounts.bin", "utf8")))
console.log("reading leaderboards.bin...")
let leaderboards = JSON.parse(decode(fs.readFileSync("data/leaderboards.bin", "utf8")))
console.log("reading levels.bin...")
let levels = JSON.parse(decode(fs.readFileSync("data/levels.bin", "utf8")))
console.log("reading ipBans.json...")
let ipBans = JSON.parse(fs.readFileSync("ipBans.json", "utf8"))
console.log("reading last motd...")
let motd = fs.readFileSync("data/motd").toString()
console.log("motd: %s", motd)

console.log("---- backupController: --------------------------")
let backupController = require("./backup.js")
//backupController.startTimingBackups()

console.log("---- server: ------------------------------------")
let server = require("./server.js")
server.run(accounts, leaderboards, LOGSENABLED, ipBans, ADMINPASSWORD, levels, forcePort, forceOctet3, forceOctet4, infoJson, motd)
})()