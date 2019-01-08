'use strict';
var app = require("../../server/server");
var _ = require("lodash");
const Nexmo = require('nexmo');
const request = require("request-promise");
const axios = require("axios");
const FormData = require('form-data');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var loopback = require('loopback');
var redis = require("redis");
var queue = redis.createClient();

module.exports = function (UUser) {

    UUser.signIn = async function (type, user) {

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
                default:
                    throw new Error("Unknown signin type");
            }

            if (!uUser) {
                let newUser = {};
                newUser.name = user.name;
                if (user.email) {
                    newUser.email = user.email;
                }
                switch (type) {
                    case "facebook":
                        newUser.facebook = user;
                        newUser.facebookId = user.id;
                        break;
                    case "twitter":
                        newUser.twitter = user;
                        newUser.twitterId = user.id;
                        break;
                    case "google":
                        newUser.google = user;
                        newUser.googleId = user.id;
                        break;
                    default:
                        throw new Error("Unknown signin type");
                }
                uUser = await UUser.create(newUser);
            }
            return {
                uUser: uUser, token: jwt.sign({
                    id: uUser.id,
                    realm: "UUser",
                    time: new Date().toISOString
                }, "lamalama", { expiresIn: 24 * 2600 * 30 })
            };;

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

    UUser.testGeo = function () {
        var userLocation = new loopback.GeoPoint({
            lat: 28.7041,
            lng: 77.1025
        });
        app.models.URequest.find({ where: { _from: { near: userLocation, maxDistance: 1500, unit: 'kilometers' } } }, function (err, data) {
            console.log(err);
            console.log(data);
        })
    }

    // setTimeout(function () {
    //     UUser.testGeo();
    // }, 3000);


    UUser.getFeed = async (id) => {
        try {
            let uUser = await UUser.findById(id);
            if (!uUser) {
                throw new Error(`UUserId ${id} does not exist.`);
            }
            let requests = await app.models.URequest.find({
                include: [{ "UResponses": "user" }, "UUser"],
                order: 'createdAt DESC'
            });
            requests = _.map(requests, (request) => {
                let expectationsIndex = _.findIndex(request.expectations, function (o) {
                    return o.id == id;
                })
                if (expectationsIndex >= 0) {
                    request.isExpecting = true;
                } else {
                    request.isExpecting = false;
                }
                let isHiddenIndex = request.hiddenBy.indexOf(id);
                if (isHiddenIndex < 0) {
                    request.isHidden = false;
                } else {
                    request.isHidden = true;
                }
                let isFlaggedIndex = _.findIndex(request.flaggedBy, function (o) {
                    return o.id == id;
                });
                if (isFlaggedIndex >= 0) {
                    request.isFlagged = true;
                } else {
                    request.isFlagged = false;
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

    UUser.addNotificationTokens = async function (id, tokenObj) {
        console.log(`${id} ${JSON.stringify(tokenObj)}`);
        try {
            if (!tokenObj || !tokenObj.token || !_.isString(tokenObj.token)) {
                throw new Error(`Invalid tokenObj ${JSON.stringify(tokenObj)}`);
            }
            let uUser = await UUser.findById(id);
            if (!uUser) {
                throw new Error(`No user with id ${id}`);
            }
            tokenObj.updatedAt = new Date().toISOString();
            let index = _.findIndex(uUser.notificationTokens, function (o) {
                return o.token == tokenObj.token;
            })
            if (index < 0) {
                uUser.notificationTokens.push(tokenObj);
            } else {
                uUser.notificationTokens[index] = tokenObj;
            }
            await uUser.save();
            return { isAdded: (index < 0) };
        } catch (err) {
            throw err;
        }

    }

    UUser.remoteMethod('addNotificationTokens', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: "tokenObj",
            type: "object",
            http: {
                source: 'body'
            }
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'post',
            path: '/:id/notificationTokens'
        }
    });

    UUser.sendNotification = async function (id, body, data) {
        try {
            let uUser = await UUser.findById(id);
            let messages = [];
            for (let notificationToken of uUser.notificationTokens) {

                messages.push({
                    to: notificationToken.token,
                    sound: 'default',
                    body: 'This is a test notification for Pranav',
                    data: { withSome: 'data' },
                });
            }
            if (messages.length > 0) {
                queue.publish("user_notifications", JSON.stringify(messages));
            }


        } catch (err) {
            throw err;
        }

    }

    setTimeout(function () {
        // UUser.sendNotification("5c273c8a2fc0f36e4b25f3f1", null, null);
    }, 3000);


    UUser.saveDeviceLocation = async function (id, location) {
        console.log(`${id} ${JSON.stringify(location)}`);
        try {
            let data = await app.models.Map.geocodeReverse(location.coords.latitude, location.coords.longitude);

            if (data.status == 'OK') {
                let uUser = await UUser.findById(id);
                if (!uUser) {
                    throw new Error(`No user with id ${id}`);
                }
                uUser._defaultLocation = data.location;
                await uUser.save();
                return { location: data.location };
            } else {
                return { location: null }
            }

        } catch (err) {
            throw err;
        }

    }


    UUser.remoteMethod('saveDeviceLocation', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: "location",
            type: "object",
            http: {
                source: "body"
            }
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'post',
            path: '/:id/saveDeviceLocation'
        }
    });

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