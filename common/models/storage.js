'use strict';

module.exports = function(Storage) {
	Storage.beforeRemote('upload', function(ctx, res, next) {
		console.log(res);	
		console.log(ctx.instance);
		next();
	})
};
