'use strict';
var app = require("../../server/server");
var _ = require("lodash");
module.exports = function(UUser) {
    UUser.getFeed = async (id) => {
        try {
            let uUser = await UUser.findById(id);
            if (!uUser) {
                throw new Error(`UUserId ${id} does not exist.`);
            }
            let requests = await app.models.URequest.find({
                include: ["UResponses", "UUser"]
            });
            requests = _.map(requests, (request) => {
                let index = _.findIndex(request.expectations, function(o) {
                    return o.id == id;
                })
                if (index >= 0) {
                    request.isExpecting = true;
                } else {
                    request.isExpecting = false;
                }
                return request;
            })
            return requests;
        } catch (err) {
            throw err;
        }
    }
    UUser.addContacts = async (id, contacts) => {
        try {
            let uUser = await UUser.findById(id);
            if (!uUser) {
                throw new Error(`UUserId ${id} does not exist.`);
            }
            let res = await Promise.all(contacts.map((contact) => uUser.contacts.create(contact)));
            uUser.lastContactSync = new Date().toISOString();
            await uUser.save();
            return res;
        } catch (err) {
            throw err;
        }
    }
    UUser.getForwardables = async (id) => {
        try {
            let uUser = await UUser.findById(id);
            let contacts = await uUser.contacts.find({});
            let forwardables = _.map(contacts, (contact) => {
                return _.pick(contact, ['name', 'id', 'UUserId', 'normalizedMobile'])
            });
            return forwardables;
        } catch (err) {
            throw err
        }
    }
    UUser.remoteMethod('getForwardables', {
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
            path: '/:id/forwardables'
        }
    });
    UUser.remoteMethod('addContacts', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: 'contacts',
            type: 'array',
            http: {
                source: "body"
            }
        }],
        returns: {
            arg: 'result',
            type: 'object'
        },
        http: {
            verb: 'post',
            path: '/:id/contacts/multi'
        }
    });
    UUser.remoteMethod('getFeed', {
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
            path: '/:id/feed'
        }
    });
};