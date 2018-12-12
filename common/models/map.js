'use strict';
const request = require("request");
const key = "AIzaSyCb93X2vjYdxfyFhHZrMG2eYB2dY-b7Vk4";
module.exports = function(Map) {
    Map.autocomplete = function(input, cb) {
        request({
            url: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
            qs: {
                input: input,
                key: key,
                sessiontoken: "12345"
            },
            json: true
        }, function(err, response, body) {
            cb(err, body);
        })
    }
    Map.geocode = function(address, cb) {
        request({
            url: 'https://maps.googleapis.com/maps/api/geocode/json',
            qs: {
                address: address,
                key: key
            },
            json: true
        }, function(err, response, body) {
            cb(err, body);
        })
    }
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