'use strict'
const _ = require('lodash')
const { WebClient } = require('@slack/web-api')
const request = require('request-promise-native')
const backlogConst = require('./backlogConst')

const web = new WebClient(process.env.SLACK_API_TOKEN)
/**
 * fetch backlog issue
 * @param projectKey
 * @param issueKey
 */
exports.fetchBacklogIssue = (projectKey, issueKey) =>
  request({
    uri: `${process.env.BACKLOG_BASE_URL}/api/v2/issues/${projectKey}-${issueKey}`,
    qs: {
      apiKey: process.env.BACKLOG_API_KEY
    },
    json: true
  })

/**
 * fetch backlog user list
 * @param projectKey
 */
exports.fetchBacklogUsers = projectKey =>
  request({
    uri: `${process.env.BACKLOG_BASE_URL}/api/v2/projects/${projectKey}/users`,
    qs: {
      apiKey: process.env.BACKLOG_API_KEY
    },
    json: true
  })

/**
 * fetch backlog status list
 * @param projectKey
 */
exports.fetchBacklogStatuses = projectKey =>
  request({
    uri: `${process.env.BACKLOG_BASE_URL}/api/v2/projects/${projectKey}/statuses`,
    qs: {
      apiKey: process.env.BACKLOG_API_KEY
    },
    json: true
  })

/**
 * fetch slack user list
 */
exports.fetchSlackUsers = () => web.users.list()

/**
* fetch backlog projects
*/
exports.fetchBacklogProjects = () =>
  request({
    uri: `${process.env.BACKLOG_BASE_URL}/api/v2/projects`,
    qs: {
      apiKey: process.env.BACKLOG_API_KEY
    },
    json: true
  })

/**
 * fetch backlog webhook
 * @param projectKey
 */
exports.fetchBacklogWebhooks = projectKey =>
  request({
    uri: `${process.env.BACKLOG_BASE_URL}/api/v2/projects/${projectKey}/webhooks`,
    qs: {
      apiKey: process.env.BACKLOG_API_KEY
    },
    json: true
  })

/**
 * set backlog webhook
 * @param projectKey
 * @param channelId
 */
exports.setBacklogWebhook = (projectKey, channelId) =>
  request({
    uri: `${process.env.BACKLOG_BASE_URL}/api/v2/projects/${projectKey}/webhooks`,
    method: 'post',
    qs: {
      apiKey: process.env.BACKLOG_API_KEY
    },
    json: true,
    form: {
      "name": "post message to slack",
      "hookUrl": `${process.env.FUNCTIONS_BASE_URL}/chat?channelId=${channelId}`,
      "allEvent": true
    }
  })

const parseComment = (text) => {
  return text.replace(/\n+/g, '\n')
    .replace(/\*\*(.+)\*\*/g, '*$1*')
    .replace(/~~(.+)~~/g, '~$1~'); //.replace(/\*(.+)\*/g, '_$1_')
}

/**
 * generate message payload for slack
 * @param backlogMessage
 * @param backlogIssue
 * @returns {{as_user: boolean, attachments}}
 */
exports.generateChatMessage = (backlogMessage, backlogIssue, users, statuses) => {
  console.log('backlog-issue: '+JSON.stringify(backlogIssue));
  const backlogKey = `${backlogMessage.project.projectKey}-${backlogMessage.content.key_id}`
  const content = backlogMessage.content;
  content.changes = content.changes ? content.changes : [];
  const statusChange = content.changes.find(ch => { return ch.field === 'status' });
  const statusName = statusChange ?
    `${statuses[statusChange.old_value].name} → ${statuses[statusChange.new_value].name}` : backlogIssue.status.name;
  const priorityChange = content.changes.find(ch => { return ch.field === 'priority' });
  const priorityName = priorityChange ?
    `${backlogConst.priorityNames[priorityChange.old_value]} → ${backlogConst.priorityNames[priorityChange.new_value]}` : backlogIssue.priority.name;
  const fields = [
    {
      value: `*状態*: ${statusName}`,
      short: true
    },
    {
      value: `*優先度*: ${priorityName}`,
      short: true
    }
  ]

  if (backlogIssue.assignee) {
    const asigneeChange = content.changes.find(ch => { return ch.field === 'asigner' });
    const asigneeName = asigneeChange ?
      `${asigneeChange.old_value} → ${asigneeChange.new_value}` : backlogIssue.assignee.name;
    fields.push({
      value: `*担当者*: ${asigneeName}`,
      short: true
    })
  }

  if (backlogIssue.updatedUser) {
    fields.push({
      value: `*更新者*: ${backlogIssue.updatedUser.name}`,
      short: true
    })
  }

  if (content.startDate) {
    fields.push({
      value: `*開始日*: ${content.startDate}`,
      short: true
    });
  }

  if (content.dueDate) {
    const dueDateChange = content.changes.find(ch => { return ch.field === 'limitDate' });
    const dueDateName = dueDateChange ?
      `${dueDateChange.old_value} → ${dueDateChange.new_value}` : content.dueDate;
    fields.push({
      value: `*期限日*: ${dueDateName}`,
      short: true
    });
  }

  if (content.attachments.length) {
    fields.push({
      value: `*ファイル*: ${content.attachments
        .map(at => {
          return `<${process.env.BACKLOG_BASE_URL}/downloadAttachment/${at.id}/${at.name}|${at.name}>`
        }).join(', ')}`,
      short: false
    });
  }

  if (backlogMessage.type == 1 && content.description) {
    fields.push({
      title: '詳細',
      value: parseComment(content.description),
      short: false
    })
  }

  if (content.comment) {
    fields.push({
      title: 'コメント',
      value: parseComment(content.comment.content),
      short: false
    })
  }

  let usermention = ''

  if (users.length > 0) {
    usermention = `<@${users.join('> <@')}>\n`
  }

  return {
    as_user: true,
    attachments: JSON.stringify([
      {
        fallback: `Backlog - ${backlogConst.types[backlogMessage.type]}: ${backlogKey} ${content.summary}`,
        color: statuses[backlogIssue.status.id].color,
        pretext: `${usermention}Backlog - ${backlogConst.types[backlogMessage.type]}`,
        text: `【${backlogIssue.issueType.name}】<${process.env.BACKLOG_BASE_URL}/view/${backlogKey}|${backlogKey}> ${content.summary}`,
        mrkdwn_in: ['pretext', 'text', 'fields'],
        fields: fields
      }
    ])
  }
}

/**
 * post message to slack
 * @param message
 * @param users
 * @returns {Promise.<*[]>}
 */
exports.postChatMessage = (message, channel) => {
  const promises = []
  const payload = _.extend({}, message, { channel: channel })
  console.log('slack-payload: '+JSON.stringify(payload))
  if (payload) {
    promises.push(web.chat.postMessage(payload))
  }
  return Promise.all(promises)
}
