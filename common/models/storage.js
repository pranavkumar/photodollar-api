'use strict';
var app = require("../../server/server");

module.exports = function (Storage) {
	Storage.afterRemote('upload', async function (ctx, res, next) {
		let { result: { files: { file }, fields } } = res;
		if (file[0].container == 'responseImages') {
			//gonna add a response
			let { userId, requestId, caption } = fields;
			userId = userId[0];
			requestId = requestId[0];



			console.log(userId);
			console.log(requestId);
			let pdrequest = await app.models.Pdrequest.findById(requestId);
			let responseObj = { userId: userId, image: file[0]};
			if (caption) {
				responseObj.caption = caption[0];
			}
			let response = await pdrequest.responses.create(responseObj);

			res.result["response"] = response;

		}

	})
};
