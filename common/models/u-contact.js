'use strict';
var _ = require("lodash");
module.exports = function(Ucontact) {
    function normalizeMobile(mobile) {
        // console.log(mobile);
        mobile = mobile.replace(/ /g, "").replace(/\+/g, "").replace(/\-/g, "");
        if (mobile.length > 10) {
            let diff = mobile.length - 10;
            mobile = mobile.substring(diff);
        }
        // console.log(mobile);
        if (mobile.length == 10) {
            return Number(mobile);
        } else {
            return 0;
        }
    }
    Ucontact.observe("before save", (ctx, next) => {
        // console.log(ctx.instance);
        if (ctx.isNewInstance) {
            if (ctx.instance.id) {
                ctx.instance.remoteId = ctx.instance.id;
                ctx.instance.id = undefined;
            }
        }
        if (ctx.instance.phoneNumbers && _.isArray(ctx.instance.phoneNumbers) && ctx.instance.phoneNumbers.length > 0) {
            let mobileObj = ctx.instance.phoneNumbers[0];
            if (mobileObj.number) {
                let normalizedMobile = normalizeMobile(mobileObj.number);
                if (!_.isNaN(normalizedMobile)) {
                    ctx.instance.normalizedMobile = normalizedMobile;
                }
            }
        }
        // console.log(ctx.instance);
        next();
    });
};