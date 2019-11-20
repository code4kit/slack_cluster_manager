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
const { WebClient, RTMClient } = require('@slack/client');
const cluster = require('./lib/model/cluster');
const packageInfo = require('../package.json');

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

/**
 * slack bot token
 * @type {String}
 */
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN.toString();

/**
 * slack user token
 * @type {{String}}
 */
const SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN.toString();

/**
 * slack user ID
 */
const SLACK_USER_ID = process.env.SLACK_USER_ID.toString();

/**
 * slack bot ID
 */
const SLACK_BOT_ID = process.env.SLACK_BOT_ID.toString().toUpperCase();

/**
 * slack rtm client
 * @type {String}
 */
const rtmClient = new RTMClient(SLACK_BOT_TOKEN);

/**
 * slack web client
 * @type {Object}
 */
const webClient = new WebClient(SLACK_USER_TOKEN);

/**
 * slack web client for UI
 * @type {Object}
 */
const webClientForUI = new WebClient(SLACK_BOT_TOKEN);

/**
 * slack emoji
 * @type {String}
 */
const EMOJI = process.env.SLACK_EMOJI;

/**
 * This connect to NeDB
 * @param {String}
 */
const DB_PATH = process.env.DB_PATH;

/**
 * @param {String}
 */
const SYSTEM_MODE = process.env.SYSTEM_MODE;
/**
 * @param {String}
 */
const SLACK_WORKSPACE = process.env.SLACK_WORKSPACE.toString();
/**
 * @param {String}
 */
const LEGACY_TOKEN = process.env.LEGACY_TOKEN.toString();

const webClientLegacy = new WebClient(LEGACY_TOKEN);
/**
 * @param {Object} event
 */
const nedb = require('./lib/model/_nedb')(
  DB_PATH,
  SYSTEM_MODE
);

/**
 * @type {{String: RegExp}}
 */
const slackMsgRegExp = {
  update: new RegExp(`^${EMOJI}( |)update( |)(([a-z]||-|_|[0-9])+)( |)((<@U(([A-Z]|[0-9])+)>( |))*)$`, 'i'),
  mention: new RegExp(`^${EMOJI}( |)mention( |)(([a-z]||-|_|[0-9])+)( |)(.+)$`, 'i'),
  invite: new RegExp(`^${EMOJI}( |)invite( |)(([a-z]||-|_|[0-9])+)$`, 'i'),
  kick: new RegExp(`^${EMOJI}( |)kick( |)(([a-z]||-|_|[0-9])+)$`, 'i'),
  list: new RegExp(`^${EMOJI}( |)list$`, 'i')
};

rtmClient.on('message', (event) => {
  if (event.user === SLACK_BOT_ID || !('text' in event)) {
    return;
  }
  if (event.text.match(slackMsgRegExp.update)) {
    console.log('do updateCmd');
    updateCmd(event);
    console.log('done updateCmd');
  } else if (event.text.match(slackMsgRegExp.mention)) {
    console.log('do mentionCmd');
    mentionCmd(event);
    console.log('done mentionCmd');
  } else if (event.text.match(slackMsgRegExp.invite)) {
    console.log('do inviteCmd');
    inviteCmd(event);
    console.log('done inviteCmd');
  } else if (event.text.match(slackMsgRegExp.kick)) {
    console.log('do kickCmd');
    kickCmd(event);
    console.log('done kickCmd');
  } else if (event.text.match(slackMsgRegExp.list)) {
    console.log('do listCmd');
    listCmd(event);
    console.log('done listCmd');
  }
});

rtmClient.start();

/**
 * The function of this command is to register, update, and delete a cluster.
 * @param {Object} slackEvent
 * @async
 */
const updateCmd = async (slackEvent) => {
  const args = slackEvent.text.trim().split(/update|<@|>/);
  const gotClusterName = args[1].trim();
  const membersArray = args.filter((arg) => {
    return (arg[0] === 'U');
  });
  const resultOfUpdated = await cluster.update(nedb, gotClusterName, membersArray);
  console.log(resultOfUpdated);
  await replyToThread(slackEvent.channel, slackEvent.ts, `${resultOfUpdated.message}: ${resultOfUpdated.cluster_name}`);
};

/**
 * the function of this command is to send message to chosen cluster.
 * @param {String} slackEvent
 * @async
 */
const mentionCmd = async (slackEvent) => {
  const gotClusterName = slackEvent.text.split(/mention/i)[1].trim().split(' ')[0].trim();
  const msgForSending = slackEvent.text.split(gotClusterName)[1].trim().toString();
  const targetCluster = await cluster.find(nedb, gotClusterName);
  if (targetCluster) {
    for (const memberId of targetCluster.members) {
      const dmChannel = await webClientForUI.im.open({
        user: memberId
      });
      await webClientForUI.chat.postMessage({
        channel: dmChannel.channel.id,
        text: `${msgForSending}\nhttps://${SLACK_WORKSPACE}/archives/${slackEvent.channel}/p${slackEvent.ts}`
      });
    }
  } else {
    replyToThread(slackEvent.channel, slackEvent.ts, 'This cluster is not found');
  }
};

/**
 * the object of this command is to invite registered members in a cluster for channel
 * @param {Object} slackEvent
 */
const inviteCmd = async (slackEvent) => {
  const gotClusterName = slackEvent.text.split(/invite/i)[1].trim();
  const targetCluster = await cluster.find(nedb, gotClusterName);
  if (!targetCluster) {
    return replyToThread(slackEvent.channel, slackEvent.ts, 'This cluster is not found');
  }
  const channelInfo = await webClientForUI.channels.info({
    channel: slackEvent.channel
  });
  const clusterMembers = await cluster.findMembers(nedb, gotClusterName);
  const notExistManagerInSlack = channelInfo.channel.members.indexOf(SLACK_USER_ID) === -1;
  console.log(channelInfo.channel.members);
  const ExistManagerInCluster = clusterMembers.filter((user) => {
    return (user === SLACK_USER_ID);
  });
  const exceptManagerAndInviter = clusterMembers.filter((user) => { return (user !== SLACK_USER_ID && user !== slackEvent.user); }).join(',');
  console.log(notExistManagerInSlack);
  if (notExistManagerInSlack && ExistManagerInCluster.length) {
    console.log('ue');
    await webClientLegacy.channels.join({
      name: `#${channelInfo.channel.name}`
    });
    await webClientLegacy.conversations.invite({
      users: exceptManagerAndInviter,
      channel: slackEvent.channel
    });
  } else if (notExistManagerInSlack) {
    console.log('Just Inside!!');
    await webClientLegacy.channels.join({
      name: `#${clusterMembers}`
    });
    await webClientLegacy.conversations.invite({
      channel: slackEvent.channel,
      users: exceptManagerAndInviter
    });
    await webClient.channels.leave({
      user: SLACK_USER_ID,
      channel: slackEvent.channel
    });
  } else {
    console.log('sita');
    await webClientLegacy.conversations.invite({
      users: clusterMembers.join(','),
      channel: channelInfo.channel.name
    });
  }
  replyToThread(slackEvent.channel, slackEvent.ts, 'Invitation is completed.');
};
/**
 *the object of kick command is to evacuate all registered members in cluster from channel.
 * @param {Object} slackEvent
 */
const kickCmd = async (slackEvent) => {
  const gotClusterName = slackEvent.text.split(/kick/i)[1].trim().split(' ')[0].trim();
  const targetCluster = await cluster.find(nedb, gotClusterName);
  if (!targetCluster) {
    replyToThread(slackEvent.channel, slackEvent.ts, 'This cluster is not found');
  } else {
    const channelMembers = await webClient.conversations.members({
      channel: slackEvent.channel
    });
    const notExistSlackManager = channelMembers.members.indexOf(SLACK_USER_ID) === -1;
    if (notExistSlackManager) {
      await webClient.channel.join({
        user: SLACK_USER_ID,
        channel: slackEvent.channel
      }).catch(err => console.log(err));
      await webClient.conversations.kick({
        channel: slackEvent.channel,
        users: channelMembers.join(',')
      }).catch(err => console.log(err));
      await webClient.channel.leave({
        user: SLACK_USER_ID,
        channel: slackEvent.channel
      }).catch(err => console.log(err));
    } else {
      await webClient.conversations.kick({
        channel: slackEvent.channel,
        users: channelMembers.join(',')
      }).catch(err => console.log(err));
    }
    const dmId = await webClient.im.open({
      user: slackEvent.user
    });
    await webClient.chat.postMessage({
      channel: dmId.channel.id,
      text: 'This kick command is success ＾＾'
    });
  }
};
/**
 * The object of list command display all cluster.
 * @param {Object} slackEvent
 * @async
 */
const listCmd = async (slackEvent) => {
  if (slackEvent.channel[0] !== 'D') {
    replyToThread(slackEvent.channel, slackEvent.ts, 'This cmd only DM.');
    return;
  }
  const infoAllCluster = cluster.find(nedb);
  console.log(JSON.stringify(infoAllCluster));
  replyToThread(slackEvent.channel, slackEvent.ts, JSON.stringify(infoAllCluster));
};

/**
 *
 * @param {String} ch
 * @param {String} ts
 * @param {String} msg
 */
const replyToThread = (ch, ts, msg) => {
  webClientForUI.chat.postMessage({
    channel: ch,
    username: packageInfo.name,
    icon_emoji: EMOJI,
    thread_ts: ts,
    text: msg
  });
};

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
// nedb.remove({}, { multi: true });
