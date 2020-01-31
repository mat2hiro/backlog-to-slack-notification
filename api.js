'use strict'
const _ = require('lodash')
const helper = require('./helper')

exports.chat = async (req, res) => {

    const backlog = req.body
    if (!backlog || !backlog.id) {
        console.error('cannot parse body:', req.body)
        return res.status(400).send('invalid body')
    }

    console.log(`Start ${backlog.project.projectKey}-${backlog.content.key_id}`)

    let slackUsers = []
    let backlogUsers = []

    try {
        [slackUsers, backlogUsers] = await Promise.all([
            helper.fetchSlackUsers(),
            helper.fetchBacklogUsers(backlog.project.projectKey)
        ]);
    } catch(error) {
        console.error(error);
        return res.status(400).send('cannot fetch users');
    }


    const users = []
    if (backlog.content.assignee &&
        (!backlog.createdUser || backlog.createdUser.id !== backlog.content.assignee.id) &&
        (!backlog.updatedUser || backlog.updatedUser.id !== backlog.content.assignee.id)) {
        // find backlog user
        const backlogUser = _.find(backlogUsers, { id: backlog.content.assignee.id })
        // find slack user by slack user's email
        const slackUser = _.find(slackUsers.members, o => o.profile.email === backlogUser.mailAddress)
        if (slackUser) {
            users.push(slackUser.name)
        }
    }

    for (const notification of backlog.notifications) {
        // find backlog user
        const backlogUser = _.find(backlogUsers, { id: notification.user.id })
        if (!backlogUser) {
            continue
        }
        // find slack user by slack user's email
        const slackUser = _.find(slackUsers.members, o => o.profile.email === backlogUser.mailAddress)
        if (!slackUser) {
            continue
        }
        if (!users.includes(slackUser.name)) {
            users.push(slackUser.name)
        }
    }

    const [issue, _s] = await Promise.all([helper.fetchBacklogIssue(backlog.project.projectKey, backlog.content.key_id), helper.fetchBacklogStatuses(backlog.project.projectKey)])

    const statuses = _s.reduce((result, current) => {
        result[current.id] = current;
        return result;
    }, {});

    const channelId = req.query['channelId']

    console.log(`Start message post to ${users.join(',')}`)
    const message = helper.generateChatMessage(backlog, issue, users, statuses)
    try {
        await helper.postChatMessage(message, channelId)
        return res.status(200).send('OK')
    } catch (err) {
        return res.status(500).send(err)
    }
}

exports.setup = async (req, res) => {
    res.status(200).send('OK');
    const body = req.body;
    if (!body || !body.channel_id) {
        console.error('cannot parse body:', req.body);
        return res.status(400).send('invalid body');
    }
    const channelId = body.channel_id;
    console.log(`Start Setup To ${channelId}`);
    try {
        let projectKey = "";
        if (!body.text) {
            const project = (await helper.fetchBacklogProjects()).find(pj => pj.name.toUpperCase() === body.channel_name.toUpperCase());
            projectKey = !!project ? project.projectKey : ""
        } else {
            projectKey = body.text
        }
        if (!projectKey) throw [500, 'cannot fetch projectKey.'];
        const webhooks = await helper.fetchBacklogWebhooks(projectKey)
        const isAlreadySet = webhooks.find(wh => {
            return wh.hookUrl.match(new RegExp(`${process.env.FUNCTIONS_BASE_URL}(.*)channelId=${channelId}`));
        })
        if (isAlreadySet) throw [500, 'webhook is already set.'];
        await helper.setBacklogWebhook(projectKey, channelId);
        console.log(`Start message post to ${channelId}`);
        return helper.postChatMessage({
            as_user: true,
            attachments: JSON.stringify([
                {
                    fallback: "Slack - setup complete",
                    text: "Completed setting webhook!"
                }
            ])
        }, channelId)
    } catch(e) {
        console.log(e)
        const name_id_key = !!body.text ? `projectID or Key: ${body.text}` : `channel_name: ${body.channel_name}`;
        const errorMessage = e.length ? e[1] : "500 internal server error";
        return helper.postChatMessage({
            as_user: true,
            attachments: JSON.stringify([
                {
                    fallback: "Slack - setup fail",
                    text: `Failed setting webhook: ${errorMessage}\nchannel_id: ${channelId}\n${name_id_key}`
                }
            ])
        }, channelId)
    }
}
