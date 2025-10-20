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


class Bot {
  constructor(name, code) {
    this.kick_reward = 0;
    this.scored = 0;
    this.room = null;
    this.name = name;
    this.goals = 0;
    this.i = 0;
    this.last_action = 0
    this.last_touched_ball = 0;

    this.join_room(code);
  }

  join_room(code) {
    console.log("Joining room");
    Utils.generateAuth().then(([authKey, authObj]) => {
      Room.join(
        {
          id: code,
          authObj: authObj,
        },
        {
          storage: {
            player_name: this.name,
            avatar: null,
            crappy_router: true,
            geo: {
              lat: 20,
              lon: 40,
              flag: "cr",
            },
          },
          onOpen: (room) => {
            this.room = room;

            room.onPlayerBallKick = (id, data) => {
              if (id == room.currentPlayerId) {
                this.kick_reward = 5;
              }
            };

            room.onTeamGoal = (id, data) => {
              if (room.currentPlayer.team.id == id) {
                this.scored = 50;
                if (this.last_touched_ball == room.currentPlayerId) {
                  this.scored += 10;
                  this.goals += 1;
                }
              } else {
                this.scored = -45;
              }
            };

            room.onCollisionDiscVsDisc = (disc1, discplayer1, disc2, discplayer2) => {
              if (room.getDisc(disc1) == room.getBall() || room.getDisc(disc2) == room.getBall()) {
                if (discplayer1 == room.currentPlayerId || discplayer2 == room.currentPlayerId) {
                  this.kick_reward = 0.4;
                }

                if (discplayer1) {
                  this.last_touched_ball = discplayer1;
                } else if (discplayer2) {
                  this.last_touched_ball = discplayer2;
                }
              }
            }
          },

          onConnInfo: (state) => {
            const states = [
              "Disconnected",
              "Connecting",
              "Awaiting State",
              "Connected",
              "Connection Failed",
            ];
            console.log(`Status: ${states[state]}`);
          },
          onClose: (reason) => {
            console.log(this.name + " closed: ", reason);
            this.join_room(code);
          },
        },
      );
    });
  }

  get_state() {
    if (
      this.room != null &&
      this.room.gameState != null &&
      this.room.extrapolate(150, false).getPlayer(this.room.currentPlayer.id)?.disc !=
      null
    ) {
      this.i += 1;
      if ((this.i - this.last_action) > 30) {
        this.room.setKeyState(Utils.keyState(0, 0, 0), true);
        return undefined;
      }

      let team = this.room.currentPlayer.team;
      let goal;
      let own_goal;
      for (const i of this.room.state.stadium.goals) {
        if (i.team != team) {
          goal = i;
        } else {
          own_goal = i;
        }
      }


      let ball = JSON.parse(JSON.stringify(this.room.getBall().pos));

      let ball_speed = JSON.parse(JSON.stringify(this.room.getBall().speed));
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

      this.room.extrapolate(150, false);

      let current = this.room
        .extrapolate(170, false)
        .getPlayer(this.room.currentPlayer.id)?.disc.pos;

      let speed = this.room
        .extrapolate(170, false)
        .getPlayer(this.room.currentPlayer.id)?.disc.speed;


      let enemy = { x: 0, y: 0 };
      let enemy2 = { x: 0, y: 0 };
      let enemy3 = { x: 0, y: 0 };
      let enemy4 = { x: 0, y: 0 };

      let ally = { x: 0, y: 0 };
      let ally2 = { x: 0, y: 0 };
      let ally3 = { x: 0, y: 0 };

      for (const i of this.room.players) {
        if (i.disc != null) {
          if (i.team.id != this.room.currentPlayer.team.id) {
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

      let height = this.room.stadium.bgHeight;
      if (height == 0 || height == null || height == undefined) {
        height = this.room.stadium.height;
      }

      let width = this.room.stadium.bgWidth;
      if (width == 0 || width == null || width == undefined) {
        width = this.room.stadium.width;
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
        reward: speed_goal + this.kick_reward + this.scored,
        speed: {
          x: speed.x / 2.6,
          y: speed.y / 2.6
        }
      }

      this.kick_reward = 0;
      this.scored = 0;

      return state;
    }
  }

  do_action(action) {
    this.last_action = this.i;

    let horizontal = 0;
    let vertical = 0;
    let kick = false;
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
      this.room.setKeyState(Utils.keyState(horizontal, vertical, kick), true);
    }
  }
}

module.exports = Bot;