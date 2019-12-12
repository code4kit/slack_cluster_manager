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
const CronJob = require('cron').CronJob;
const fetch = require('fetch').fetchUrl;

// Environment Variables
const PORT = process.env.PORT;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN;
const SLACK_USER_ID = process.env.SLACK_USER_ID;
const SLACK_BOT_ID = process.env.SLACK_BOT_ID;
const EMOJI = process.env.SLACK_EMOJI;
const DB_PATH = process.env.DB_PATH;
const SYSTEM_MODE = process.env.SYSTEM_MODE;
const SLACK_WORKSPACE = process.env.SLACK_WORKSPACE;
const LEGACY_TOKEN = process.env.LEGACY_TOKEN;

const rtmClient = new RTMClient(SLACK_USER_TOKEN);
const webClient = new WebClient(SLACK_USER_TOKEN);
const webClientForUI = new WebClient(SLACK_BOT_TOKEN);
const webClientLegacy = new WebClient(LEGACY_TOKEN);

/**
 * @param {Object} event
 */
const nedb = require('./lib/model/_nedb')(DB_PATH, SYSTEM_MODE);

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

rtmClient.on('message', event => {
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
const updateCmd = async slackEvent => {
  try {
    const args = slackEvent.text.trim().split(/update|<@|>/);
    const gotClusterName = args[1].trim();
    const membersArray = args.filter(arg => {
      return arg[0] === 'U';
    });

    const isVirtualCompany = slackEvent.text.indexOf(' --vc') !== -1;

    if (gotClusterName.match(new RegExp('^[a-z0-9-_]+$'))) {
      const resultOfUpdated = await cluster.update(
        nedb,
        gotClusterName,
        membersArray,
        isVirtualCompany
      );

      await replyToThread(
        slackEvent.channel,
        slackEvent.ts,
        `${resultOfUpdated.message}: ${resultOfUpdated.cluster_name}`
      );
    } else {
      await replyToThread(
        slackEvent.channel,
        slackEvent.ts,
        `<${gotClusterName}> is an invalid cluster name.`
      );
    }
  } catch (error) {
    console.log(error);
  }
};

/**
 * the function of this command is to send message to chosen cluster.
 * @param {String} slackEvent
 * @async
 */
const mentionCmd = async slackEvent => {
  const clusterName = slackEvent.text
    .split(/mention/i)[1]
    .trim()
    .split(' ')[0]
    .trim();
  const msgForSending = slackEvent.text
    .split(clusterName)[1]
    .trim()
    .toString();

  // find the cluster
  const targetCluster = await cluster.findMembers(nedb, clusterName);

  if (targetCluster) {
    if (msgForSending) {
      for (const memberId of targetCluster.members) {
        const message = `${msgForSending} https://${SLACK_WORKSPACE}.slack.com/archives/${slackEvent.channel}/p${slackEvent.event_ts}`;
        directMessage(memberId, message);
      }
    } else {
      replyToThread(
        slackEvent.channel,
        slackEvent.ts,
        'Please provide the message you want to send.\n\n'
      );
    }
  } else {
    const msg = 'Please make sure the cluster name is correct!!.';
    replyToThread(slackEvent.channel, slackEvent.ts, msg);
  }
};

/**
 * the object of this command is to invite registered members in a cluster for channel
 * @param {Object} slackEvent
 */
const inviteCmd = async slackEvent => {
  const gotClusterName = slackEvent.text.split(/invite/i)[1].trim();
  const targetCluster = await cluster.find(nedb, gotClusterName);
  if (!targetCluster) {
    return replyToThread(
      slackEvent.channel,
      slackEvent.ts,
      'This cluster is not found'
    );
  }
  const existingMember = await webClient.conversations.members({
    channel: slackEvent.channel
  });
  const clusterMembers = await cluster.findMembers(nedb, gotClusterName);
  const inviteMembers = clusterMembers.members.filter(member => {
    if (!existingMember.members.includes(member)) return member;
  });
  await webClientLegacy.conversations.invite({
    users: inviteMembers.join(','),
    channel: slackEvent.channel
  });
  replyToThread(slackEvent.channel, slackEvent.ts, 'Invitation Complete!');
};

/**
 *the object of kick command is to evacuate all registered members in cluster from channel.
 * @param {Object} slackEvent
 */
const kickCmd = async slackEvent => {
  const gotClusterName = slackEvent.text
    .split(/kick/i)[1]
    .trim()
    .split(' ')[0]
    .trim();
  const targetCluster = await cluster.findMembers(nedb, gotClusterName);
  const channelName = await getChannelName(slackEvent);
  if (!targetCluster) {
    replyToThread(
      slackEvent.channel,
      slackEvent.ts,
      'This cluster is not found'
    );
  } else {
    const channel = await webClient.conversations.members({
      channel: slackEvent.channel
    });
    for (const member of targetCluster.members) {
      if (channel.members.includes(member)) {
        kickMembers(member, slackEvent);
      }
    }
    const message = `<@${slackEvent.user}> kicked ${gotClusterName} from ${channelName} https://${SLACK_WORKSPACE}.slack.com/archives/${slackEvent.channel}/p${slackEvent.event_ts}`;
    directMessage(SLACK_USER_ID, message);
  }
};

const kickMembers = async (memberId, slackEvent) => {
  const channelName = await getChannelName(slackEvent);
  if (memberId !== slackEvent.user) {
    await webClient.conversations
      .kick({
        channel: slackEvent.channel,
        user: memberId
      })
      .then(async () => {
        const message = `<@${slackEvent.user}> kicked you from ${channelName}`;
        directMessage(memberId, message);
      })
      .catch(err => console.log(err));
  } else if (memberId === slackEvent.user) {
    await webClient.conversations
      .leave({
        channel: slackEvent.channel
      })
      .catch(error => console.log(error));
  }
};

const getChannelName = async slackEvent => {
  const channelName = await webClient.channels.info({
    channel: slackEvent.channel
  });
  return channelName.channel.name;
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
const listCmd = async slackEvent => {
  const gotClusterName = slackEvent.text
    .split(/list/i)[1]
    .trim()
    .split(' ')[0]
    .trim();
  if (slackEvent.channel[0] !== 'D') {
    replyToThread(slackEvent.channel, slackEvent.ts, 'This cmd only DM.');
    return;
  }
  let infoAllCluster = await cluster.find(nedb, gotClusterName);
  console.log(infoAllCluster);
  if (!infoAllCluster) {
    replyToThread(slackEvent.channel, slackEvent.ts, 'Nothing to return');
  } else {
    let msg = '';
    infoAllCluster = gotClusterName ? [infoAllCluster] : infoAllCluster;
    for (const data of infoAllCluster) {
      const members = data.members.map(member => `<@${member}>`);
      msg += `:file_folder: Cluster_name ${data.cluster_name}\n\n Members:sunglasses: ${members}\n`;
    }
    replyToThread(slackEvent.channel, slackEvent.ts, msg);
  }
};

/**
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
const URLRegExp = {
  batch: new RegExp('^/batch/b-[0-9]+$', 'i'),
  student: new RegExp('^/student/[A-Z0-9]{9}$', 'i'),
  virtual_company: new RegExp('^/virtual_company/[A-Z0-9]+$', 'i')
};

const server = http.createServer((req, res) => {
  httpServer(req, res);

  console.log(req.url.substr(9));

  if (req.url === '/') {
    res.write('server created');
    res.end();
  } else if (req.url.match(URLRegExp.student)) {
    const userProperty = {
      batch: '',
      virtual_company: ''
    };

    nedb.find({}, (err, data) => {
      if (err) console.log(err);

      data.forEach(cluster => {
        if (cluster.members.includes(req.url.substr(9))) {
          console.log(cluster.is_virtual_company);
          if (cluster.is_virtual_company) {
            userProperty.virtual_company = cluster.cluster_name;
          } else if (cluster.cluster_name.match(new RegExp('^b-[0-9]+$'))) {
            userProperty.batch = cluster.cluster_name;
          }
        }
      });

      res.write(JSON.stringify(userProperty));
      res.end();
    });
  } else if (
    req.url.match(URLRegExp.batch) ||
    req.url.match(URLRegExp.virtual_company)
  ) {
    const clusterProperty = {
      name: '',
      members: []
    };

    nedb.find({}, (err, data) => {
      if (err) console.log(err);

      data.forEach(cluster => {
        if (
          cluster.cluster_name === req.url.substr(7) ||
          cluster.cluster_name === req.url.substr(17)
        ) {
          if (
            req.url.match(URLRegExp.batch) ||
            req.url.match(URLRegExp.virtual_company)
          ) {
            clusterProperty.name = cluster.cluster_name;
            clusterProperty.members = cluster.members;
          }
        }
      });

      res.write(JSON.stringify(clusterProperty));
      res.end();
    });
  } else {
    res.write('Invalid Request');
    res.end();
  }
});
server.listen(PORT, () => {
  console.log(`listening to PORT:${PORT}`);
});

const job = new CronJob('* * * * * *', () => {
  fetch('https://www.temp-scm.glitch.me', (error, meta, body) => {
    if (error) console.log(error);

    console.log(body);
  });
});

job.start();
