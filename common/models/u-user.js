'use strict';
var app = require("../../server/server");
var _ = require("lodash");
const Nexmo = require('nexmo');
const request = require("request-promise");
const axios = require("axios");
const FormData = require('form-data');

module.exports = function (UUser) {

    UUser.signIn = async function (type, user) {
        // console.log(type);
        // console.log(user);
        try {
            let uUser = null;
            switch (type) {
                case 'facebook':
                    uUser = await UUser.findOne({ where: { facebookId: user.id } });
                    break;
                case 'google':
                    uUser = await UUser.findOne({ where: { googleId: user.id } });
                    break;
                case 'twitter':
                    uUser = await UUser.findOne({ where: { twitterId: user.id } });
                    break;
            }

            if (!uUser) {
                let _newUser = {};
                _newUser.name = user.name;
                if (user.email) {
                    _newUser.email = user.email;
                }
                switch (type) {
                    case "facebook":
                        _newUser.facebook = user;
                        _newUser.facebookId = user.id;
                        break;
                    case "twitter":
                        _newUser.twitter = user;
                        _newUser.twitterId = user.id;
                        break;
                    case "google":
                        _newUser.google = user;
                        _newUser.googleId = user.id;
                        break;
                }
                let newUser = await UUser.create(_newUser);
                return newUser;
            } else {
                console.log();
                return uUser;
            }

        } catch (err) {
            throw err;
        }
    }
    UUser.remoteMethod('signIn', {
        accepts: [{
            arg: 'type',
            type: 'string'
        }, {
            arg: "user",
            type: "object"
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'get',
            path: '/signin'
        }
    });

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