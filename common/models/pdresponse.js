'use strict';
var app = require("../../server/server");


module.exports = function (Pdresponse) {
    Pdresponse.observe("after save", async function (ctx, next) {
        if (ctx.isNewInstance) {
            let instance = ctx.instance;
            let request = await app.models.Pdrequest.findById(instance.requestId);
            request.responsesCount = request.responsesCount + 1;
            await request.save();
        }
    });

    Pdresponse.observe("before delete", async function (ctx, next) {

        let instance = ctx.instance;
        let request = await app.models.Pdrequest.findById(instance.requestId);
        request.responsesCount = request.responsesCount - 1;
        await request.save();

    });

    Pdresponse.getUserResponses = async function (userId) {
        let responses = await Pdresponse.find({ where: { userId: userId }, order: "createdAt DESC" });
        return responses;
    }


    Pdresponse.remoteMethod('getUserResponses', {
        accepts: [{
            arg: 'userId',
            type: 'string'
        }],
        returns: {
            arg: 'result',
            type: 'array',
            root: true
        },
        http: {
            verb: 'get',
            path: '/user/:userId'
        }
    });

};
