"use strict";

/**
 * fileOverView index.js
 *
 * @author Shion0625
 * @author ryuji-cre8ive
 * @author waricoma
 * @author gittanaka
 * @version 1.0.0
 */

require("dotenv").config();
const http = require("http");
const httpServer = require("./lib/http_server");
const { RTMClient } = require("@slack/client");
const slackCommand = require("./lib/model/slackCommand");
const CronJob = require("cron").CronJob;
const fetch = require("fetch").fetchUrl;

/**
 * This connect to NeDB
 * @param {String}
 */
const DB_PATH = process.env.DB_PATH;
const SYSTEM_MODE = process.env.SYSTEM_MODE;
const nedb = require("./lib/model/_nedb")(DB_PATH, SYSTEM_MODE);

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

rtmClient.on("message", event => {
  if (event.user === SLACK_BOT_ID || !("text" in event)) {
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
const URLRegExp = {
  batch: new RegExp("^/batch/b-[0-9]+$", "i"),
  student: new RegExp("^/student/[A-Z0-9]{9}$", "i"),
  virtual_company: new RegExp("^/virtual_company/[A-Z0-9]+$", "i")
};

const server = http.createServer((req, res) => {
  httpServer(req, res);

  if (req.url === "/") {
    res.write("server created");
    res.end();
  } else if (req.url.match(URLRegExp.student)) {
    const userProperty = {
      batch: "",
      virtual_company: ""
    };

    nedb.find({}, (err, data) => {
      if (err) {
        console.log(err);
      } else {
        const gotStudentSlackID = req.url.substr(9);

        data.forEach(cluster => {
          if (cluster.members.includes(gotStudentSlackID)) {
            if (cluster.isVC) {
              userProperty.virtual_company = cluster.cluster_name;
            } else if (cluster.isBatch) {
              userProperty.batch = cluster.cluster_name;
            }
          }
        });

        res.write(JSON.stringify(userProperty));
        res.end();
      }
    });
  } else if (
    req.url.match(URLRegExp.batch) ||
    req.url.match(URLRegExp.virtual_company)
  ) {
    const clusterProperty = {
      name: "",
      type: "",
      members: []
    };

    nedb.find({}, (err, data) => {
      if (err) {
        console.log(err);
      } else {
        const gotBatchName = req.url.substr(7);
        const gotVirtualCompanyName = req.url.substr(17);
        data.forEach(cluster => {
          if (
            cluster.cluster_name === gotBatchName ||
            cluster.cluster_name === gotVirtualCompanyName
          ) {
            if (req.url.match(URLRegExp.batch)) {
              clusterProperty.type = "batch";
            } else if (req.url.match(URLRegExp.virtual_company)) {
              clusterProperty.type = "virtual company";
            }

            clusterProperty.name = cluster.cluster_name;
            clusterProperty.members = cluster.members;
          }
        });

        res.write(JSON.stringify(clusterProperty));
        res.end();
      }
    });
  } else {
    res.write("Invalid Request");
    res.end();
  }
});
server.listen(PORT || 3000, () => {
  console.log(`listening to PORT:${PORT}`);
});

const job = new CronJob("* * * * * *", () => {
  fetch("https://www.temp-scm.glitch.me", (error, meta, body) => {
    if (error) {
      console.log(error);
    } else {
      console.log(body);
    }
  });
});

job.start();