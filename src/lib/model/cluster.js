"use strict";

/**
 * @async
 * @param {Object} nedb form _nedb.js
 * @param {String} clusterName cluster name
 * @param {String[]} memberIds members id list
 * @return {{message: String, cluster_name: String}}
 */

const update = async (nedb, clusterName, memberIds) => {
  const existCluster = await nedb
    .asyncFindOne({
      cluster_name: clusterName
    })
    .catch(err => {
      console.log(err);
    });

  if (!existCluster) {
    return `:warning: cluster ${clusterName} doesn't exist.`;
  } else if (memberIds.length === 0) {
    return ":warning: At least 1 member must be specified.";
  } else {
    const existMemberIds = existCluster.members;
    memberIds = memberIds.filter(member => !existMemberIds.includes(member));
    const updateMembers =
      existMemberIds.length !== 0
        ? [...existMemberIds, ...memberIds]
        : [...memberIds];
    await nedb.asyncUpdate(
      {
        cluster_name: clusterName
      },
      {
        $set: { members: updateMembers }
      }
    );
    return `:tada: updated members to cluster ${clusterName}`;
  }
};

/**
 * @async
 * @param {Object} nedb
 * @param {String} clusterName
 */
const find = async (nedb, clusterName) => {
  if (clusterName) {
    const gotCluster = await nedb.asyncFindOne({
      cluster_name: clusterName
    });

    return gotCluster;
  }

  const allCluster = await nedb.asyncFind({});
  return allCluster;
};

const findMembers = async (nedb, clusterName) => {
  if (clusterName) {
    const gotCluster = await nedb.asyncFindOne({
      cluster_name: clusterName
    });

    return gotCluster;
  }
};

const createCluster = async (nedb, clusterName) => {
  const isVC = clusterName.includes("--vc");
  const isBatch = clusterName.includes("--batch");

  clusterName =
    isVC || isBatch
      ? clusterName.replace(/\s--batch|\s--vc/, "").trim()
      : clusterName;

  const existCluster = await nedb
    .asyncFindOne({
      cluster_name: clusterName
    })
    .catch(error => {
      console.log(error);
    });

  if (existCluster) {
    return `:warning: cluster ${clusterName} already exists.`;
  }
  await nedb
    .asyncInsert({
      cluster_name: clusterName,
      isVC,
      isBatch,
      members: []
    })
    .catch(err => {
      console.log(err);
    });
  return `:tada: created cluster ${clusterName}.`;
};

const removeCluster = async (nedb, clusterName, memberIds) => {
  const existCluster = await nedb
    .asyncFindOne({
      cluster_name: clusterName
    })
    .catch(error => {
      console.log(error);
    });

  if (existCluster) {
    if (memberIds.length === 0) {
      const clusterDeletion = await nedb
        .asyncRemove(
          {
            cluster_name: clusterName
          },
          {}
        )
        .catch(err => {
          console.log(err);
        });
      if (clusterDeletion) {
        return `:tada: deleted cluster ${clusterName}.`;
      } else {
        return `:warning: cannot find cluster ${clusterName}.`;
      }
    } else {
      const existMemberIds = existCluster.members;
      const membersToRemove = existMemberIds.filter(
        member => !memberIds.includes(member)
      );

      await nedb.asyncUpdate(
        {
          cluster_name: clusterName
        },
        {
          $set: { members: membersToRemove }
        }
      );
      return `:tada: removed members in cluster ${clusterName}`;
    }
  }
};

module.exports = {
  update,
  find,
  findMembers,
  createCluster,
  removeCluster
};
