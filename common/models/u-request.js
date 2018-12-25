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
            let expectations = uRequest.expectations || [];
            return expectations;
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
            if (!expectator.id) {
                throw new Error("Invalid expectator id");
            }
            let uUser = await app.models.UUser.findById(expectator.id);
            if (!uUser) {
                throw new Error(`No user with id ${expectator.id}`);
                return;
            }
            let index = _.findIndex(uRequest.expectations, function(o) {
                return o.id == expectator.id;
            })
            if (index < 0) {
                if (!expectator.points || isNaN(expectator.points)) {
                    throw new Error("Invalid expectator points");
                }
                let subtractPoints = expectator.points;
                let finalPoints = uUser.points - subtractPoints;
                if (finalPoints < 0) {
                    throw new Error("Not enough points");
                } else {
                    uUser.points = finalPoints;
                }
                uRequest.expectations.push(expectator);
                await uRequest.save();
                await uUser.save();
                return {
                    isExpecting: true
                };
            } else {
                let oldExpectator = uRequest.expectations[index];
                let addPoints = oldExpectator.points;
                uRequest.expectations.splice(index, 1);
                uUser.points = uUser.points + addPoints;
                await uRequest.save();
                await uUser.save();
                return {
                    isExpecting: false
                };
            }
        } catch (err) {
            throw err;
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
            path: '/:id/expectations'
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
            },
            required: true
        }],
        returns: {
            arg: 'result',
            type: 'array',
            root: true
        },
        http: {
            verb: 'post',
            path: '/:id/expectations'
        }
    });
};