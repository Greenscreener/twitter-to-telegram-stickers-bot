const functions = require('firebase-functions');
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const async = require('async');
const sharp = require("sharp");
const FormData = require("form-data");
const Telegram = require("telegraf/telegram");
const {PubSub} = require('@google-cloud/pubsub');

const secrets = require("./secrets.json");
const verbose = false;

exports.telegramTwitterStickerBot = functions.https.onRequest((request, response) => {
	if (request.path === '/HbXQSJaq0Ewooc13OlvBhrBMHQc89_9GqC8q16F56Imq48hOvLNMZeoaBSCl0DkvQ1_0snYTfYdS') {
		console.log(request.body);
		const pubsub = new PubSub();
		const topic = pubsub.topic("triggerTelegramBot");
		const message = Buffer.from(JSON.stringify(request.body));
		return topic.publish(message).then(() => {
			response.send("OK");
		}).catch((error) => {
			console.error(error);
			response.send("OK");
		});
	}


	response.send("Wat?");
});
exports.telegramTwitterStickerBotRunner = functions.pubsub.topic('triggerTelegramBot').onPublish((messageText) => {
	return new Promise((resolve) => {
		const message = messageText.json;
		console.log(message);
		if (message.hasOwnProperty("message")) {
			switch (message.message.text.split(" ")[0]) {
				case "/create":
					createStickerPack(message.message).then(() => resolve());
					//resolve();
					break;
				case "/update":
					//updateStickerPack(request.body.message);
					resolve();
					break;
				case "/start":
					showHelp(message.message).then(() => resolve());
					break;
				case "/help":
					showHelp(message.message).then(() => resolve());
					break;
				default:
					unknownCommand(message.message).then(() => resolve());
			}
		}
	})
});
function unknownCommand(message) {
	return fetch(`https://api.telegram.org/bot${secrets.telegramBotKey}/sendMessage`, {
		method: "POST",
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({
			chat_id: message.chat.id,
			text: `Oy, I have no idea what you mean by \`${message.text}\`. \nMaybe try sending me something like \`/create <twitter username>\`.`
		})
	});
}
function showHelp(message) {
	return fetch(`https://api.telegram.org/bot${secrets.telegramBotKey}/sendMessage`, {
		method: "POST",
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({
			chat_id: message.chat.id,
			text: `Hewwo ${message.from.first_name}! I am TwitterStickerBot made by @GrnScrnr. I make sticker packs from Twitter accounts' timelines. Send me \`/create <twitter username>\`.`
		})
	});
}

exports.createStickerPack = createStickerPack;

function createStickerPack(message) {
	if (message.text.split(" ").length !== 2) {
		return fetch(`https://api.telegram.org/bot${secrets.telegramBotKey}/sendMessage`, {
			method: "POST",
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({
				chat_id: message.chat.id,
				text: `Oy, the syntax for \`/create\` is \`/create <twitter username>\``
			})
		});

	} else {
		fetch(`https://api.telegram.org/bot${secrets.telegramBotKey}/sendMessage`, {
			method: "POST",
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({
				chat_id: message.chat.id,
				text: `Workin on it m8.`
			})
		});
		let createFailed = false;
		const stickerPackName = `${message.from.username}s_${message.text.split(" ")[1].replace("@","")}_by_TwitterStickerBot`;
		return fetch(`https://api.twitter.com/1.1/search/tweets.json?result_type=recent&q=from%3A${message.text.split(" ")[1].replace("@","")}%20filter%3Atwimg&count=100`, {
			method: "GET",
			headers: {"Authorization": "Bearer " + secrets.twitterAccessToken}
		}).then(response => response.json()).then(json => {
			if (verbose === true) console.log("Twitter fetch tweets response: ", json);
			return fetch(`https://api.telegram.org/bot${secrets.telegramBotKey}/createNewStickerSet`, {
				method: "POST",
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					user_id: message.from.id,
					name: stickerPackName,
					title: `@${message.from.username}'s @${message.text.split(" ")[1].replace("@","")} stickers made with ♥ by @TwitterStickerBot`,
					png_sticker: "https://grnscrnr.tk/images/GSLOGO512.png",
					emojis: "💚"
				})
			}).then((response) => {
				if (verbose === true) response.json().then(json => console.log("Telegram createNewStickerSet response:", json));
				return async.eachSeries(json.statuses, (tweet, callback) => {
					if (typeof tweet.entities === "undefined" || typeof tweet.entities.media === "undefined" || typeof tweet.entities.media[0] === "undefined") {
						callback();
					} else {
						fetch(tweet.entities.media[0].media_url_https).then(response => response.buffer()).then(buffer => {
							return sharp(buffer).resize(512, 512).png().toBuffer();
						}).then(buffer => {
							const FD = new FormData();
							FD.append("user_id", message.from.id);
							FD.append("name", stickerPackName);
							FD.append("png_sticker", buffer, "sticcer.png");
							FD.append("emojis", (tweet.text.match(/[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu) || [""]).join("") || "🤷‍♂️");
							if (verbose === true) console.log(FD);
							fetch(`https://api.telegram.org/bot${secrets.telegramBotKey}/addStickerToSet`, {
								method: "POST",
								headers: { ...FD.getHeaders(), "Connection": "close" },
								body: FD
							}).then((response) => {
								if (verbose === true) console.log("Telegram addStickerToSet response1:",response);
								if (verbose === true) response.text().then(text => console.log("Telegram addStickerToSet response2:", text));
								callback();
							});
						})
					}
				})
			}).then(() => {
				return fetch(`https://api.telegram.org/bot${secrets.telegramBotKey}/sendMessage`, {
					method: "POST",
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify({
						chat_id: message.chat.id,
						text: `Oy! Ya sticker pack is ready. Ya shall find it here: https://t.me/addstickers/${stickerPackName}`
					})
				})
			}).then(() => {
				return fetch(`https://api.telegram.org/bot${secrets.telegramBotKey}/getStickerSet?name=${stickerPackName}`)
			}).then(response => response.json()).then(json => {
				console.log(json);
				return fetch(`https://api.telegram.org/bot${secrets.telegramBotKey}/sendSticker`, {
					method: "POST",
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify({
						chat_id: message.chat.id,
						sticker: json.result.stickers[Math.round(Math.random() * json.result.stickers.length)].file_id
					})
				});
			});
		})
	}
}

function authorizeTwitter() {
	return fetch("https://api.twitter.com/oauth2/token?grant_type=client_credentials", {
		method: "POST",
		headers: {'Authorization': 'Basic ' + secrets.twitterConsumerBase64}
	})
}
