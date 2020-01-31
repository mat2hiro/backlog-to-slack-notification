const crypto = require('crypto')
const timingSafeCompare = require('tsscmp')

/**
 * validate slack token
 * @param req
 */
const validateSlackToken = req => {
  try {
    const ts = req.headers['x-slack-request-timestamp'];
    if ((Date.now() / 1000) - ts > 60 * 5) throw new Error("token expited.");
    const signature = req.headers['x-slack-signature'] || "=";
    const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
    const [version, hash] = signature.split('=');
    hmac.update(`${version}:${ts}:${req.rawBody}`);
    return timingSafeCompare(hmac.digest('hex'), hash);
  } catch(e) {
    console.error(e.message);
    return false;
  }
}

module.exports = validateSlackToken;
