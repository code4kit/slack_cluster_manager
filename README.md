# Slack Cluster Manager (EN)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?cacheSeconds=2592000)
![Prerequisite](https://img.shields.io/badge/yarn-%3E%3D1.19.1-blue.svg)
![Prerequisite](https://img.shields.io/badge/node-%3E%3D12.11.1-blue.svg)
[![Documentation](https://img.shields.io/badge/documentation-yes-brightgreen.svg)](https://github.com/code4kit/slack-cluster-manager#readme)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/code4kit/slack-cluster-manager/graphs/commit-activity)
[![License: MIT](https://img.shields.io/github/license/code4kit/slack_cluster_manager)](https://github.com/code4kit/slack-cluster-manager/blob/master/LICENSE)

<!-- Description -->
A bot that provide an easier way to add or remove **clusters** from the database.


> cluster is an object in the database that store channel property.


## Prerequisites
- yarn >=1.19.1
- node >=12.11.1

## Installation

```sh
yarn
```

## Usage

```sh
yarn start
```

## Test

```sh
yarn test
```

## COMMAND Usage


## 1. About :fries: **create**  command
```
:fries: create cluster_name --flag
```

### How does it work?
1. First, check cluster name existence in the database:
	+ If it already exists, notify user via direct message that a new record can't be added to the database.
	+ If it doesn't exist, check the flag after cluster name.
    
2. Different types of flag in the command:
	+ If `--vc` flag is presented in the command, `isVC` property in the database will be true and vice versa.
	+ If `--batch` flag is presented in the command, `isBatch` property in the database will be true and vice versa.

### EXAMPLE

> :fries: create c4k --vc 
```
=> {"name": 'c4k', "isVC": true, "isBatch": false, "members": [], "_id": '1'}
```

> :fries: create b-6 --batch 
```
=> {"name": 'b-6', "isVC": false, "isBatch": true, "members": [], "_id": '1'}
```

> :fries: create b-6 :negative_squared_cross_mark: 

> :fries: create b-6 --vc --batch :negative_squared_cross_mark: 

**NOTE:** 
1. Only authorized users can use this command.
2. A cluster must have either `--vc` or `--batch` flag. It can't be both.

---

## 2. About :fries: **update**  command
```
:fries: update cluster_name @userA @userB @userC
```

### How does it work?
Check cluster name existence in the database:
+ If it doesn't exist, notify user via direct message that record can't be updated in the database.
+ If it exists, add members to the database with no duplicate of the old members.


### EXAMPLE

> :fries: update b-6 @userA @userB @userC

```
=> {"name": 'b-6', "isVC": false, "isBatch": true, "members": [UQECTBTDX, UDECTATDM, UQEDTXTDM], "_id": '1'}
```

>:fries: update b-6 @here

```
{"name": 'b-6', "isVC": false, "isBatch": true, "members": [all_slack_users_id_in_current_channel], "_id": '1'}
```

**NOTE:** Only authorized users can use this command.

---

## 3. About :fries: **remove**  command
```
:fries: remove cluster_name @userA @userB @userC
```

### How does it work?
Check cluster name existence in the database.
+ If it doesn't already exist, notify user via direct message that record can't be removed in the database .
+ If it exists, remove members that are mentioned in the command. If there's no members mentioned in the command, remove the entire cluster from database.

### EXAMPLE

> :fries: remove b-6 @userA
 
```
=> {"name": 'b-6', "isVC": true, "isBatch": false, "members": [old_members_except_@userA_slack_id], "_id": '1'}
```

> :fries: remove b-6 

=> remove `b-6` cluster from database.

**NOTE:** Only authorized users can use this command.

---

## 4. About :fries: **mention**  command
```
:fries: mention cluster_name text
```

### How does it work?
Check cluster name existence in the database.
+ If it doesn't exist, notify user via direct message.
+ If it exists, send ***text*** to each members in the cluster individually.

### EXAMPLE

> :fries: mention b-6 "hello world"

=> send "hello world" as direct message to everyone in `b-6` cluster.

---

## 5. About :fries: **invite**  command
```
:fries: invite cluster_name
```

### How does it work?
Check cluster name existence in the database.
+ If it doesn't exist, notify user via direct message about invalid cluster name.
+ If it exists, invite all members in the cluster to current channel.

---

## 6. About :fries: **kick**  command
```
:fries: kick cluster_name
```

### How does it work?
Check cluster name existence in the database.
+ If it doesn't exist, notify user via direct message about invalid cluster name.
+ If it exists, kick all members in the cluster to current channel.

---

## 7. About :fries: **list**  command
```
:fries: list cluster_name
```

### How does it work?
Check cluster name existence in the command.
+ If there's no cluster_name, sent a direct message containing API link of all clusters.
+ If cluster_name(s) is presented in the command, send a direct message containing only those clusters API link(s).

---

## Author

👤 **code4kit**

- Website: https://code4kit.slack.com/signup
- Github: [@code4kit](https://github.com/code4kit)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

Feel free to check [issues page](https://github.com/code4kit/slack_cluster_management/issues).

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

Copyright © 2019 [code4kit](https://github.com/code4kit).

This project is [MIT](https://github.com/code4kit/slack-cluster-manager/blob/master/LICENSE) licensed.