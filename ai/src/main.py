# ----------------------------------------------------------------------

import random
import numpy as np
import torch
from websockets.sync.client import connect
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import CheckpointCallback
from stable_baselines3.common.callbacks import CallbackList
from stable_baselines3.common.utils import set_random_seed
import intel_extension_for_pytorch as ipex

from haxball_env import HaxballEnv
from haxball_env import ActionRepeatWrapper

# def handler(websocket):
#     print("Client connected")
#     env = HaxballEnv(websocket, name)
#     env = ActionRepeatWrapper(env)
    
#     checkpoint_callback = CheckpointCallback(
#         save_freq=3000,
#         save_path="./models/",
#         name_prefix=name,
#         save_replay_buffer=True,
#         save_vecnormalize=True
#     )
    
#     callback = CallbackList([checkpoint_callback])

#     model = PPO("MlpPolicy", env, verbose=1)
#     # model = PPO.load("burrigma", env=env)

#     model.learn(total_timesteps=100_000, callback=callback)
#     model.save(name)
from multiprocessing import Process

ai_processes = []
def main():
    names = ["Agent1", "Agent2", "Agent3", "Agent4", "Agent5", "Agent6", "Agent7", "Agent8"]

    x = 0;
    for name in names:
        p = Process(target=start_ai, args=(name, x))
        p.start()
        ai_processes.append(p)
        x = x + 1;
        if x > 2:
            x = 0;

def start_ai(name, x):
    print("Starting", name)
    with connect("ws://localhost:1327", ping_timeout=900) as websocket:
        seed = abs(hash(name)) % (2**31)

        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        set_random_seed(seed)
        
        env = HaxballEnv(websocket, name)
        env = ActionRepeatWrapper(env)

        env.action_space.seed(seed)
        env.observation_space.seed(seed)


        checkpoint_callback = CheckpointCallback(
            save_freq=5000,
            save_path="./models/",
            name_prefix=name,
            save_replay_buffer=True,
            save_vecnormalize=True
        )

        callback = CallbackList([checkpoint_callback])
        torch.set_float32_matmul_precision('high')

        #model = PPO("MlpPolicy", env, verbose=1)
        model = PPO("MlpPolicy", env, verbose=1, seed=seed)

        #model.learn(total_timesteps=500_000, callback=callback)
        model.learn(total_timesteps=2_000_000)

        model.save('./models/final_' + name)
    
def test_ai(name, x):
    print("Starting", name)
    with connect("ws://localhost:1327", ping_timeout=900) as websocket:
        seed = abs(hash(name)) % (2**31)

        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        set_random_seed(seed)
        
        env = HaxballEnv(websocket, name)
        env = ActionRepeatWrapper(env)

        env.action_space.seed(seed)
        env.observation_space.seed(seed)


        checkpoint_callback = CheckpointCallback(
            save_freq=3000,
            save_path="./models/",
            name_prefix=name,
            save_replay_buffer=True,
            save_vecnormalize=True
        )

        callback = CallbackList([checkpoint_callback])

        #model = PPO("MlpPolicy", env, verbose=1)
        #model = PPO("MlpPolicy", env, verbose=1, seed=seed)
        m = ""
        if x:
            m = "./models/final_Agent1"
        else:
            m = "./models/final_Agent2"

        model = PPO.load(m, env=env, seed=seed)

        #model.learn(total_timesteps=500_000, callback=callback)
        obs, _e = env.reset()
        for _ in range(100_000):
            action, states = model.predict(obs, deterministic=True)
            obs, reward, done, info, aaa = env.step(action)

main()
for p in ai_processes:
    p.join()
