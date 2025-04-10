const logDebug = require("./log").logDebug

function en(c){var x="charCodeAt",b,e={},f=c.split(""),d=[],a=f[0],g=256;for(b=1;b<f.length;b++)c=f[b],null!=e[a+c]?a+=c:(d.push(1<a.length?e[a]:a[x](0)),e[a+c]=g,g++,a=c);d.push(1<a.length?e[a]:a[x](0));for(b=0;b<d.length;b++)d[b]=String.fromCharCode(d[b]);return d.join("")}

function de(b){var a,e={},d=b.split(""),c=f=d[0],g=[c],h=o=256;for(b=1;b<d.length;b++)a=d[b].charCodeAt(0),a=h>a?d[b]:e[a]?e[a]:f+c,g.push(a),c=a.charAt(0),e[o]=f+c,o++,f=a;return g.join("")}

// this works dont worry
function sortLeaderboardData(a, b)
{
    return a.t - b.t
}

/**
 * @param {http.IncomingMessage} req 
 * @returns {Promise<string>}
 */
function handlePostRequest(req)
{
    return new Promise(resolve => {
        let body = ""

        function dataFunc(data) { body += data }
    
        function endFunc()
        {
            req.off("data", dataFunc)
            req.off("end", endFunc)

            resolve(body)
        }

        req.on("data", dataFunc)
        req.on("end", endFunc)
    })
}

function trunc(str, maxlength = 9)
{
    if (str.length > maxlength) {
        str = str.substring(0, maxlength - 3) + "...";
    }

    return str
}

function getLevelFilePath(levelID)
{
    return "data/levels/"+levelID+".flcompressed"
}

/**
 * @param {number} page 
 * @param {Array<any>} arr 
 * @param {number} pageLength 
 */
function paginateArray(page, arr, pageLength = 15)
{
    logDebug("page = %s, pageLength = %s, arrLength = %s", page, pageLength, arr.length)
    logDebug("slicing from %s to %s", page * pageLength, page * pageLength + pageLength)
    return arr.slice(page * pageLength, page * pageLength + pageLength)
}

module.exports = { en, de, sortLeaderboardData, handlePostRequest, trunc, getLevelFilePath, paginateArray }
