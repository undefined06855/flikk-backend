// ------- (this file can be publicly accessed from /sitemap, so dont keep anything secret hidden here!) ------

/**
 * @typedef DataObject
 * @property {string} username
 * @property {string} password
 * 
 * @property {string} param
 * @property {string} value
 * @property {string} username2
 * 
 * @property {number} page
 * @property {"recent"|"featured"|"ranked"|"popular"} list
 * 
 * @property {string} query
 * 
 * @property {number} level
 * @property {number} time
 * @property {boolean} alreadyDownloaded
 * 
 * @property {string} title
 * @property {string} description
 * @property {boolean} unlisted
 * @property {string} levelDataString
 * @property {string} requestedDifficulty
 * @property {boolean} verified
 * 
 * @property {string} apassword
 */

/**
 * @typedef Level
 * @property {string} title
 * @property {string} description
 * @property {boolean} unlisted
 * @property {string} author
 * @property {number} requestedDifficulty
 * @property {boolean} featured
 * @property {number} downloads
 * @property {number} ranking
 * @property {boolean} [verified]
 * @property {number} [uploadDate]
*/

/**
 * @typedef InfoJSON
 * @property {string} version
 * @property {string} description
 * @property {string} GITVER !!THIS IS NOT SET IN INFO.JSON
 * @property {Array<string>} features
 */

// ------- end
