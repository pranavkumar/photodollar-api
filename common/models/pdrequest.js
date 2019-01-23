'use strict';
const _ = require("lodash");
var app = require("../../server/server");
var loopback = require('loopback');

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
                    expects: true
                };
            } else {
                let oldExpect = pdrequest.expects[index];
                let addPoints = oldExpect.points;
                pdrequest.expects.splice(index, 1);
                pduser.points = pduser.points + addPoints;
                await pdrequest.save();
                await pduser.save();
                return {
                    expects: false
                };
            }
        } catch (err) {
            throw err;
        }
    }
    Pdrequest.toggleHide = async function (id, userId) {
        try {
            let pdrequest = await Pdrequest.findById(id);
            if (!pdrequest) {
                throw new Error(`No request with id ${id}`);
            }

            let pduser = await app.models.Pduser.findById(userId);
            if (!pduser) {
                throw new Error(`No user with id ${userId}`);
            }

            let index = pdrequest.hides.indexOf(userId);

            let hides = true;
            if (index < 0) {
                pdrequest.hides.push(userId);
            } else {
                pdrequest.hides.splice(index, 1);
                hides = false;
            }
            await pdrequest.save();
            return { hides: hides }
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
            return { flags: (index < 0) }
        } catch (err) {
            throw err;
        }
    }

    Pdrequest.remoteMethod('flagRequest', {
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
            path: '/:id/flags'
        }
    });

    Pdrequest.remoteMethod('toggleHide', {
        accepts: [{
            arg: 'id',
            type: 'string'
        }, {
            arg: 'userId',
            type: 'string'
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'get',
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
        // if (ctx.isNewInstance) {
        //     try {
        //         console.log("gonna forward to all locals...");
        //         let instance = ctx.instance;
        //         let { _from, _to } = instance;
        //         // console.log(_from);
        //         // console.log(_to);
        //         var from = new loopback.GeoPoint({
        //             lat: _from.lat,
        //             lng: _from.lng
        //         });
        //         var to = new loopback.GeoPoint({
        //             lat: _to.lat,
        //             lng: _to.lng
        //         });
        //         let fromQuery = { where: { _defaultLocation: { near: from, maxDistance: 10, unit: 'kilometers' } }, fields: { id: true } };
        //         let toQuery = { where: { _defaultLocation: { near: to, maxDistance: 10, unit: 'kilometers' } }, fields: { id: true } };

        //         let uUsersAroundFrom = await app.models.UUser.find(fromQuery);
        //         let uUsersAroundTo = await app.models.UUser.find(toQuery);
        //         console.log(uUsersAroundFrom);
        //         console.log(uUsersAroundTo);
        //         let targetsFrom = [];
        //         let targetsTo = [];
        //         let targetsLocal = [];
        //         _.forEach((uUsersAroundFrom), (uUserAroundFrom) => {
        //             let index = _.findIndex(uUsersAroundTo, (uUserAroundTo) => uUserAroundFrom.id == uUserAroundTo.id);
        //             if (index < 0) {
        //                 targetsFrom.push(uUserAroundFrom);
        //             } else {
        //                 targetsLocal.push(uUserAroundFrom);
        //             }
        //         })
        //         _.forEach((uUsersAroundTo), (uUserAroundTo) => {
        //             let index = _.findIndex(uUsersAroundFrom, (uUserAroundFrom) => uUserAroundFrom.id == uUserAroundTo.id);
        //             if (index < 0) {
        //                 targetsTo.push(uUserAroundTo);
        //             } else {
        //                 targetsLocal.push(uUserAroundTo);
        //             }
        //         })
        //         targetsLocal = _.sortedUniqBy(targetsLocal, (targetLocal) => targetLocal.id);

        //         console.log(targetsFrom);
        //         console.log(targetsTo);
        //         console.log(targetsLocal);

        //         let data = { pdrequestId: instance.id };

        //         //notify local users - local request
        //         await Promise.all(targetsLocal.map(async (targetLocal) => {
        //             await app.models.UUser.sendNotification(targetLocal.id, `Someone has requested for ${instance.title} in your area. Reply or Forward`, { ...data, type: 'NEW_LOCAL_REQUEST' });
        //         }));

        //         //notify from users - outgoing request
        //         await Promise.all(targetsFrom.map(async (targetFrom) => {
        //             await app.models.UUser.sendNotification(targetFrom.id, `Someone has requested for ${instance.title} in your area. Forward`, { ...data, type: 'NEW_OUTGOING_REQUEST' });
        //         }));


        //         //notify to users - incoming request
        //         await Promise.all(targetsTo.map(async (targetTo) => {
        //             await app.models.UUser.sendNotification(targetTo.id, `Someone has requested for ${instance.title} from your area. Reply`, { ...data, type: 'NEW_INCOMING_REQUEST' });
        //         }));

        //     }
        //     catch (err) {
        //         throw err;
        //     } finally {
        //         return;
        //     }

        // } else {
        //     return;
        // }

    });
};
