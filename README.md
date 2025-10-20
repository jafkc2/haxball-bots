# Haxball Bots

PPO Agents that learn to play [Haxball](https://haxball.com), a physics based, soccer game.
The objective of this project is to create RL agents capable of playing at human level.

## How it works

The model uses Stable-Baselines3's PPO algorithm.
A custom Gym environment bridges the agent and the Haxball game, sending actions and receiving game states via WebSockets.
The NodeJS side uses Node-Haxball to handle communication with the Gym environment and create the game room where agents train.

## How to use
###### System dependencies
- NodeJS
- Python 3.13+
- Poetry
- Git

First, clone the repository with
```bash
git clone https://github.com/jafkc2/haxball-bots.git
```
change directory to the repository folder
```bash
cd haxball-bots
```
install project dependencies
```bash
npm install
cd ai
poetry install
cd ..
```
configure config.json, like this:
```json
{
    "haxball_name": "JafKC",
    "python_env_executable_path": "/home/jaf/Documents/haxball-bots/.venv/bin/python"
}
```
run
```bash
npm run start
```
you will be prompted for a haxball room token, get it at https://www.haxball.com/headlesstoken

