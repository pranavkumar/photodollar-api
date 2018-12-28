'use strict';
var app = require("../../server/server");
var _ = require("lodash");
const Nexmo = require('nexmo');
const request = require("request");

module.exports = function (UUser) {
    UUser.sendSMS = function () {
        // const nexmo = new Nexmo({
        //     apiKey: "b5780072",
        //     apiSecret: "xL4v0cjsOdWjXSTZ"

        //   }, {});
        //   nexmo.message.sendSms("KYASCN", "918050598432", "test message using nexmo", {}, function(err, data){
        //       console.log(err);
        //       console.log(data);
        //   });
        request.post({
            url: "https://api.textlocal.in/send/",
            formData: { apiKey: "8xc7Od5MLxc-6SIfpKtYlSfU8awlsAXTtR9PIBmA0W", numbers: [8050598432].join(","), sender: "TXTLCL", message: "hellO WORLD2" }
        },function(err, res, body){
            console.log(err);
            console.log(body);
        });
    }
    UUser.sendSMS();
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
                let index = _.findIndex(request.expectations, function (o) {
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
    UUser.getForwardables = async (id, uRequestId) => {
        try {
            let uUser = await UUser.findById(id);
            let contacts = await uUser.contacts.find({});
            let uRequest = await app.models.URequest.findById(uRequestId);
            // console.log(uRequest);
            if (!uRequest) {
                throw new Error(`request with id ${uRequestId} not found`);
            }
            let forwards = uRequest.forwards;
            // console.log(`forwards count ${forwards.length}`);
            let forwardables = _.map(contacts, (contact) => {
                return _.pick(contact, ['name', 'id', 'UUserId', 'normalizedMobile'])
            });
            forwardables = _.map(forwardables, function (forwardable) {
                let index = _.findIndex(forwards, function (forward) {
                    return (forward.forwarderId == id && forward.contactId == forwardable.id);
                })
                if (index >= 0) {
                    forwardable.isForwarded = true;
                } else {
                    forwardable.isForwarded = false;
                }
                return forwardable;
            })
            return forwardables;
        } catch (err) {
            throw err
        }
    }
    UUser.remoteMethod('getForwardables', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: "uRequestId",
            type: "string"
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