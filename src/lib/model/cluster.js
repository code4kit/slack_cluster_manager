'use strict';

/**
 * @async
 * @param {Object} nedb form _nedb.js
 * @param {String} clusterName cluster name
 * @param {String[]} memberIds members id list
 * @return {{message: String, cluster_name: String}}
 */

const update = async (nedb, clusterName, memberIds) => {
  const existCluster = await nedb.asyncFindOne({
    cluster_name: clusterName
  }).catch((err) => {
    console.log(err);
  });

  if (!existCluster) {
    return `:warning: Cluster ${clusterName} not exist.`;
  } else if (memberIds.length === 0) {
    return ':warning: Please Provide the memebers.';
  } else {
    const existMemberIds = existCluster.members;
    memberIds = memberIds.filter((member) => !existMemberIds.includes(member));
    const updateMembers = existMemberIds.length !== 0 ? [...existMemberIds, ...memberIds] : [...memberIds];
    await nedb.asyncUpdate({
      cluster_name: clusterName
    }, {
      $set: { members: updateMembers }
    });
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
  const isVC = clusterName.includes('--vc');
  const isBatch = clusterName.includes('--batch');
  clusterName = isVC || isBatch ? clusterName.replace(/\s--batch|\s--vc/, '').trim() : clusterName;
  const exist = await nedb.asyncFindOne({
    cluster_name: clusterName
  }).catch((error) => {
    console.log(error);
  });
  if (exist) {
    return `:warning: Cluster ${clusterName} aleady exist.`;
  }
  await nedb.asyncInsert({
    cluster_name: clusterName,
    isVC,
    isBatch,
    members: []
  }).catch((err) => {
    console.log(err);
  });
  return `:tada: created cluster ${clusterName}.`;
};

const deleteCluster = async (nedb, clusterName) => {
  const res = await nedb.asyncRemove({
    cluster_name: clusterName
  }, {}).catch((err) => {
    console.log(err);
  });
  if (res) {
    return `:tada: deteled cluster ${clusterName}.`;
  } else {
    return `:warning: Can not find cluster ${clusterName}.`;
  }
};

module.exports = {
  update,
  find,
  findMembers,
  createCluster,
  deleteCluster
};
