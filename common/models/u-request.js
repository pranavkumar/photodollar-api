'use strict';
const _ = require("lodash");
var app = require("../../server/server");
var loopback = require('loopback');
module.exports = function (URequest) {
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
    URequest.addForward = async (id, forward) => {
        try {
            let uRequest = await URequest.findById(id);
            if (!uRequest) {
                throw new Error(`No request with id ${id}`);
                return;
            }
            let existingForwards = uRequest.forwards;

            let index = _.findIndex(existingForwards, function (existingForward) {
                return (existingForward.forwarderId == forward.forwarderId && existingForward.contactId == forward.contactId)
            })
            if (index < 0) {
                existingForwards.push(forward);
            } else {
                console.log(`forward exists`);
            }

            await uRequest.save();
            return true;

        } catch (err) {
            throw err;
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
            let index = _.findIndex(uRequest.expectations, function (o) {
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
    URequest.toggleHide = async function (id, uUserId) {
        try {
            let uRequest = await URequest.findById(id);
            if (!uRequest) {
                throw new Error(`No request with id ${id}`);
            }

            let uUser = await app.models.UUser.findById(uUserId);
            if (!uUser) {
                throw new Error(`No user with id ${uUserId}`);
            }

            let index = uRequest.hiddenBy.indexOf(uUserId);

            let isHidden = true;
            if (index < 0) {
                uRequest.hiddenBy.push(uUserId);
            } else {
                uRequest.hiddenBy.splice(index, 1);
                isHidden = false;
            }
            await uRequest.save();
            return { isHidden: isHidden }
        } catch (err) {
            throw err;
        }
    }

    URequest.flagRequest = async function (id, flagger) {
        try {
            let uRequest = await URequest.findById(id);
            if (!uRequest) {
                throw new Error(`No request with id ${id}`);
            }
            let uUser = await app.models.UUser.findById(flagger.id);
            if (!uUser) {
                throw new Error(`No user with id ${flagger.id}`);
            }

            let index = _.findIndex(uRequest.flaggedBy, function (o) {
                return o.id == flagger.id;
            })

            if (index < 0) {
                uRequest.flaggedBy.push(flagger);
            } else {
                uRequest.flaggedBy.splice(index, 1);
            }
            await uRequest.save();
            return { isFlagged: (index < 0) }
        } catch (err) {
            throw err;
        }
    }

    URequest.remoteMethod('flagRequest', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: 'flagger',
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
            path: '/:id/flag'
        }
    });

    URequest.remoteMethod('toggleHide', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: 'uUserId',
            type: 'string'
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'get',
            path: '/:id/toggleHide/:uUserId'
        }
    });


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
    URequest.remoteMethod('addForward', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: "forwards",
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
            path: '/:id/forwards'
        }
    });

    URequest.observe("after save", async (ctx, next) => {
        if (ctx.isNewInstance) {
            try {
                console.log("gonna forward to all locals...");
                let instance = ctx.instance;
                let { _from, _to } = instance;
                // console.log(_from);
                // console.log(_to);
                var from = new loopback.GeoPoint({
                    lat: _from.lat,
                    lng: _from.lng
                });
                var to = new loopback.GeoPoint({
                    lat: _to.lat,
                    lng: _to.lng
                });
                let fromQuery = { where: { _defaultLocation: { near: from, maxDistance: 10, unit: 'kilometers' } }, fields: { id: true } };
                let toQuery = { where: { _defaultLocation: { near: to, maxDistance: 10, unit: 'kilometers' } }, fields: { id: true } };

                let uUsersAroundFrom = await app.models.UUser.find(fromQuery);
                let uUsersAroundTo = await app.models.UUser.find(toQuery);
                console.log(uUsersAroundFrom);
                console.log(uUsersAroundTo);
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
                targetsLocal = _.sortedUniqBy(targetsLocal, (targetLocal) => targetLocal.id);

                console.log(targetsFrom);
                console.log(targetsTo);
                console.log(targetsLocal);

                //notify local users - local request
                await Promise.all(targetsLocal.map(async (targetLocal) => {
                    await app.models.UUser.sendNotification(targetLocal.id, `Someone has requested for ${instance.title} in your area. Reply or Forward`, {});
                }));

                //notify from users - outgoing request
                await Promise.all(targetsFrom.map(async (targetFrom) => {
                    await app.models.UUser.sendNotification(targetFrom.id, `Someone has requested for ${instance.title} in your area. Forward`, {});
                }));


                //notify to users - incoming request
                await Promise.all(targetsTo.map(async (targetTo) => {
                    await app.models.UUser.sendNotification(targetTo.id, `Someone has requested for ${instance.title} from your area. Reply`, {});
                }));

            }
            catch (err) {
                throw err;
            } finally {
                return;
            }

        } else {
            return;
        }

    });
};