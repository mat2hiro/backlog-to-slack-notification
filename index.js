'use strict'
const api = require('./api');
const cors = require('cors');
const validateSlackToken = require('./validateSlackToken');

const corsHandler = cors({ origin: true });

exports.bl2sl = (req, res) => {
    console.log(JSON.stringify(req.body))
    corsHandler(req, res, () => {
        switch (req.method) {
            case 'POST':
                if (req.url !== '/setup') {
                    api.chat(req, res);
                } else if (validateSlackToken(req)) {
                    api.setup(req, res);
                } else {
                    res.status(400).send('not allowed');
                }
                break;
            default:
                res.status(400).send('not allowed');
                break;
        }
    });
};
