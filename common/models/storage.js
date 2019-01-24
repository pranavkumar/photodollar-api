'use strict';
var app = require("../../server/server");

module.exports = function (Storage) {
	Storage.afterRemote('upload', async function (ctx, res, next) {
		// console.log(JSON.stringify(res.result));
		let { result: { files: { file }, fields } } = res;
		console.log(file);
		console.log(fields);
		if (file[0].container == 'responseImages') {
			//gonna add a response
			let { userId, requestId } = fields;
			userId = userId[0];
			requestId = requestId[0];

			console.log(userId);
			console.log(requestId);
			let pdrequest = await app.models.Pdrequest.findById(requestId);
			let response  = await pdrequest.responses.create({ userId: userId, image: file[0] });

			res.result["response"] = response;
			
		}
		
	})
};
