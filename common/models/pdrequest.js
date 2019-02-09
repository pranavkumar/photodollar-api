'use strict';
const _ = require("lodash");
var app = require("../../server/server");
var loopback = require('loopback');
const moment = require("moment");

const SECONDS_BEFORE_NEXT_NOTIFICATION = 60 * 3;

module.exports = function (Pdrequest) {
    Pdrequest.getExpects = async (id) => {
        try {
            let pdrequest = await Pdrequest.findById(id);
            if (!pdrequest) {
                throw new Error(`No request with id ${id}`);
            }
            let expects = pdrequest.expects || [];
            return expects;
        } catch (err) {
            throw err
        }
    }
    Pdrequest.addForward = async (id, forward) => {
        try {
            let pdrequest = await Pdrequest.findById(id);
            if (!pdrequest) {
                throw new Error(`No request with id ${id}`);

            }
            let existingForwards = pdrequest.forwards;

            let index = _.findIndex(existingForwards, function (existingForward) {
                return (existingForward.userId == forward.userId && existingForward.contactId == forward.contactId)
            })
            if (index < 0) {
                existingForwards.push(forward);
            } else {
                console.log(`forward exists`);
            }

            await pdrequest.save();
            return true;

        } catch (err) {
            throw err;
        }
    }

    Pdrequest.addExpect = async (id, expect) => {
        try {
            let pdrequest = await Pdrequest.findById(id);
            if (!pdrequest) {
                throw new Error(`No request with id ${id}`);

            }
            if (!expect.userId) {
                throw new Error("Invalid expectator id");
            }
            let pduser = await app.models.Pduser.findById(expect.userId);
            if (!pduser) {
                throw new Error(`No user with id ${expect.id}`);

            }
            let index = _.findIndex(pdrequest.expects, function (o) {
                return o.userId == expect.userId;
            })
            if (index < 0) {
                if (!expect.points || isNaN(expect.points)) {
                    throw new Error("Invalid expect points");
                }
                let subtractPoints = expect.points;
                let finalPoints = pduser.points - subtractPoints;
                if (finalPoints < 0) {
                    throw new Error("Not enough points");
                } else {
                    pduser.points = finalPoints;
                }
                pdrequest.expects.push(expect);
                await pdrequest.save();
                await pduser.save();
                return {
                    expected: true
                };
            } else {
                let oldExpect = pdrequest.expects[index];
                let addPoints = oldExpect.points;
                pdrequest.expects.splice(index, 1);
                pduser.points = pduser.points + addPoints;
                await pdrequest.save();
                await pduser.save();
                return {
                    expected: false
                };
            }
        } catch (err) {
            throw err;
        }
    }
    Pdrequest.hideRequest = async function (id, hide) {
        try {
            let pdrequest = await Pdrequest.findById(id);
            if (!pdrequest) {
                throw new Error(`No request with id ${id}`);
            }
            let pduser = await app.models.Pduser.findById(flag.userId);
            if (!pduser) {
                throw new Error(`No user with id ${flag.userId}`);
            }

            let index = _.findIndex(pdrequest.hides, function (o) {
                return o.userId == hide.userId;
            })

            if (index < 0) {
                pdrequest.hides.push(hide);
            } else {
                pdrequest.hides.splice(index, 1);
            }
            await pdrequest.save();
            return { hidden: (index < 0) }
        } catch (err) {
            throw err;
        }
    }

    Pdrequest.flagRequest = async function (id, flag) {
        try {
            let pdrequest = await Pdrequest.findById(id);
            if (!pdrequest) {
                throw new Error(`No request with id ${id}`);
            }
            let pduser = await app.models.Pduser.findById(flag.userId);
            if (!pduser) {
                throw new Error(`No user with id ${flag.userId}`);
            }

            let index = _.findIndex(pdrequest.flags, function (o) {
                return o.userId == flag.userId;
            })

            if (index < 0) {
                pdrequest.flags.push(flag);
            } else {
                pdrequest.flags.splice(index, 1);
            }
            await pdrequest.save();
            return { flagged: (index < 0) }
        } catch (err) {
            throw err;
        }
    }

    Pdrequest.remoteMethod('flagRequest', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: 'flag',
            type: 'object',
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
            path: '/:id/flags'
        }
    });

    Pdrequest.remoteMethod('hideRequest', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: 'hide',
            type: 'object',
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
            path: '/:id/hides'
        }
    });


    Pdrequest.remoteMethod('getExpects', {
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
            path: '/:id/expects'
        }
    });
    Pdrequest.remoteMethod('addExpect', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: "expect",
            type: "object",
            http: {
                source: "body"
            },
            required: true
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'post',
            path: '/:id/expects'
        }
    });
    Pdrequest.remoteMethod('addForward', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: "forward",
            type: "object",
            http: {
                source: "body"
            },
            required: true
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'post',
            path: '/:id/forwards'
        }
    });

    Pdrequest.observe("after save", async (ctx, next) => {
        if (ctx.isNewInstance) {
            try {
                console.log("gonna forward to all locals...");
                let instance = ctx.instance;
                let { from, to } = instance;
                console.log(from);
                console.log(to);
                var fromPoint = new loopback.GeoPoint({
                    lat: from.lat,
                    lng: from.lng
                });
                var toPoint = new loopback.GeoPoint({
                    lat: to.lat,
                    lng: to.lng
                });
                let fromQuery = { where: { defaultLocation: { near: fromPoint, maxDistance: 10, unit: 'kilometers' } }, fields: { id: true } };
                let toQuery = { where: { defaultLocation: { near: toPoint, maxDistance: 10, unit: 'kilometers' } }, fields: { id: true } };

                let uUsersAroundFrom = await app.models.Pduser.find(fromQuery);
                let uUsersAroundTo = await app.models.Pduser.find(toQuery);

                console.log("here");

                console.log(`users around from ${uUsersAroundFrom.length}`);
                console.log(`users around to ${uUsersAroundTo.length}`);
                let targetsFrom = [];
                let targetsTo = [];
                let targetsLocal = [];
                _.forEach((uUsersAroundFrom), (uUserAroundFrom) => {
                    let index = _.findIndex(uUsersAroundTo, (uUserAroundTo) => uUserAroundFrom.id == uUserAroundTo.id);
                    if (index < 0) {
                        targetsFrom.push(uUserAroundFrom);
                    } else {
                        targetsLocal.push(uUserAroundFrom);
                    }
                })
                _.forEach((uUsersAroundTo), (uUserAroundTo) => {
                    let index = _.findIndex(uUsersAroundFrom, (uUserAroundFrom) => uUserAroundFrom.id == uUserAroundTo.id);
                    if (index < 0) {
                        targetsTo.push(uUserAroundTo);
                    } else {
                        targetsLocal.push(uUserAroundTo);
                    }
                })
                targetsLocal = _.uniqBy(targetsLocal, (targetLocal) => targetLocal.id);

                console.log(targetsFrom);
                console.log(targetsTo);
                console.log(targetsLocal);

                let data = { requestId: instance.id, requestTitle: instance.title, requestFromLocation: JSON.stringify(instance.from), requestToLocation: JSON.stringify(instance.to) };

                //notify local users - local request
                await Promise.all(targetsLocal.map(async (targetLocal) => {
                    await app.models.Pduser.sendNotification(targetLocal.id, { ...data, type: 'NEW_LOCAL_REQUEST' });
                }));

                //notify from users - outgoing request
                await Promise.all(targetsFrom.map(async (targetFrom) => {
                    await app.models.Pduser.sendNotification(targetFrom.id, { ...data, type: 'NEW_OUTGOING_REQUEST' });
                }));


                //notify to users - incoming request
                await Promise.all(targetsTo.map(async (targetTo) => {
                    await app.models.Pduser.sendNotification(targetTo.id, { ...data, type: 'NEW_INCOMING_REQUEST' });
                }));

            }
            catch (err) {
                throw err;
            } finally {
                return;
            }

        } else {
            
            

        }

    });

    Pdrequest.observe("before save", async function (ctx, next) {
        let instance = ctx.instance;
        console.log(`requestId ${instance.id} before save`);
        if (!ctx.isNewInstance) {
                let then = moment(instance.lastNotificationEpoch || instance.createdAt);
                let now = moment(new Date());

                let diff = moment.duration(now.diff(then)).asSeconds();
                console.log(diff);

                if (diff >= SECONDS_BEFORE_NEXT_NOTIFICATION) {
                    console.log(`generating notifications for ${instance.id}`);
                    Pdrequest.generateRequestNotifications();
                    instance.lastNotificationEpoch = new Date().toISOString();
                    
                }
        }
    });

    Pdrequest.generateRequestNotifications = async function(pdrequest){
        console.log("generating notifications");
    }
};
