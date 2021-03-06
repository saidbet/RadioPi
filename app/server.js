/**
* Written by @Victor Bury and @Antonio Calapez
**/

//Permet de s'assurer que l'application ne crash pas si on ne catch pas une erreur
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});

var DEBUG = true;

function debug(message){
	if(DEBUG)
		console.log(message)
}

//Imports
var utils = require('./lib/utils.js');
var Mplayer = require('node-mplayer');
var youtube = require('./lib/youtube.js');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var config = require('./config.json');
var bcrypt = require('bcrypt');

var Song = require('./lib/song.js');

/**
Garde les tokens des clients en mémoire
**/
var tokens = [];


/**
Socket.io Config
**/
var io = require('socket.io')(server);

io.on('connection', function(socket){
	socket.emit('nowPlaying', {
		nowPlaying: nowPlaying()
	});
});

// Initial config
var PORT = 1337;
utils.checkCache();
var CACHE_PATH = __dirname + '/cache/';
youtube.setCachePath(CACHE_PATH);
var SONGS_PATH = CACHE_PATH + 'songs/';
var PICS_PATH = CACHE_PATH + 'pics/';

app.use(express.static(PICS_PATH));

var player = new Mplayer();

var queue = [];
var queuePos = 0;
var AUTO_NEXT = true;
var REPEAT = true;

function setFile(file){
	var song = '';
	if(typeof(file) === 'string'){
		song = file;
	} else if(typeof(file) === 'object') {
		song = file.name;
	}

	try{
		player.setFile(SONGS_PATH + song + '.mp3');
	} catch (error) {
		player = new Mplayer(SONGS_PATH + song + '.mp3');
	}
};

function addToQueue(song){
	if(typeof(song) === 'string'){
		var nSong = new Song(song);
		queue.push(nSong);
	} else if(typeof(song) === 'object') {
		queue.push(song);
	}
}

function removeFromQueue(id){
	var index = queue.map(function(e) { return e.id; }).indexOf(id);
	if(index > -1){
		queue.splice(index, 1);
	}
}

/**
Appeller stop() après avoir changé un morceau crash le player !
**/

function play(file){
	if(file === undefined){
		setFile(queue[queuePos].name);
		player.play();
		console.log(nowPlaying());
		emitNowPlaying();
	} else {
		var nSong = new Song(file);
		//addToQueue(nSong);
		setFile(nSong);
		queuePos = queue.map(function(e) { return e.name; }).indexOf(file) - 1;
		next();
		console.log(queue);
		console.log(nowPlaying());
		emitNowPlaying();
	}
};

function stop(){
	try {
		player.stop();
	} catch (error) {
		console.log(error);
	}
};

//TODO: return le state dans lequel le player est

function togglePause(){
	try {
		player.pause();
	} catch (error) {
		console.log(error);
	}
};

function next(){
	if(queuePos + 1 >= queue.length)
		queuePos = -1;
	setFile(queue[++queuePos]);
	play();
};

function previous(){
	if(queuePos - 1 == -1)
		queuePos = queue.length;
	setFile(queue[--queuePos]);
	play();
};

function autoNext() {
	if(AUTO_NEXT){
		try{
			player.getPercentPosition(function(elapsedPercent){
				if(elapsedPercent !==undefined){
					if(elapsedPercent>=97){
						next();
					}
				}
			});
		} catch (e){
			if(e === "[Error: This socket is closed.]")
				next();
		}
	}
};

setInterval(autoNext, 500);

function nowPlaying(callback){
	if(queue.length == 0){
		return "nothing";
	}
	return queue[queuePos].name;
};

function emitQueue(){
	io.sockets.emit('queue', {
		queue: queue
	});
}

function emitNowPlaying(){
	io.sockets.emit('nowPlaying', {
		nowPlaying: nowPlaying()
	});
}

/**
Player Controls API
**/

var playerRouter = express.Router();

playerRouter.get('/nowPlaying', function(req, res){
	res.setHeader('Content-Type', 'application/json');
	res.send({
		nowPlaying: nowPlaying()
	});
});

playerRouter.get('/play', function(req, res){
	play();
	res.setHeader('Content-Type', 'application/json');
	res.send({
		nowPlaying: nowPlaying()
	});
});

playerRouter.get('/play/:song', function(req, res){
	res.setHeader('Content-Type', 'application/json');
	if(queue.length == 0){
		youtube.search(req.params.song, function(data){
			if(!utils.in_array(utils.cleanName(data.title), utils.musicList())){
				youtube.download(data.id, function(name){
					play(utils.cleanName(name));
					res.send({
						nowPlaying: nowPlaying()
					});
				});
			} else {
				play(utils.cleanName(data.title));
				res.send({
					nowPlaying: nowPlaying()
				});
			}
		});
	} else {
		if(!utils.in_array(req.params.song, utils.musicList)){
			youtube.search(req.params.song, function(data){
				if(data.error){
					res.send(data);
					return 0;
				}
				if(!utils.in_array(utils.cleanName(data.title), utils.musicList())){
					youtube.download(data.id, function(name){
						play(utils.cleanName(name));
						res.send({
							nowPlaying: nowPlaying()
						});
					});
				} else {
					play(utils.cleanName(data.title));
					res.send({
						nowPlaying: nowPlaying()
					});
				}
			});
		} else {
			play(utils.cleanName(req.params.song));
			res.send({
				nowPlaying: nowPlaying()
			});
		}
	}

});

playerRouter.get('/play/:song/next', function(req, res){
	res.setHeader('Content-Type', 'application/json');
	debug(req.params.song);
	if(utils.in_array(req.params.song, utils.musicList())){
		addToQueue(req.params.song);
		if(queue.length == 1)
			play();
		res.send({
			queue: queue,
			nowPlaying: nowPlaying()
		});
		emitQueue();
	} else {
		youtube.search(req.params.song, function(data){
			debug(data);
			if(data.error){
				res.send(data);
				return 0;
			}
			if(utils.in_array(utils.cleanName(data.title), utils.musicList())){
				addToQueue(utils.cleanName(data.title));
				if(queue.length == 1)
					play();
				res.send({
					queue: queue,
					nowPlaying: nowPlaying()
				});
				emitQueue();
			} else {
				youtube.download(data.id, function(name){
					addToQueue(name);
					if(queue.length == 1)
						play();
					res.send({
						queue: queue,
						nowPlaying: nowPlaying()
					});
					emitQueue();
				});
			}
		});
	}
});

playerRouter.get('/togglePause', function(req, res){
	togglePause();
	res.send({
		message: "Calling togglePause method"
	});
});

playerRouter.get('/next/:token?', function(req, res){
	var token = req.params.token || "";
	if(tokens.indexOf(token) == -1){
		res.send({
			success: false,
			error: "Token invalide",
			nowPlaying: nowPlaying()
		});
		return;
	}
	next();
	res.send({
		success: true,
		nowPlaying: nowPlaying()
	});
});

playerRouter.get('/previous', function(req, res){
	var token = req.params.token || "";
	if(tokens.indexOf(token) == -1){
		res.send({
			success: false,
			error: "Token invalide",
			nowPlaying: nowPlaying()
		});
		return;
	}
	previous();
	res.send({
		success: true,
		nowPlaying: nowPlaying()
	});
});

playerRouter.get('/list', function(req, res){
	var files = utils.musicList();
	var songs = [];
	for(var file in files){
		songs.push(new Song(files[file]));
	}
    res.setHeader('Content-Type', 'application/json');
	res.send({
		songs: songs
	});
});

playerRouter.get('/queue', function(req, res){
	res.setHeader('Content-Type', 'application/json');
	res.send({
		queue: queue
	});
	emitQueue();
});

playerRouter.get('/queue/remove/:id/:token?', function(req, res){
	res.setHeader('Content-Type', 'application/json');
	var token = req.params.token || "";
	if(tokens.indexOf(token) == -1){
		res.send({
			success: false,
			error: "Token invalide",
			queue: queue
		});
		return;
	}

	removeFromQueue(req.params.id);
	res.send({
		success: true,
		queue: queue
	});
	emitQueue();
});

/**
Express APP
**/
var logger = function(req, res, next){
	console.log('[logger]', req.method, req.url);
	next();
};

//Permet à tout le monde d'accéder à l'API
/**
à virer après la phase de Dev
**/
var allowAll = function(req, res, next){
	res.header('Access-Control-Allow-Origin', "*");
	next();
};

app.use(logger);
app.use(allowAll);
app.use('/api/controls', playerRouter);

app.use('/static', express.static(__dirname + '/dist/'));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

app.get('/api/login/:password?', function(req, res){
	var pass = req.params.password || "";
	var isPassValid = bcrypt.compareSync(pass, config.adminPassword);
	if(!isPassValid){
		res.send({
			success: false,
			message: "Invalid password"
		});
		return;
	}

	if(isPassValid){
		var token = utils.guid();
		tokens.push(token);
		res.send({
			success: true,
			token: token
		});
		return;
	}
})

server.listen(PORT, function(){
	console.log('App listening on port', PORT);
});
