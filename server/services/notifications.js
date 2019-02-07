
var redis = require("redis");
var queue = redis.createClient();
// const { Expo } = require('expo-server-sdk');
const async = require("async");
var FCM = require('fcm-node');

const serverKey = "AAAAU9SwCrc:APA91bFOqQcjoD8Dq8GE4O6IrgoBrnpzaK7ksgBIw_h6VcgjXG-U4rmmISYl8bIZFSEDok9HeeNjXvW4vzALcdS-3V10C7Ff4xYAmDCHMY_f8wbu4k4vj-O7QyrH-cbw8E_Yys2fAGJC";
var fcm = new FCM(serverKey);

module.exports = function () {
    return {
        init: function () {
            console.log(`notifications service initialised`);
            queue.on("message", (channel, message) => {
                console.log(`${channel} says ${message}`);
                let notificationMessages = JSON.parse(message);
                console.log(notificationMessages);

                async.each(notificationMessages, (notificationMessage, callback) => {
                    console.log('Sending to ' + notificationMessage.to);

                    var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
                        to: notificationMessage.to,
                        data: notificationMessage.data
                    };

                    fcm.send(message, function (err, response) {
                        if (err) {
                            console.log(err);
                            callback(err);
                        } else {
                            console.log("Successfully sent with response: ", response);
                            callback();
                        }
                    });

                });

            })
            queue.subscribe("user_notifications");
        }
    }
}

