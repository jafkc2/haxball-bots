const {
  OperationType,
  VariableType,
  ConnectionState,
  AllowFlags,
  Direction,
  CollisionFlags,
  CameraFollow,
  BackgroundType,
  GamePlayState,
  BanEntryType,
  Callback,
  Utils,
  Room,
  Replay,
  Query,
  Library,
  RoomConfig,
  Renderer,
  Errors,
  Language,
  EventFactory,
  Impl,
} = require("node-haxball")();
const WebSocket = require('ws');
const fs = require('fs');
const wss = new WebSocket.Server({ port: 1327 });
const { spawn } = require('child_process');

const ais = [];
var started = false;

var team_red = true;
var i = 1;
last_goal_tick = i;
const roomCallbacks = {
  onPlayerJoin: (player) => {
    console.log(room.state.stadium.name);
    console.log(`${player.name} joined.`);
    console.log(room.state.getPlayer(player.id).id);
    if (team_red){
      room.setPlayerTeam(player.id, 1, 0);
      team_red = false;
    } else{
      room.setPlayerTeam(player.id, 2, 0);
      team_red = true;
    }
    if (room.state.players.length ==8 && !started) {
      
      room.startGame(0);
      started = true;
      
    }
  },
  onStartGame: (id) => {
    room.startRecording();
    console.log(`Game has started.`);
    for (const i of room.state.players) {
      console.log(i.name, i.team.id);
    }
  },
  onGameTick: () => {
    ais.forEach(([ws, bot]) => {
      if (bot.get_state() != undefined) {
        ws.send(JSON.stringify(bot.get_state()))
      }
    })

    if (i % 1500 == 0) {
      room.state.players.forEach((player) => {
        console.log(`Player ${player.name} (${player.id}) is at position (${player.disc.pos.x}, ${player.disc.pos.y})`);
      });
      const ball = room.gameState.physicsState.discs[0];
      console.log("Ball is at position (" + ball.pos.x + ", " + ball.pos.y + ")");
      console.log("Red Goals:", room.gameState.redScore, "Blue Goals:", room.gameState.blueScore);
    }

    if ((i - last_goal_tick) > 30000){
      let replay = room.stopRecording();
      
      if (replay && (room.gameState.blueScore > 0 || room.gameState.redScore > 0)){
        fs.writeFileSync(`replayfile-${i}.hbr2`, Replay.writeAll(Replay.readAll(replay)));
      }
      last_goal_tick = 0;
      i = 0;
      console.log("Reseted game because no goal was scored in the last 30000 ticks.");
      const players = [...room.state.players];
      room.stopGame(0);
      room.startGame(0);
      players.forEach((p) => {
        ais[p.id][1].truncated = true;
        let team = 1;
        if (p.team.id == 1){
          team = 2;
        }
        console.log(p.name, p.id, "now is a member of team", team)
        room.setPlayerTeam(p.id, team, 0)
      });
      room.startRecording();
    }
    i++;

  },

  onPlayerBallKick: (id, data) => {
    console.log("Player " + id + " kicked the ball.");
    ais[id][2] += 5;
  },

  onTeamGoal: (id, data) => {
    console.log("Goal scored by team ", id, "at", room.gameState.timeElapsed, "ms");
    last_goal_tick = i;
    for (const i of room.state.players){
      ais[i.id][1].terminated = true;
      if (i.team.id == id) {
        ais[i.id][2] = 50;
      } else{
        ais[i.id][2] = -45;

      }
    }
  },

  onCollisionDiscVsDisc: (disc1, discplayer1, disc2, discplayer2) => {
    if (disc1 == 0) {
      if (discplayer2) {
        ais[discplayer2][2] = 0.7;
      }
    } else if (disc2 == 0) {
      if (discplayer1) {
        ais[discplayer1][2] = 0.7;
      }
    }
  }
}

const room = Room.sandbox(roomCallbacks);
room.setCurrentStadium(Utils.parseStadium(fs.readFileSync('stadium.hbs', 'utf8')), 0);
let replay = new Replay.ReplayData();
room.setSimulationSpeed(20);
room.setTimeLimit(0, 0);
room.setScoreLimit(0, 0);
start_websocket_server(11);
start_ai(11)

//room.startGame(0);

function start_ai(code) {
  let a = spawn(".venv/bin/python", ["ai/src/main.py"], { stdio: 'inherit', detached: false, env: {...process.env, IPEX_XPU_ONEDNN_LAYOUT: 1} });
}


function start_websocket_server(code) {
  wss.on('connection', function connection(ws) {
    console.log('A client connected');
    let name = null
    let index = null;

    ws.on('message', function incoming(message) {
      if (!is_number(message.toString())) {
        index = ais.length;
        const bot = new Bot(message.toString(), room, index);

        ais.push([ws, bot, 0]);
        name = message;
      } else if (name != null) {
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

class Bot {
  constructor(name, room, id) {
    this.room = room;
    this.name = name;
    this.id = id;
    this.reward = 0;
    this.last_action = i;
    this.terminated = false;
    this.truncated = false;

    this.join_room(room, id);
  }

  join_room(room) {
    room.playerJoin(this.id, this.name, "br", this.id, "", "")

  }

  get_state() {
    if (
      this.room != null &&
      this.room.gameState != null &&
      this.room.state.getPlayer(this.id)?.disc !=
      null
    ) {
      if ((i - this.last_action) > 30){
        room.playerInput(Utils.keyState(0,0,0), this.id);
        return undefined;
      }


      let team = this.room.state.getPlayer(this.id).team;
      let goal;
      let own_goal;
      for (const i of this.room.state.stadium.goals) {
        if (i.team != team) {
          goal = i;
        } else {
          own_goal = i;
        }
      }

      //console.log("Speed of the ball: {x: " + speed.x + " y: " + speed.y + "}")

      let ball = JSON.parse(JSON.stringify(this.room.gameState.physicsState.discs[0].pos));

      let ball_speed = JSON.parse(JSON.stringify(this.room.gameState.physicsState.discs[0].speed));
      if (ball_speed.x < 0.001 && ball_speed.x > -0.001) {
        ball_speed.x = 0;
      }
      if (ball_speed.y < 0.001 && ball_speed.y > -0.001) {
        ball_speed.y = 0;
      }

      let dir = [goal.p0.x - ball.x, (goal.p0.y + goal.p1.y) / 2 - ball.y];
      let norm = Math.hypot(dir[0], dir[1]);
      if (norm == 0) {
        dir[0] = 0;
        dir[1] = 0;
      } else {
        dir[0] = dir[0] / norm;
        dir[1] = dir[1] / norm;
      }
      let speed_goal = (ball_speed.x * dir[0] + ball_speed.y * dir[1]) / 2.5;

      let current = this.room.state.getPlayer(this.id).disc.pos;
      let speed = this.room.state.getPlayer(this.id).disc.speed;
      //console.log(this.name, current.x, current.y);
      //console.log("player: " + current.x + " and " + current.y);
      //console.log("speed: " + ball_speed.x + " and " + ball_speed.y);

      let enemy = { x: 2, y: 2 };
      let enemy2 = { x: 2, y: 2 };
      let enemy3 = { x: 2, y: 2 };
      let enemy4 = { x: 2, y: 2 };

      let ally = { x: 2, y: 2 };
      let ally2 = { x: 2, y: 2 };
      let ally3 = { x: 2, y: 2};

      for (const i of this.room.state.players) {
        if (i.disc != null) {
          if (i.team.id != this.room.state.getPlayer(this.id).team.id) {
            if (enemy.x == 0 && enemy.y == 0) {
              enemy.x = i.disc.pos.x;
              enemy.y = i.disc.pos.y;
            } else if (enemy2.x == 0 && enemy2.y == 0) {
              enemy2.x = i.disc.pos.x;
              enemy2.y = i.disc.pos.y;
            } else if (enemy3.x == 0 && enemy3.y == 0) {
              enemy3.x = i.disc.pos.x;
              enemy3.y = i.disc.pos.y;
            } else if (enemy4.x == 0 && enemy4.y == 0) {
              enemy4.x = i.disc.pos.x;
              enemy4.y = i.disc.pos.y;
            }
          } else {
            if (ally.x == 0 && ally.y == 0) {
              ally.x = i.disc.pos.x;
              ally.y = i.disc.pos.y;
            } else if (ally2.x == 0 && ally2.y == 0) {
              ally2.x = i.disc.pos.x;
              ally2.y = i.disc.pos.y;
            } else if (ally3.x == 0 && ally3.y == 0) {
              ally3.x = i.disc.pos.x;
              ally3.y = i.disc.pos.y;
            }
          }
        }
      }

      let height = this.room.state.stadium.bgHeight;
      if (height == 0 || height == null || height == undefined) {
        height = this.room.state.stadium.height;
      }

      let width = this.room.state.stadium.bgWidth;
      if (width == 0 || width == null || width == undefined) {
        width = this.room.state.stadium.width;
      }
      width = width * 2;
      height = height * 2;

      let own_g_pos = own_goal.p0.x;
      if (own_g_pos == undefined) {
        own_g_pos = 0.0;
      }

      const state = {
        ball_pos:
        {
          x: (ball.x - current.x) / width,
          y: (ball.y - current.y) / height
        },
        ball_speed:
        {
          x: ball_speed.x / 6,
          y: ball_speed.y / 6
        },
        goal_pos:
        {
          p0: {
            x: (goal.p0.x - current.x) / width,
            y: (goal.p0.y - current.y) / height
          },
          p1: {
            y: (goal.p1.y - current.y) / height
          },
        },
        enemy_pos:
        {
          x: (enemy.x - current.x) / width,
          y: (enemy.y - current.y) / height
        },
        enemy2_pos:
        {
          x: (enemy2.x - current.x) / width,
          y: (enemy2.y - current.y) / height
        },
        enemy3_pos:
        {
          x: (enemy3.x - current.x) / width,
          y: (enemy3.y - current.y) / height
        },
        enemy4_pos:
        {
          x: (enemy4.x - current.x) / width,
          y: (enemy4.y - current.y) / height
        },
        ally_pos:
        {
          x: (ally.x - current.x) / width,
          y: (ally.y - current.y) / height
        },
        ally2_pos:
        {
          x: (ally2.x - current.x) / width,
          y: (ally2.y - current.y) / height
        },
        ally3_pos:
        {
          x: (ally3.x - current.x) / width,
          y: (ally3.y - current.y) / height
        },
        own_goal_x: (own_g_pos - current.x) / width,
        reward: speed_goal + ais[this.id][2],
        speed: {
          x: speed.x / 2.6,
          y: speed.y / 2.6
        },
        terminated: this.terminated,
        truncated: this.truncated
      }
      if (ais[this.id][2] > 0){
        this.reward += ais[this.id][2];
        console.log(this.name, this.reward);
      }
      ais[this.id][2] = 0;
      this.terminated = false;
      this.truncated = true;
      return state;
    }
  }

  do_action(action) {
    let horizontal = 0;
    let vertical = 0;
    let kick = false;
    this.last_action = i;
    //console.log(action)
    switch (action) {
      case 0:
        break;
      case 1:
        kick = true;
        break;
      case 2:
        //w
        vertical = -1;
        break;
      case 3:
        // a
        horizontal = -1;
        break;

      case 4:
        //s
        vertical = 1;
        break;

      case 5:
        // d
        horizontal = 1;
        break;

      case 6:
        // wa
        vertical = -1;
        horizontal = -1;
        break;

      case 7:
        // as
        horizontal = -1;
        vertical = 1;
        break;
      case 8:
        //sd
        vertical = 1;
        horizontal = 1;
        break;
      case 9:
        // dw
        horizontal = 1;
        vertical = -1;
        break;
    }

    if (this.room != null) {
      room.playerInput(Utils.keyState(horizontal, vertical, kick), this.id);
    }
  }
}
