'use strict';

/**
 * fileOverView update.js
 *
 * @author Shion0625
 * @author ryuji-cre8ive
 * @author waricoma
 * @author gittanaka
 * @version 1.0.0
 */

const { describe, it } = require('kocha');
const chai = require('chai');
const expect = chai.expect;

const clusterModel = require('../../src/lib/model/cluster');

describe('update method', () => {
  it('when create new cluster', async () => {
    /**
     * @param {Object} event
     */
    const nedb = require('../../src/lib/model/_nedb')(
      '',
      'test'
    );

    await clusterModel.update(nedb, 'foo', ['a', 'b', 'c']);

    const clusterName = 'test';

    const updatedResult = await clusterModel.update(nedb, clusterName, ['a', 'b', 'c']);

    expect(updatedResult.cluster_name).to.equal(clusterName);
    expect(updatedResult.message).to.equal('created');
  });

  it('when memberIds.length is 0', async () => {
    /**
     * @param {Object} event
     */
    const nedb = require('../../src/lib/model/_nedb')(
      '',
      'test'
    );

    const clusterName = 'test';

    await clusterModel.update(nedb, clusterName, ['a', 'b', 'c']);

    await clusterModel.update(nedb, clusterName, []);

    const clusters = await nedb.asyncFind({ cluster_name: clusterName });

    expect(clusters.length).to.equal(0);
  });
});
