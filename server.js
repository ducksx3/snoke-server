require('dotenv').config({ path: 'server-config.env' });
const http = require('http');
const https = require('https');
var os = require("os");

const url = require('url');
const { initGame, gameLoop, getUpdatedVelocity, createPlayer, updateGameRules } = require('./game');
const { FRAME_RATE, gameTimeout, timeOutMS } = require('./constants');
const { makeid } = require('./utils');
const path = require('path');

const state = {};
const clientRooms = {};

const { readFileSync } = require("fs");
const { createServer } = require("https");
const { Server } = require("socket.io");


const FRONTEND_SERVER = process.env.FRONTEND_SERVER ? process.env.FRONTEND_SERVER:'localhost'; 
const BACKEND_SERVER = process.env.BACKEND_SERVER ? process.env.BACKEND_SERVER:'localhost'; 
const k8s_API = process.env.k8s_API ? process.env.k8s_API:BACKEND_SERVER; 
const usingK8S = process.env.usingK8S ? process.env.usingK8S:"false"; 
const containerized = process.env.containerized ? process.env.containerized:"false"; 
console.log(`FRONTEND_SERVER is: ${FRONTEND_SERVER}`);
console.log(`BACKEND_SERVER is: ${BACKEND_SERVER}`);
console.log(`USING k8s_API: ${usingK8S} and typeof ${typeof usingK8S}`);
console.log(`k8s_API server is: ${k8s_API} `);



const requestListener = function (req, res) {
  const headers = {
    'Access-Control-Allow-Origin': FRONTEND_SERVER, 
  };                                                
  const queryObject = url.parse(req.url,true).query;  
  res.writeHead(200, headers);

  switch (url.parse(req.url).pathname) {
    case "/creategame/":
      console.log("a request received");
      if (req.method == 'POST'){
        console.log('POST')
        var body = ''
        req.on('data', function(data) {
          body += data
          console.log('Partial body: ' + body)
        })
        req.on('end', function() {
          handleNewGame(body).then(data => {
            res.end(JSON.stringify(data));
          });
        })
        break;
      }

      handleNewGame().then(data => {
        res.end(JSON.stringify(data));
      });
      break;

    case "/pod2ip/":
      console.log("HIT! "+queryObject.podName);
      getNodeIP(queryObject.podName).then(data => {
        responseJSON = {};
        responseJSON.HostIP = data;
        res.end(JSON.stringify(responseJSON));
        console.log("Sent: "+JSON.stringify(data));
      });
      break;

    case "/test/":
      res.end(`Hit! - ${os.hostname}`);
      console.log(`Sent hit - ${os.hostname}`);
      break;
  }
};

  options = {
    key: readFileSync("mykey.key"),
    cert: readFileSync("mycert.crt")
  }

// API to create games
const routesServer = https.createServer(options, requestListener);


const io = require("socket.io")({
  path: "/socket",
  cors: {
    origin: FRONTEND_SERVER,
    methods: ["GET", "POST"],
    credentials: true
  }
});
routesServer.listen(3000)

io.listen(routesServer);





  // #TODO - add a timeout
  // resolve the podName to the correct Node IP
async function getNodeIP(targetPod){

  if (usingK8S == "true"){
    console.log("Making a request to kubeAPI")
    let response = await fetch(`${k8s_API}:8585/resolvePod/?podName=snoke-${targetPod}`);
    HostIP = await response.json();
    console.log(`Received ${HostIP} from kubeAPI`);

  }
  else {
    console.log("Not using K8s");
    HostIP = BACKEND_SERVER;
  }

  console.log(`Got ${HostIP}`);
  return HostIP;
}


async function handleNewGame(gameRules) {
  gameRules = gameRules ? JSON.parse(gameRules):null;

  console.log(`Received: ${gameRules}`)
  let roomName = makeid(4);
  console.log(roomName,": created")
  targetPod = roomName.substring(0, roomName.lastIndexOf('x'));

  // #TODO - add a timeout
  HostIP = await getNodeIP(targetPod);

  // Initializes players and food
  state[roomName] = initGame(gameRules);
  state[roomName].gameID = roomName;
  // state[roomName].playerArray.push(client.id);

  startGameInterval(roomName, state[roomName].GameRules.FPS);
  GameInfo = {}
  GameInfo.HostIP = HostIP;
  GameInfo.roomName = roomName;
  return GameInfo;
}


// Websocket handler
io.on('connection', client => {
  console.log(`New connection - IP: ${client.handshake.address} - Client: ${client.id}`);
  client.on('inputAction', handleInput);
  client.on('newGame', handleNewGame);
  client.on('joinGame', handleJoinGame);
  client.on('editGameRules', handleEditGameRules);
  client.on('disconnect', handleDisconnect);

  function handleJoinGame(roomName) {
    const room = io.sockets.adapter.rooms[roomName];
    if (state[roomName] == null){
      console.log(`Client: ${client.id} - Unknown Code: ${roomName}`);
      client.emit('unknownCode');
      return;
    }
    
    console.log("Room state is:"+state[roomName]);
    clientRooms[client.id] = roomName;
    client.number = createPlayer(state[roomName]);
    client.inputStack = [];
    client.join(roomName);
    client.emit('init', client.number);
    client.emit('newPlayer', client.number);
  }

  function handleDisconnect(){
    console.log(`${client.id} left`);
  }

  function handleInput(inputAction) {
    const roomName = clientRooms[client.id];
    if (!roomName) {
      return;
    }
    try {
      keyCode = parseInt(inputAction);
    } catch(e) {
      console.error(e);
    }

    if (inputAction != client.lastInput){
      playerArray = state[roomName].players;
      playerArray[client.number -1].inputStack.push(inputAction);
      //console.log("Player: "+client.number -1+" input stack is: "+playerArray[client.number -1].inputStack.length);
      client.lastInput = inputAction;  
    }

    //getUpdatedVelocity(state[roomName], state[roomName].players[client.number -1], inputAction);

  }
});

function startGameInterval(roomName, FPS) {
  console.log("FPS is: "+FPS);
  const intervalId = setInterval(() => {
    const winner = gameLoop(state[roomName]);

    // ##TODO - rework gameOver system as it's not in use
    if (!winner) {
      emitGameState(roomName, state[roomName]);
    } else {
      emitGameOver(roomName, winner);
      console.log("Clearing: "+roomName);
      state[roomName] = null;

      clearInterval(intervalId);
    }
  }, 1000 / FPS);

  // Check if game has players after 5 seconds
  setTimeout(function () {
    evaluateGame(intervalId, roomName);
  }, 5000);


  // Check every 1 minute if game has players
  var checkInterval = setInterval (() => {
    if(!evaluateGame(intervalId, roomName)){
      clearInterval(checkInterval)
    }
  }, 60000);


  // If we ever want to force close games older than timeOutMS
  if(gameTimeout){
    setTimeout(function () {
      evaluateGame(intervalId, roomName, true);
    }, timeOutMS);
  }
}

function evaluateGame(intervalId, roomName, forceClear) {
const clients = io.sockets.adapter.rooms.get(roomName);
const numClients = clients ? clients.size : 0;
  if(numClients == 0 || forceClear){
    clearInterval(intervalId);
    //io.sockets.in(roomName).emit('disconnect');
    state[roomName] = null;
    delete state[roomName];
    console.log("Clearing: ",roomName);
    return false
  }
  return true
}
  // https://stackoverflow.com/a/25028953




function emitGameState(room, gameState) {
  // Send this event to everyone in the room.
  io.sockets.in(room)
    .emit('gameState', JSON.stringify(gameState));
}

function emitGameOver(room, winner) {
  io.sockets.in(room)
    .emit('gameOver', JSON.stringify({ winner }));
}

function handleEditGameRules(){
    updateGameRules(state[clientRooms[client.id]])
}




// ##TODO - remove disconnected snakes using on.disconnect