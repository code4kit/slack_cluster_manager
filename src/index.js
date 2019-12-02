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
  update: new RegExp(`^${EMOJI} update (.+)`),
  mention: new RegExp(`^${EMOJI} (mention [A-Z]|[0-9])`, 'i'),
  invite: new RegExp(`^${EMOJI} invite (.+)`),
  kick: new RegExp(`^${EMOJI} (kick [A-Z]|[0-9])`, 'i'),
  list: new RegExp(`^${EMOJI} (list [A-Z]|[0-9])|list$`, 'i')
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
  try {
    const args = slackEvent.text.trim().split(/update|<@|>/);
    const gotClusterName = args[1].trim();
    const membersArray = args.filter((arg) => {
      return (arg[0] === 'U');
    });

    if (gotClusterName.match(new RegExp('^[a-z0-9\-\_]+$'))) {
      const resultOfUpdated = await cluster.update(nedb, gotClusterName, membersArray);
      console.log(resultOfUpdated);
      await replyToThread(slackEvent.channel, slackEvent.ts, `${resultOfUpdated.message}: ${resultOfUpdated.cluster_name}`);
    } else {
      await replyToThread(slackEvent.channel, slackEvent.ts, `<${gotClusterName}> is an invalid cluster name.`)
    }
  } catch (error) {
    console.log(`Unable to trim <${slackEvent.text}>`)
  }
};



/**
 * the function of this command is to send message to chosen cluster.
 * @param {String} slackEvent
 * @async
 */
const mentionCmd = async (slackEvent) => {
  const clusterName = slackEvent.text.split(/mention/i)[1].trim().split(' ')[0].trim();
  const msgForSending = slackEvent.text.split(clusterName)[1].trim().toString();

  // find the cluster 
  const targetCluster = await cluster.findMembers(nedb, clusterName);

  if (targetCluster) {
    if (msgForSending) {
      for (memberId of targetCluster.members) {
        const message = `${msgForSending} https://${SLACK_WORKSPACE}.slack.com/archives/${slackEvent.channel}/p${slackEvent.event_ts}`;
        directMessage(memberId, message);
      }
    }
    else {
      replyToThread(slackEvent.channel, slackEvent.ts, "Please provide the message you want to send.\n\n");
    }
  } else {
    const msg = "Please make sure the cluster name is correct!!."
    replyToThread(slackEvent.channel, slackEvent.ts, msg);
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
  const existingMember = await webClient.conversations.members({
    channel: slackEvent.channel
  });
  const clusterMembers = await cluster.findMembers(nedb, gotClusterName);
  const inviteMembers = clusterMembers.members.filter((member) => {
    if (!existingMember.members.includes(member)) return member;
  });
  await webClientLegacy.conversations.invite({
    users: inviteMembers.join(","),
    channel: slackEvent.channel
  });
  replyToThread(slackEvent.channel, slackEvent.ts, 'Invitation Complete!');
};



/**
 *the object of kick command is to evacuate all registered members in cluster from channel.
 * @param {Object} slackEvent
 */
const kickCmd = async (slackEvent) => {
  const gotClusterName = slackEvent.text.split(/kick/i)[1].trim().split(' ')[0].trim();
  const targetCluster = await cluster.findMembers(nedb, gotClusterName);
  const channel_name = await getChannelName(slackEvent);
  if (!targetCluster) {
    replyToThread(slackEvent.channel, slackEvent.ts, 'This cluster is not found');
  } else {
    const channel = await webClient.conversations.members({
      channel: slackEvent.channel
    });
    for (member of targetCluster.members) {
      if (channel.members.includes(member)) {
        kickMembers(member, slackEvent)
      }
    }
    const message = `<@${slackEvent.user}> kicked ${gotClusterName} from ${channel_name} https://${SLACK_WORKSPACE}.slack.com/archives/${slackEvent.channel}/p${slackEvent.event_ts}`;
    directMessage(SLACK_USER_ID, message);
  }
};



const kickMembers = async (memberId, slackEvent) => {
  const channel_name = await getChannelName(slackEvent);
  if (memberId !== slackEvent.user) {
    await webClient.conversations.kick({
      channel: slackEvent.channel,
      user: memberId
    }).then(async () => {
      const message = `<@${slackEvent.user}> kicked you from ${channel_name}`;
      directMessage(memberId, message);
    }).catch(err => console.log(err));

  } else if (memberId === slackEvent.user) {
    await webClient.conversations.leave({
      channel: slackEvent.channel
    }).catch((error) => console.log(error));
  }
};



const getChannelName = async (slackEvent) => {
  let channel_name = await webClient.channels.info({
    channel: slackEvent.channel
  });
  return channel_name.channel.name;
};


const directMessage = async (userId, msg) => {
  const dmChannel = await webClientForUI.im.open({
    user: userId
  });
  await webClientForUI.chat.postMessage({
    text: msg,
    channel: dmChannel.channel.id
  });
};



/**
 * The object of list command display all cluster.
 * @param {Object} slackEvent
 * @async
 */
const listCmd = async (slackEvent) => {
  const gotClusterName = slackEvent.text.split(/list/i)[1].trim().split(' ')[0].trim();
  if (slackEvent.channel[0] !== 'D') {
    replyToThread(slackEvent.channel, slackEvent.ts, 'This cmd only DM.');
    return;
  }
  let infoAllCluster = await cluster.find(nedb, gotClusterName);
  console.log(infoAllCluster);
  if (!infoAllCluster) {
    replyToThread(slackEvent.channel, slackEvent.ts, "Nothing to return");
  } else {
    let msg = '';
    infoAllCluster = gotClusterName ? [infoAllCluster] : infoAllCluster
    for (data of infoAllCluster) {
      const members = data.members.map(member => `<@${member}>`);
      msg += `:file_folder: Cluster_name ${data.cluster_name}\n\n Members:sunglasses: ${members}\n`;
    }
    replyToThread(slackEvent.channel, slackEvent.ts, msg);
  }
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
