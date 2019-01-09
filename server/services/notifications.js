
var redis = require("redis");
var queue = redis.createClient();
const { Expo } = require('expo-server-sdk');
let expo = new Expo();
var request = require("request");
module.exports = function () {
    return {
        init: function () {
            console.log(`notifications service initialised`);
            queue.on("message", (channel, message) => {
                console.log(`${channel} says ${message}`);
                let notificationMessages = JSON.parse(message);
                let verifiedMessages = notificationMessages.filter((notificationMessage) => {
                    return Expo.isExpoPushToken(notificationMessage.to);

                });

                

                let chunks = expo.chunkPushNotifications(verifiedMessages);
                let tickets = [];

                (async () => {
                    for (let chunk of chunks) {
                        try {
                            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                            console.log(ticketChunk);
                            tickets.push(...ticketChunk);
                        } catch (error) {
                            console.error(error);
                        }
                    }
                })();
            })
            queue.subscribe("user_notifications");
        }
    }
}

