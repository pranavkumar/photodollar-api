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
    	// console.log(expectator);
        try {
            let uRequest = await URequest.findById(id);
            if (!uRequest) {
                throw new Error(`No request with id ${id}`);
                return;
            }
            let uUser = await app.models.UUser.findById(expectator.id);
            // console.log(uUser);
            if (!uUser) {
                throw new Error(`No user with id ${id}`);
                return;
            }
            uRequest.expectatorIds.push(expectator.id);
            uRequest.expectatorIds = _.uniq(uRequest.expectatorIds);
            // console.log(uRequest.expectatorIds);
            // uRequest.expectatorIds = expectatorIds;
            await uRequest.save();
            return true;
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