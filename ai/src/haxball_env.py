import asyncio
import json
from threading import Thread
import threading
import gymnasium as gym
from gymnasium import spaces
import numpy as np
import abc

class HaxballEnv(gym.Env):
    def __init__(self, websocket, name):
        super(HaxballEnv, self).__init__()
        websocket.send(name)

        self.tick = 1

        self.name = name
        self.action_space = spaces.Discrete(10)  # 0=left, 1=right, 2=up, 3=down, 4=kick
        self.observation_space = spaces.Box(low=-np.inf, high=np.inf, shape=(24,), dtype=np.float32)
        self.websocket = websocket
        self.last_action = np.array([0, 0, 0, 0, 0], dtype=np.float32)

        self.last_obs = np.zeros((24,), dtype=np.float32)

        self.reset()

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)


        self.done = False
        return self.last_obs.copy(), {}

    def step(self, action):

        self.websocket.send(str(action))
        

        message = self.websocket.recv()
        
        
        data = json.loads(message)

        obs = game_state_to_observation(data);
        self.ball_pos = np.array([obs[0], obs[1]])
        self.ball_vel = np.array([obs[2], obs[3]])
        self.goal1_pos = np.array([obs[4], obs[5]])
        self.goal2_pos = np.array([obs[6]])
        self.enemy_pos = np.array([obs[7], obs[8]])
        self.enemy2_pos = np.array([obs[9], obs[10]])
        self.enemy3_pos = np.array([obs[11], obs[12]])
        self.enemy4_pos = np.array([obs[13], obs[14]])

        self.ally_pos = np.array([obs[15], obs[16]])
        self.ally2_pos = np.array([obs[17], obs[18]])
        self.ally3_pos = np.array([obs[19], obs[20]])

        self.own_goal = np.array([obs[21]])
        self.speed = np.array([obs[22], obs[23]])



        terminated = data["terminated"]
        truncated = data["truncated"]


        reward = -0.01 + self.calculate_reward(action) + data['reward']
        
        # if self.name == "Burrigma":
        #     print("Ball pos: ", self.ball_pos)
        #     print("Goal pos: ", self.goal1_pos)
        #     print("Total reward:",reward)
        #     print("---")
            

        self.last_obs = obs
        return obs, reward, terminated, truncated, {}

    def calculate_reward(self, action):
        import math

        # Reward for the agent getting closer to the ball (positive when distance decreases).
        # treat obs[0:2] as ball position RELATIVE to the agent; use previous observation to compute delta.
        curr_ball_dist = np.linalg.norm(self.ball_pos)
        prev_ball_vec = self.last_obs[0:2]
        prev_ball_dist = np.linalg.norm(prev_ball_vec) if np.any(prev_ball_vec) else curr_ball_dist

        approach_coeff = 0.12    # tune between ~0.05..0.2
        approach_reward = approach_coeff * (prev_ball_dist - curr_ball_dist)

        # small time penalty to encourage quicker approaches
        step_penalty = -0.005

        # optional small shaping from speed towards the ball (kept small)
        dir_to_ball = self.ball_pos / (np.linalg.norm(self.ball_pos) + 1e-6)
        r_vel = 0.05 * max(0, np.dot(self.speed, dir_to_ball))

        # bookkeeping tick (kept for any debug you want)
        self.tick = self.tick + 1

        return approach_reward + r_vel + step_penalty

        """         distance_ball = math.sqrt(self.ball_pos[0] ** 2 + self.ball_pos[1] ** 2)
        last_distance = math.sqrt(self.last_obs[0] ** 2 + self.last_obs[1] ** 2)

        if last_distance < distance_ball:
            return -0.07
        else:
            return 0.07 """



        

    

def dist(a, b):
    return np.linalg.norm(a-b)

alpha = 0.2
def potential(ball_pos):
    return -alpha * np.linalg.norm(ball_pos)

def game_state_to_observation(data):
    ball_pos_x = data['ball_pos']['x'] #0
    ball_pos_y = data['ball_pos']['y'] #1
    ball_vel_x = data['ball_speed']['x'] #2
    ball_vel_y = data['ball_speed']['y'] #3
    goal1_pos_x = data['goal_pos']['p0']['x'] #4
    goal1_pos_y = data['goal_pos']['p0']['y'] #5
    goal2_pos_y = data['goal_pos']['p1']['y']
    enemy_pos_x = data['enemy_pos']['x']
    enemy_pos_y = data['enemy_pos']['y']
    enemy2_pos_x = data['enemy2_pos']['x']
    enemy2_pos_y = data['enemy2_pos']['y']
    enemy3_pos_x = data['enemy3_pos']['x']
    enemy3_pos_y = data['enemy3_pos']['y']
    enemy4_pos_x = data['enemy4_pos']['x']
    enemy4_pos_y = data['enemy4_pos']['y']
    ally_pos_x = data['ally_pos']['x']
    ally_pos_y = data['ally_pos']['y']
    ally2_pos_x = data['ally2_pos']['x']
    ally2_pos_y = data['ally2_pos']['y']
    ally3_pos_x = data['ally3_pos']['x']
    ally3_pos_y = data['ally3_pos']['y']
    own_goal_x = data['own_goal_x']
    speed_x = data['speed']['x']
    speed_y = data['speed']['y']

    return np.array([
        ball_pos_x, ball_pos_y,
        ball_vel_x, ball_vel_y,
        goal1_pos_x, goal1_pos_y,
        goal2_pos_y,
        enemy_pos_x, enemy_pos_y,
        enemy2_pos_x, enemy2_pos_y,
        enemy3_pos_x, enemy3_pos_y,
        enemy4_pos_x, enemy4_pos_y,
        ally_pos_x, ally_pos_y,
        ally2_pos_x, ally2_pos_y,
        ally3_pos_x, ally3_pos_y,
        own_goal_x,
        speed_x, speed_y
    ], dtype=np.float32)



class ActionRepeatWrapper(gym.Wrapper):
    def __init__(self, env, repeat=3):
        super().__init__(env)
        self.repeat = repeat

    def step(self, action):
        total_reward = 0.0
        for _ in range(self.repeat):
            obs, reward, terminated, truncated, hehe = self.env.step(action)
            total_reward += reward

        return obs, total_reward, terminated, truncated, {}

    def reset(self, **kwargs):
        return self.env.reset(**kwargs)