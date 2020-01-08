"use strict";

require("dotenv").config();

const { WebClient } = require("@slack/client");
const cluster = require("./cluster");
const packageInfo = require("../../../package.json");

/**
 *SLACK_AUTHORIZE_USERS for authorizer user to cretae, update and remove the cluster
 */
const SLACK_AUTHORIZE_USERS = process.env.SLACK_AUTHORIZE_USERS.split(" ");
const SLACK_USER_ID = process.env.SLACK_USER_ID;
const SLACK_WORKSPACE = process.env.SLACK_WORKSPACE;

const EMOJI = process.env.SLACK_EMOJI;

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const webClientUi = new WebClient(SLACK_BOT_TOKEN);

const SLACK_LEGACY_TOKEN = process.env.LEGACY_TOKEN;
const webClientLegacy = new WebClient(SLACK_LEGACY_TOKEN);

const SLACK_TOKEN = process.env.SLACK_TOKEN;
const webClient = new WebClient(SLACK_TOKEN);

/**
 * This connect to NeDB
 * @param {String}
 */
const DB_PATH = process.env.DB_PATH;
const SYSTEM_MODE = process.env.SYSTEM_MODE;
const nedb = require("./_nedb")(DB_PATH, SYSTEM_MODE);

const createCluster = async event => {
  if (!authorizeOnly(event)) {
    return "unauthorized user.";
  }
  const clusterName = event.text.split(/create/i)[1].trim();
  const isVC = clusterName.includes("--vc");
  const isBatch = clusterName.includes("--batch");

  if (!isBatch || !isVC) {
    const msg = await cluster.createCluster(nedb, clusterName);
    replyToThread(event.channel, event.event_ts, msg);
  } else {
    replyToThread(event.channel, event.event_ts, ':warning: Please using one flag only.');
  }
};

const deleteCluster = async (event) => {
  if (!authorizeOnly(event)) {
    return '';
  }
  const clusterName = event.text.split(/delete/i)[1].trim();
  const msg = await cluster.deleteCluster(nedb, clusterName);
  replyToThread(event.channel, event.event_ts, msg);
};

const updateMembers = async (event) => {
  if (!authorizeOnly(event)) {
    return '';
  }
  const args = event.text.split(/update|<@|>|<!/);
  const clusterName = args[1].trim();
  let slackMembers = await webClient.users.list({
    channel: event.channel
  });
  
  slackMembers = slackMembers.members.filter((member) => !member.is_bot && member.id !== 'USLACKBOT').map(member => member.id);
  if (args.includes('here')) {
    const msg = await cluster.update(nedb, clusterName, slackMembers);
    replyToThread(event.channel, event.event_ts, msg);
  } else {
    const memberIds = args.filter((member) => { return slackMembers.includes(member); });
    const msg = await cluster.update(nedb, clusterName, memberIds);
    replyToThread(event.channel, event.event_ts, msg);
  }
};

const mentionCmd = async (event) => {
  const clusterName = event.text.split(/mention/i)[1].trim().split(' ')[0].trim();
  const msgForSending = event.text.split(clusterName)[1].trim().toString();
  const channel = event.channel;
  const threadTs = event.event_ts;
  const targetCluster = await cluster.findMembers(nedb, clusterName);
  const message = `:information_source: ${msgForSending}\n :link: https://${SLACK_WORKSPACE}.slack.com/archives/${channel}/p${threadTs}`;
  if (targetCluster) {
    if (targetCluster.members.length !== 0) {
      targetCluster.members.forEach((member) => {
        directMessage(member, message);
      });
    } else {
      replyToThread(channel, threadTs, ':warning: Cluster Member does not exist.');
    }
  } else {
    replyToThread(channel, threadTs, ':warning:Cluster does not exist.');
  }
};

const inviteCmd = async (event) => {
  const clusterName = event.text.split(/invite/i)[1].trim();
  const targetCluster = await cluster.findMembers(nedb, clusterName);
  const channel = event.channel;
  const threadTs = event.event_ts;

  if (targetCluster) {
    if (targetCluster.members.length !== 0) {
      const existingMember = await webClient.conversations.members({
        channel
      });
      let inviteMembers = targetCluster.members.filter((member) => { return !existingMember.members.includes(member) && member !== event.user; });
      if (inviteMembers.length !== 0) {
        if (inviteMembers.includes(SLACK_USER_ID)) {
          await webClientLegacy.conversations.join({
            channel
          });
          inviteMembers = inviteMembers.filter((member) => { return member !== SLACK_USER_ID; });
        }
        await webClientLegacy.conversations.invite({
          users: inviteMembers.join(','),
          channel
        });
        replyToThread(channel, threadTs, ':tada: Successfully invited.');
      } else {
        replyToThread(channel, threadTs, ':point_down: Members have already joined this channel.');
      }
    } else {
      replyToThread(channel, threadTs, ':warning: Cluster Member does not exist.');
    }
  } else {
    replyToThread(channel, threadTs, ':warning:Cluster does not exist.');
  }
};

const kickCmd = async (event) => {
  const clusterName = event.text.split(/kick/i)[1].trim().split(' ')[0].trim();
  const channel = event.channel;
  const threadTs = event.event_ts;
  const channelName = await webClient.channels.info({
    channel
  });
  const targetCluster = await cluster.findMembers(nedb, clusterName);
  if (targetCluster) {
    const existingMembers = await webClient.conversations.members({
      channel
    });
    const kickMemebers = targetCluster.members.filter(member => {
      return existingMembers.members.includes(member);
    });
    if (kickMemebers.length !== 0) {
      kickMemebers.forEach(async user => {
        if (user !== event.user) {
          await webClient.conversations
            .kick({
              channel,
              user
            })
            .catch(err => {
              console.log("====", err);
            });
          
          const message = `<@${event.user}> kicked you from ${channelName.channel.name}\n :link: https://${SLACK_WORKSPACE}.slack.com/archives/${channel}/p${threadTs} `;
          await directMessage(user, message);
        } else if (user === event.user) {
          if (user === SLACK_USER_ID) {
            await webClient.conversations.leave({
              channel
            });
          } else {
            await webClientLegacy.conversations.kick({
              user,
              channel
            }).catch((err) => {
              console.log(err);
            });
          }
        }
      });
    } else {
      replyToThread(
        channel,
        threadTs,
        `:warning: ${clusterName}'s members do not exist here.`
      );
    }
  } else {
    replyToThread(channel, threadTs, ":warning: cluster doesn't exist.");
  }
};

const listCmd = async slackEvent => {
  const gotClusterName = slackEvent.text
    .split(/list/i)[1]
    .trim()
    .split(" ")[0]
    .trim();
  if (slackEvent.channel[0] !== "D") {
    replyToThread(
      slackEvent.channel,
      slackEvent.ts,
      ":warning: You can only use this command with the bot."
    );
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
      msg += `:file_folder: Cluster_name ${data.cluster_name}\n\n Members:sunglasses: ${members}\n\n`;
    }
    replyToThread(slackEvent.channel, slackEvent.ts, msg);
  }
};

const authorizeOnly = (event) => {
  if (!SLACK_AUTHORIZE_USER.includes(event.user)) {
    replyToThread(event.channel, event.event_ts, ':warning: Only Authorize user can use this command.');
    return false;
  }
  return true;
};
/**
 *
 * @param {String} ch
 * @param {String} ts
 * @param {String} msg
 */

const replyToThread = (ch, ts, msg) => {
  webClientUi.chat.postMessage({
    channel: ch,
    username: packageInfo.name,
    icon_emoji: EMOJI,
    thread_ts: ts,
    text: msg
  });
};

const directMessage = async (userId, msg) => {
  const dmChannel = await webClientUi.im.open({
    user: userId
  });
  await webClientUi.chat.postMessage({
    text: msg,
    channel: dmChannel.channel.id
  });
};

module.exports = {
  createCluster,
  deleteCluster,
  updateMembers,
  mentionCmd,
  inviteCmd,
  kickCmd,
  listCmd
};
