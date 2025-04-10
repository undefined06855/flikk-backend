const utils = require("./utilities")
const fs = require("fs")

try {
    fs.readdirSync("./data/decompressed")
} catch(_) {
    fs.mkdirSync("./data/decompressed")
}

fs.readdirSync("./data/levels/").forEach(file => {
    let compressed = fs.readFileSync("./data/levels/" + file).toString()
    let outPath = "./data/decompressed/" + file.replace(".flcompressed", ".flkk")

    console.log("decompressing %s...", file)
    let decompressed = utils.de(compressed)

    fs.writeFileSync(outPath, decompressed)
})

console.log("donezo funzo")
