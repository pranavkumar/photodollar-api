var uniqid = require('uniqid');
module.exports = function(app) {
    app.dataSources.storage.connector.getFilename = function(file, req, res) {
        var pattern = /^image\/.+$/;
        var value = pattern.test(file.type);
        if (value) {
            var fileExtension = file.name.split('.').pop();
            var container = file.container;
            var time = new Date().getTime();
            var newFileName = `${uniqid()}_${time}.${fileExtension}`;
            return newFileName;
        } else {
            throw "FileTypeError: Only File of Image type is accepted.";
        }
    };
}