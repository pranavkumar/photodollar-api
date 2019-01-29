'use strict';
var app = require("../../server/server");
var _ = require("lodash");
const request = require("request-promise");
const axios = require("axios");
const FormData = require('form-data');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var loopback = require('loopback');
var redis = require("redis");
var queue = redis.createClient();
var moment = require("moment");

const tokenSecret = "lamalama";

const tokenNoVerfiy = ["signIn"];

module.exports = function (Pduser) {
    Pduser.signIn = async function (preSignin) {

        try {
            let pduser = null;
            switch (preSignin.type) {
                case 'facebook':
                    pduser = await Pduser.findOne({ where: { facebookId: preSignin.id } });
                    break;
                case 'google':
                    pduser = await Pduser.findOne({ where: { googleId: preSignin.id } });
                    break;
                case 'twitter':
                    pduser = await Pduser.findOne({ where: { twitterId: preSignin.id } });
                    break;
                default:
                    throw new Error("Unknown signin type");
            }

            if (!pduser) {
                let newUser = {};
                newUser.name = preSignin.name;
                if (preSignin.email) {
                    newUser.email = preSignin.email;
                }
                switch (preSignin.type) {
                    case "facebook":
                        newUser.facebook = preSignin;
                        newUser.facebookId = preSignin.id;
                        break;
                    case "twitter":
                        newUser.twitter = preSignin;
                        newUser.twitterId = preSignin.id;
                        break;
                    case "google":
                        newUser.google = preSignin;
                        newUser.googleId = preSignin.id;
                        break;
                    default:
                        throw new Error("Unknown signin type");
                }
                pduser = await Pduser.create(newUser);
            }
            let token = jwt.sign({
                id: pduser.id,
                realm: "Pduser",
                time: new Date().toISOString
            }, tokenSecret, { expiresIn: 24 * 2600 * 30 });

            pduser.authTokens.push(token);
            await pduser.save();

            let retObj = {
                user: pduser, token
            };
            console.log(retObj);
            return retObj;

        } catch (err) {
            throw err;
        }
    }
    Pduser.remoteMethod('signIn', {
        accepts: [{
            arg: "preSignin",
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
            path: '/signin'
        }
    });



    Pduser.getFeed = async (id) => {
        try {
            let pduser = await Pduser.findById(id);
            if (!pduser) {
                throw new Error(`PduserId ${id} does not exist.`);
            }
            // { createdAt: { lt: moment().subtract(3, 'hours').toDate() } }
            let con1 = { createdAt: { lt: moment().subtract(1, 'minutes').toDate() } };
            let con2 = { responsesCount: { gte: 10 } };
            let requests = await app.models.Pdrequest.find({
                where: { or: [con1, con2] },
                include: [{ "relation": "responses", scope: { include: ["user"] } }, { "relation": "comments", scope: { include: ["user"] } }, "user"],
                order: 'createdAt DESC'
            });
            requests = _.map(requests, (request) => {
                let expectsIndex = _.findIndex(request.expects, function (o) {
                    return o.userId == id;
                })
                if (expectsIndex >= 0) {
                    request.expected = true;
                } else {
                    request.expected = false;
                }
                let hidesIndex = _.findIndex(request.hides, function (o) {
                    return o.userId == id;
                });
                if (hidesIndex < 0) {
                    request.hidden = false;
                } else {
                    request.hidden = true;
                }
                let flagsIndex = _.findIndex(request.flags, function (o) {
                    return o.userId == id;
                });
                if (flagsIndex >= 0) {
                    request.flagged = true;
                } else {
                    request.flagged = false;
                }

                return request;
            })

            let con3 = { createdAt: { gte: moment().subtract(1, 'minutes').toDate() } };
            let con4 = { responsesCount: { lt: 10 } };

            let pendingRequests = await app.models.Pdrequest.find({
                where: { and: [con3, con4] },
                include: [{ "relation": "responses", scope: { include: ["user"] } }, "user"],
                order: 'createdAt ASC'
            });

            return { requests: requests, pendingRequests: pendingRequests };
        } catch (err) {
            throw err;
        }
    }

    Pduser.addContacts = async (id, contacts) => {
        try {
            let pduser = await Pduser.findById(id);
            if (!pduser) {
                throw new Error(`PduserId ${id} does not exist.`);
            }
            let res = await Promise.all(contacts.map((contact) => app.models.Pdcontact.findOrCreate({ where: { phone: contact.phone, userId: contact.userId } }, contact)));
            pduser.lastContactSync = new Date().toISOString();
            await pduser.save();
            let syncedContacts = _.map(res, function (syncedContact) {
                return syncedContact[0];
            });
            return { contacts: syncedContacts, synced: true };
        } catch (err) {
            throw err;
        }
    }
    Pduser.getForwardables = async (id, requestId) => {
        try {
            let pduser = await Pduser.findById(id);
            let contacts = await pduser.contacts.find({});
            console.log(contacts.length);
            let uRequest = await app.models.Pdrequest.findById(requestId);
            // console.log(uRequest);
            if (!uRequest) {
                throw new Error(`request with id ${requestId} not found`);
            }
            let forwards = uRequest.forwards;
            // console.log(`forwards count ${forwards.length}`);
            let forwardables = _.map(contacts, (contact) => {
                return _.pick(contact, ['name', 'id', 'PduserId', 'normalizedMobile', 'phone'])
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

    Pduser.addNotificationTokens = async function (id, tokenObj) {
        console.log(`${id} ${JSON.stringify(tokenObj)}`);
        try {
            if (!tokenObj || !tokenObj.token || !_.isString(tokenObj.token)) {
                throw new Error(`Invalid tokenObj ${JSON.stringify(tokenObj)}`);
            }
            let pduser = await Pduser.findById(id);
            if (!pduser) {
                throw new Error(`No user with id ${id}`);
            }
            tokenObj.updatedAt = new Date().toISOString();
            let index = _.findIndex(pduser.notificationTokens, function (o) {
                return o.token == tokenObj.token;
            })
            if (index < 0) {
                pduser.notificationTokens.push(tokenObj);
            } else {
                pduser.notificationTokens[index] = tokenObj;
            }
            await pduser.save();
            return { isAdded: (index < 0) };
        } catch (err) {
            throw err;
        }

    }

    Pduser.remoteMethod('addNotificationTokens', {
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

    Pduser.sendNotification = async function (id, body, data) {
        try {
            let pduser = await Pduser.findById(id);
            let messages = [];
            for (let notificationToken of pduser.notificationTokens) {
                messages.push({
                    to: notificationToken.token,
                    sound: 'default',
                    body: body,
                    data: data,
                });
            }
            if (messages.length > 0) {
                queue.publish("user_notifications", JSON.stringify(messages));
            }
            pduser.notifications.push({ body, data });
            await pduser.save();
        } catch (err) {
            throw err;
        }

    }




    Pduser.saveDeviceLocation = async function (id, deviceLocation) {
        console.log(`${id} ${JSON.stringify(deviceLocation)}`);
        try {
            let data = await app.models.Map.geocodeReverse(deviceLocation.coords.latitude, deviceLocation.coords.longitude);

            if (data.status == 'OK') {
                let pduser = await Pduser.findById(id);
                if (!pduser) {
                    throw new Error(`No user with id ${id}`);
                }
                pduser.defaultLocation = data.location;
                await pduser.save();
                return { location: data.location };
            } else {
                return { location: null }
            }

        } catch (err) {
            throw err;
        }

    }


    Pduser.remoteMethod('saveDeviceLocation', {
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

    Pduser.remoteMethod('getForwardables', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: "requestId",
            type: "string"
        }],
        returns: {
            arg: 'result',
            type: 'array',
            root: true
        },
        http: {
            verb: 'get',
            path: '/:id/forwardables/:requestId'
        }
    });
    Pduser.remoteMethod('addContacts', {
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
            type: 'object',
            root: true
        },
        http: {
            verb: 'post',
            path: '/:id/contacts/multi'
        }
    });
    Pduser.remoteMethod('getFeed', {
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

    Pduser.verifyToken = async function (id, token) {
        let user = await Pduser.findById(id);
        if (user == null) {
            return false;
        } else {
            let authTokens = user.authTokens;
            return authTokens.indexOf(token) > -1;
        }
    }

    Pduser.beforeRemote("*", async (ctx) => {




        if (process.env.AUTH_ENV == "production") {
            if (tokenNoVerfiy.indexOf(ctx.method.name) > -1) {
                console.log(`${ctx.method.name} whitelisted -- no verify`);
                return;
            }
            let authToken = (ctx.req.headers.authtoken);
            console.log(authToken);
            console.log("gonna check token");

            let { id, realm } = jwt.verify(authToken, tokenSecret);

            if (id && realm && realm == "Pduser") {
                console.log("gonna find user");
                try {
                    let verified = await Pduser.verifyToken(id, authToken);
                    if (verified) {
                        console.log("user verified");
                    } else {
                        console.log("bad user");
                        throw new Error("Unverified user");
                    }
                } catch (error) {
                    throw new Error("Unverified user");
                }

            }

        }
    });
};
