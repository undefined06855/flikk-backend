const fs = require("fs")
const { log, logDebug } = require("./log")

// (minutes)
let timeBetweenBackups = 60
let timeBetweenLevelBackups = 1440 // (1 day)

logDebug("Time between backups: %sm", timeBetweenBackups)
logDebug("Time between level backups: %sm (%s days)", timeBetweenLevelBackups, timeBetweenLevelBackups / 1440)

function backupBins()
{
    log("STARTING BACKUPS (everything except levels) ---------------")

    let date = new Date()
    let dirName = date.getFullYear() + "" + date.getMonth() + "" + date.getDay() + "T" + date.getHours() + "" + date.getMinutes() + "" + date.getSeconds()
    logDebug("directory will be called %s", dirName)

    console.time("binBackup")

    // create folder
    fs.mkdirSync(`./backups/bins/${dirName}`)

    function backupBin(name)
    {
        fs.copyFileSync(`./data/${name}.bin`, `./backups/bins/${dirName}/${name}.bin`)
    }

    backupBin("accounts")
    logDebug("accounts backed up!")
    backupBin("leaderboards")
    logDebug("leaderboards backed up!")
    backupBin("levels")
    logDebug("levels backed up!")

    console.timeEnd("binBackup")
    log("BACKUPS ENDED -------------------------------------------")
}

function backupLevels()
{
    log("STARTING BACKUPS (levels) --------------------------------")

    let date = new Date()
    let dirName = date.getFullYear() + "" + date.getMonth() + "" + date.getDay() + "T" + date.getHours() + "" + date.getMinutes() + "" + date.getSeconds()
    logDebug("directory will be called %s", dirName)

    console.time("levelBackup")

    fs.cpSync("./data/levels", `./backups/levels/${dirName}`, {recursive: true})

    console.timeEnd("levelBackup")
    log("BACKUPS ENDED -------------------------------------------")
}

function startTimingBackups()
{
    setInterval(backupBins, timeBetweenBackups * 60000)
    setInterval(backupLevels, timeBetweenLevelBackups * 60000)
}

module.exports = { startTimingBackups, backupBins, backupLevels }
