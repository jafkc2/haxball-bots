const { OperationType, VariableType, ConnectionState, AllowFlags, Direction, CollisionFlags, CameraFollow, BackgroundType, GamePlayState, BanEntryType, Callback, Utils, Room, Replay, Query, Library, RoomConfig, Renderer, Errors, Language, EventFactory, Impl } = require("node-haxball")();
const fs = require('fs');
const { spawn } = require('child_process');
const Bot = require('./bot')
const readline = require('readline');
const config = require('./get_config');
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 1327 });

const ais = [];

var is_ai_started = false;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const config = config();

const player_name = config[0] || "JafKC";
const python_env = config[1] || "python";
 
console.log(`Using player name: ${player_name}`);
console.log(`Using python environment: ${python_env}`);

let token = "";
rl.question('Obtain a haxball room token from haxball.com/headlesstoken and paste it here: ', (answer) => {
  token = answer.trim();
});

Room.create({
  name: "HaxLock",
  maxPlayerCount: 32,
  showInRoomList: false,
  token: token
}, {
  storage: {
    player_name: "HaxLock",
    avatar: "🤪",
    geo: {
      lat: 20,
      lon: 40,
      flag: "jp"
    }
  },
  onOpen: (room) => {
    const stadium_string = fs.readFileSync('stadium.hbs', 'utf8');
    room.setCurrentStadium(Utils.parseStadium(stadium_string))

    room.setScoreLimit(3);
    room.setTimeLimit(4);

    room.onAfterRoomLink = (roomLink) => {
      console.log("room link: ", roomLink);
      let code = roomLink.replace("https://www.haxball.com/play?c=", "");

      // This check needs to be done. For some reason this piece of code may run multiple times
      if (!is_ai_started) {
        setTimeout(() => {
          is_ai_started = true;
          start_websocket_server(code);
          start_ai(code);
        }, 2000);

      }

    };

    room.onPlayerJoin = (player) => {
      if (player.name == player_name) {
        room.setPlayerAdmin(player.id, true);
      }
    }

    room.onAfterGameTick = () => {
      ais.forEach(([ws, bot]) => {
        const state = bot.get_state();
        if (state != undefined){
          ws.send(JSON.stringify(bot.get_state()))
        }
      })
    }

    room.onAfterGameEnd = (team, data) => {
      console.log("Game ended. Restarting...");
      room.stopGame();
      room.startGame();

    }


  },
  onConnInfo: (state) => {
    const states = [
      "Disconnected",
      "Connecting",
      "Awaiting State",
      "Connected",
      "Connection Failed"
    ];
    console.log(`Status: ${states[state]}`);
  },
});

function start_ai(code) {
  let a = spawn(python_env, ["ai/src/main.py"], { stdio: 'inherit', detached: false });
}


function start_websocket_server(code) {
  wss.on('connection', function connection(ws) {
    console.log('A client connected');
    let name = null
    let index = null;

    ws.on('message', function incoming(message) {
      if (!is_number(message.toString())) {
        const bot = new Bot(message.toString(), code);
        index = ais.length;
        ais.push([ws, bot]);
        name = message;
      } else if (name != null){
        ais[index][1].do_action(parseInt(message));
      }

    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });
}


function is_number(value) {
     if (value.match(/^\d+$/)) {
        return true;
   } else {
        return false;
   }
}