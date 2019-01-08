'use strict';
const request = require("request");
const key = "AIzaSyCb93X2vjYdxfyFhHZrMG2eYB2dY-b7Vk4";
module.exports = function (Map) {
    Map.autocomplete = function (input, cb) {
        request({
            url: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
            qs: {
                input: input,
                key: key,
                sessiontoken: "12345"
            },
            json: true
        }, function (err, response, body) {
            cb(err, body);
        })
    }
    Map.geocode = function (address, cb) {
        request({
            url: 'https://maps.googleapis.com/maps/api/geocode/json',
            qs: {
                address: address,
                key: key
            },
            json: true
        }, function (err, response, body) {
            cb(err, body);
        })
    }
    Map.geocodeReverse = function (lat, lng) {
        let latlng = `${lat},${lng}`;
        console.log(latlng);
        return new Promise((resolve, reject) => {
            request({
                url: 'https://maps.googleapis.com/maps/api/geocode/json',
                qs: {
                    latlng: latlng,
                    key: key
                },
                json: true
            }, function (err, response, body) {
                if (err) {
                    reject(err);
                } else {
                    let { results, status } = body;
                    if (status == 'OK') {
                        let result = results[0];
                        console.log(result);
                        let formattedAddressArr = result.formatted_address.split(",");
                        console.log(formattedAddressArr);
                        let addressLine1 = `${formattedAddressArr[0]}, ${formattedAddressArr[1]}`;
                        let addressLine2 = [];
                        for (var i = 2; i < formattedAddressArr.length; i++) {
                            addressLine2.push(formattedAddressArr[i].trim());
                        }
                        addressLine2 = addressLine2.join(", ");
                        let country = formattedAddressArr[formattedAddressArr.length - 1].trim();
                        let placeId = result.place_id;
                        let lat = result.geometry.location.lat;
                        let lng = result.geometry.location.lng;

                        let serializedLocation = { addressLine1, addressLine2, lat, lng, country, placeId };
                        console.log(serializedLocation);


                        resolve({ location: serializedLocation, status });
                    } else {
                        resolve({ location: null, status: 'NOT_OK' })
                    }
                }
            })
        });

    }

    Map.remoteMethod('geocodeReverse', {
        accepts: [{
            arg: 'lat',
            type: 'number'
        },{
            arg: 'lng',
            type: 'number'
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'GET',
            path: '/geocodeReverse'
        }
    });



    Map.remoteMethod('autocomplete', {
        accepts: [{
            arg: 'input',
            type: 'string'
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'GET',
            path: '/autocomplete'
        }
    });
    Map.remoteMethod('geocode', {
        accepts: [{
            arg: 'address',
            type: 'string'
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true
        },
        http: {
            verb: 'GET',
            path: '/geocode'
        }
    });
};