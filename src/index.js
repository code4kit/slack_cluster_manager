'use strict';

/**
 * fileOverView index.js
 *
 * @author Shion0625
 * @author ryuji-cre8ive
 * @author waricoma
 * @author gittanaka
 * @version 1.0.0
 */

require('dotenv').config();
const http = require('http');
const httpServer = require('./lib/http_server');
const { RTMClient } = require('@slack/client');
const slackCommand = require('./lib/model/slackCommand');
/**
 * host
 * @type {String}
 */
const HOST = process.env.HOST.toString();

/**
 * post number
 * @type {Number}
 */
const PORT = parseFloat(process.env.PORT);

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const rtmClient = new RTMClient(SLACK_BOT_TOKEN);
const EMOJI = process.env.SLACK_EMOJI;
const SLACK_BOT_ID = process.env.SLACK_BOT_ID;
/**
 * @type {{String: RegExp}}
 */
const slackMsgRegExp = {
  delete: new RegExp(`^${EMOJI} delete (.+)`, 'gi'),
  create: new RegExp(`^${EMOJI} create (.+)`, 'gi'),
  update: new RegExp(`^${EMOJI} update (.+) (.+)`, 'gi'),
  mention: new RegExp(`^${EMOJI} mention (.+) (.+)`, 'gi'),
  invite: new RegExp(`^${EMOJI} invite (.+)`, 'gi'),
  kick: new RegExp(`^${EMOJI} kick (.+)`, 'gi'),
  list: new RegExp(`^${EMOJI} (list (.+))|list$`, 'i')
};

rtmClient.on('message', (event) => {
  if (event.user === SLACK_BOT_ID || !('text' in event)) {
    return;
  }
  if (event.text.match(slackMsgRegExp.create)) {
    slackCommand.createCluster(event);
  } else if (event.text.match(slackMsgRegExp.delete)) {
    slackCommand.deleteCluster(event);
  } else if (event.text.match(slackMsgRegExp.update)) {
    slackCommand.updateMembers(event);
  } else if (event.text.match(slackMsgRegExp.mention)) {
    slackCommand.mentionCmd(event);
  } else if (event.text.match(slackMsgRegExp.invite)) {
    slackCommand.inviteCmd(event);
  } else if (event.text.match(slackMsgRegExp.kick)) {
    slackCommand.kickCmd(event);
  } else if (event.text.match(slackMsgRegExp.list)) {
    slackCommand.listCmd(event);
  }
});

rtmClient.start();
/**
 * createServer
 * @param {Object} req
 * @param {Object} res
 */
const server = http.createServer((req, res) => {
  httpServer(req, res);
});
server.listen(PORT, HOST, () => {
  console.log(`listening to ${HOST}:${PORT}`);
});
