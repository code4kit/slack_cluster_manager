'use strict';

/**
 * @async
 * @param {Object} nedb form _nedb.js
 * @param {String} clusterName cluster name
 * @param {String[]} memberIds members id list
 * @return {{message: String, cluster_name: String}}
 */
// const check = asyncfind({});
// console.log(check);
const update = async (nedb, clusterName, memberIds) => {
  const targetCluster = await nedb.asyncFindOne({ cluster_name: clusterName });
  if (memberIds.length === 0) {
    await nedb.asyncRemove({ cluster_name: clusterName }, {});
    return { message: 'deleted', cluster_name: clusterName };
  } else {
    if (!targetCluster) {
      await nedb.asyncInsert({
        cluster_name: clusterName,
        members: memberIds
      });
      return { message: 'created', cluster_name: clusterName };
    } else {
      const existMemberIds = await nedb.asyncFindOne({ cluster_name: clusterName })
      await nedb.asyncUpdate({
        cluster_name: clusterName
      }, {
        $set: { members: [...existMemberIds.members, ...memberIds] }
      });
      return { message: 'updated', cluster_name: clusterName };
    }
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
  return "";
};

module.exports = {
  update,
  find,
  findMembers
};
