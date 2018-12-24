'use strict';
const _ = require("lodash");
var app = require("../../server/server");
module.exports = function(URequest) {
    URequest.getExpectators = async (id) => {
        try {
            let uRequest = await URequest.findById(id);
            if (!uRequest) {
                throw new Error(`No request with id ${id}`);
            }
            let expectatorIds = uRequest.expectatorIds || [];
            return expectatorIds;
        } catch (err) {
            throw err
        }
    }
    URequest.addExpectator = async (id, expectator) => {
        try {
            let uRequest = await URequest.findById(id);
            if (!uRequest) {
                throw new Error(`No request with id ${id}`);
                return;
            }
            let uUser = await app.models.UUser.findById(expectator.id);
            if (!uUser) {
                throw new Error(`No user with id ${expectator.id}`);
                return;
            }
            let index = _.findIndex(uRequest.expectators, function(o) {
                return o.id == expectator.id;
            })
            if (index < 0) {
                let subtractPoints = expectator.points;
                let finalPoints = uUser.points - subtractPoints;
                if (finalPoints < 0) {
                    throw new Error("Not enough points");
                } else {
                    uUser.points = finalPoints;
                }
                uRequest.expectators.push(expectator);
                await uRequest.save();
                await uUser.save();
                return {
                    isExpecting: true
                };
            } else {
                let oldExpectator = uRequest.expectators[index];
                let addPoints = oldExpectator.points;
                uRequest.expectators.splice(index, 1);
                uUser.points = uUser.points + addPoints;
                await uRequest.save();
                await uUser.save();
                return {
                    isExpecting: false
                };
            }
        } catch (err) {
            throw err
        }
    }
    URequest.remoteMethod('getExpectators', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }],
        returns: {
            arg: 'result',
            type: 'array',
            root: true
        },
        http: {
            verb: 'get',
            path: '/:id/expectators'
        }
    });
    URequest.remoteMethod('addExpectator', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: "expectator",
            type: "object",
            http: {
                source: "body"
            }
        }],
        returns: {
            arg: 'result',
            type: 'array',
            root: true
        },
        http: {
            verb: 'post',
            path: '/:id/expectators'
        }
    });
};